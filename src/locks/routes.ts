import { FastifyInstance, FastifyPluginAsync } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { LockService } from "./service.js"
import { createLockSchema, lockSchema } from "./schema.js"

interface RouteOptions {
  lockService: LockService
}

const keyParamsSchema = z.object({ key: z.string() })

export const lockRoutes = (options: RouteOptions): FastifyPluginAsync => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>()

    app.post(
      "/locks",
      {
        schema: {
          summary: "Create a new lock",
          tags: ["locks"],
          body: createLockSchema,
          response: {
            201: lockSchema,
          },
        },
      },
      async (request, reply) => {
        const lock = await options.lockService.create(request.body)
        return reply.code(201).send(lock)
      }
    )

    app.get(
      "/locks",
      {
        schema: {
          summary: "Retrieve all active locks",
          tags: ["locks"],
          response: {
            200: z.array(lockSchema),
          },
        },
      },
      async (_request, reply) => {
        const locks = await options.lockService.findAll()
        return reply.send(locks)
      }
    )

    app.get(
      "/locks/:key",
      {
        schema: {
          summary: "Retrieve an active lock by its `key`",
          tags: ["locks"],
          params: keyParamsSchema,
          response: {
            200: lockSchema,
          },
        },
      },
      async (request, reply) => {
        const lock = await options.lockService.findOne(request.params.key)
        return reply.send(lock)
      }
    )

    // The previous implementation answered 200 with an empty body and no
    // content-type header, whether or not the lock existed.
    app.delete(
      "/locks/:key",
      {
        schema: {
          summary: "Remove an existing lock by its `key`",
          tags: ["locks"],
          params: keyParamsSchema,
        },
      },
      async (request, reply) => {
        await options.lockService.remove(request.params.key)
        return reply.code(200).send()
      }
    )
  }
}
