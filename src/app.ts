import { STATUS_CODES } from "node:http"
import Fastify, { FastifyError, FastifyInstance } from "fastify"
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import etag from "@fastify/etag"
import { Redis } from "ioredis"
import { Config, loadConfig } from "./config.js"
import { DomainError } from "./errors.js"
import { serviceIdentity } from "./identifier.js"
import { documentContractResponses } from "./openapi.js"
import { LockRepository, RedisLockRepository } from "./locks/repository.js"
import { createLockValidationMessages } from "./locks/schema.js"
import { LockService } from "./locks/service.js"
import { lockRoutes } from "./locks/routes.js"
import { appRoutes } from "./routes.js"

export interface BuildAppOptions {
  /** Injected configuration, mainly for tests. Defaults to the YAML loader. */
  config?: Config
  /** Injected lock repository, mainly for tests. Defaults to the Redis one. */
  repository?: LockRepository
  logger?: boolean
}

export interface BuiltApp {
  app: FastifyInstance
  config: Config
}

export function buildApp(options: BuildAppOptions = {}): BuiltApp {
  const config = options.config ?? loadConfig()

  const app = Fastify({
    logger: options.logger ?? true,
    routerOptions: {
      ignoreTrailingSlash: true,
      caseSensitive: false,
    },
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Express' body parser semantics: an empty JSON body is `{}` (not a parse
  // error) and invalid JSON keeps the position aware wording.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body: string, done) => {
      if (body.length === 0) {
        done(null, {})
        return
      }
      try {
        done(null, JSON.parse(body))
      } catch (error) {
        done(badRequest((error as Error).message), undefined)
      }
    }
  )

  // Express' `json spaces` equivalent: pretty print JSON responses.
  if (config.app.pretty) {
    app.addHook("onSend", async (_request, reply, payload) => {
      if (typeof payload !== "string") return payload
      const contentType = reply.getHeader("content-type")
      if (typeof contentType !== "string" || !contentType.includes("json")) return payload
      try {
        return JSON.stringify(JSON.parse(payload), null, 2)
      } catch {
        return payload
      }
    })
  }

  // Express added a weak ETag to every response and answered a matching
  // `If-None-Match` with 304. Registered after the pretty printer so the hash
  // covers the payload that is actually sent.
  void app.register(etag, { weak: true })

  // Every shape below is byte compatible with the previous implementation:
  // key order, the presence (or absence) of `error` and the message wording.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof DomainError) {
      request.log.warn({ err: error }, "request rejected")
      return reply.status(error.statusCode).send(error.payload)
    }

    if (error.validation) {
      return reply.status(400).send({
        message: createLockValidationMessages(request.body),
        error: "Bad Request",
        statusCode: 400,
      })
    }

    const statusCode = error.statusCode ?? 500
    if (statusCode < 500) {
      return reply.status(statusCode).send({
        message: error.message,
        error: STATUS_CODES[statusCode] ?? "Error",
        statusCode,
      })
    }

    request.log.error({ err: error }, "unhandled error")
    return reply.status(500).send({
      statusCode: 500,
      message: "Internal server error",
    })
  })

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      message: `Cannot ${request.method} ${request.url}`,
      error: "Not Found",
      statusCode: 404,
    })
  })

  void app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "locking-service",
        description: "Locking Service API documentation.",
        version: serviceIdentity().version,
      },
    },
    transform: jsonSchemaTransform,
    transformObject: (document) =>
      "openapiObject" in document
        ? documentContractResponses(document.openapiObject)
        : document.swaggerObject,
  })

  void app.register(swaggerUi, { routePrefix: "/api" })

  const { repository, close } = createRepository(options, config)
  if (close) {
    app.addHook("onClose", close)
  }

  void app.register(appRoutes())
  void app.register(
    lockRoutes({ lockService: new LockService(repository, config.redis.keyPrefix) })
  )

  // Raw OpenAPI document, served where the previous implementation exposed it.
  app.get("/api-json", { schema: { hide: true } }, () => app.swagger())

  return { app, config }
}

/** An error the error handler renders as a 4xx client error. */
const badRequest = (message: string, statusCode = 400): Error =>
  Object.assign(new Error(message), { statusCode })

const createRepository = (
  options: BuildAppOptions,
  config: Config
): { repository: LockRepository; close?: () => Promise<void> } => {
  if (options.repository) {
    return { repository: options.repository }
  }

  const redis = new Redis(config.redis)
  return {
    repository: new RedisLockRepository(redis),
    close: async () => {
      await redis.quit()
    },
  }
}
