import { afterEach, describe, expect, it } from "vitest"
import { FastifyInstance } from "fastify"
import { buildApp } from "./app.js"
import { Config } from "./config.js"
import { LockRepository } from "./locks/repository.js"
import { Lock } from "./locks/schema.js"

const testConfig = (app: Partial<Config["app"]> = {}): Config => ({
  app: { host: "127.0.0.1", port: 3000, pretty: false, ...app },
  redis: { host: "127.0.0.1", port: 6379, keyPrefix: "" },
})

class InMemoryLockRepository implements LockRepository {
  readonly locks = new Map<string, Lock>()

  get(key: string): Promise<Lock | null> {
    return Promise.resolve(this.locks.get(key) ?? null)
  }

  set(key: string, lock: Lock): Promise<void> {
    this.locks.set(key, lock)
    return Promise.resolve()
  }

  delete(key: string): Promise<void> {
    this.locks.delete(key)
    return Promise.resolve()
  }

  getAll(): Promise<Lock[]> {
    return Promise.resolve([...this.locks.values()])
  }
}

const createTestApp = (
  options: { pretty?: boolean } = {}
): {
  app: FastifyInstance
  repository: InMemoryLockRepository
} => {
  const repository = new InMemoryLockRepository()
  const { app } = buildApp({
    config: testConfig({ pretty: options.pretty ?? false }),
    repository,
    logger: false,
  })
  return { app, repository }
}

const apps: FastifyInstance[] = []

const createApp = (options: { pretty?: boolean } = {}): ReturnType<typeof createTestApp> => {
  const created = createTestApp(options)
  apps.push(created.app)
  return created
}

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()?.close()
  }
})

interface ExactResponse {
  statusCode: number
  contentType: string | undefined
  body: string
}

const expectExact = (
  res: { statusCode: number; body: string; headers: Record<string, unknown> },
  expected: ExactResponse
): void => {
  expect(res.statusCode).toBe(expected.statusCode)
  expect(res.headers["content-type"]).toBe(expected.contentType)
  expect(res.body).toBe(expected.body)
}

const json = "application/json; charset=utf-8"

const expectCreateBody = (body: string, key: string, owner: string, duration: number): void => {
  const created = JSON.parse(body) as Record<string, unknown>
  expect(Object.keys(created)).toEqual(["key", "owner", "duration", "createdAt", "expireAt"])
  expect(created.key).toBe(key)
  expect(created.owner).toBe(owner)
  expect(created.duration).toBe(duration)
  expect(typeof created.createdAt).toBe("string")
  expect(typeof created.expireAt).toBe("string")
  expect(new Date(created.expireAt as string).getTime()).toBe(
    new Date(created.createdAt as string).getTime() + duration * 1000
  )
  // Raw body keeps the documented key order and a numeric duration.
  expect(body).toMatch(
    new RegExp(
      `^\\{"key":"${key}","owner":"${owner}","duration":${duration},"createdAt":"[^"]+","expireAt":"[^"]+"\\}$`
    )
  )
}

describe("contract: app endpoints", () => {
  it("GET / returns the pretty printed identifier with a JSON content-type", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/" })
    expectExact(res, {
      statusCode: 200,
      contentType: json,
      body: '{\n  "service": "locking-service",\n  "version": "0.1.1"\n}',
    })
  })

  it("GET / prefers npm package environment variables", async () => {
    const { app } = createApp()
    const name = process.env.npm_package_name
    const version = process.env.npm_package_version
    process.env.npm_package_name = "injected-service"
    process.env.npm_package_version = "9.9.9"
    try {
      const res = await app.inject({ method: "GET", url: "/" })
      expect(res.body).toBe('{\n  "service": "injected-service",\n  "version": "9.9.9"\n}')
    } finally {
      process.env.npm_package_name = name
      process.env.npm_package_version = version
    }
  })

  it("GET /health returns plain text", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/health" })
    expectExact(res, {
      statusCode: 200,
      contentType: "text/plain; charset=utf-8",
      body: "Service operating normally.",
    })
  })
})

describe("contract: locks", () => {
  it("GET /locks is an empty JSON array while no lock exists", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/locks" })
    expectExact(res, { statusCode: 200, contentType: json, body: "[]" })
  })

  it("POST /locks creates a lock and returns the numeric duration in seconds", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })
    expect(res.statusCode).toBe(201)
    expect(res.headers["content-type"]).toBe(json)
    expectCreateBody(res.body, "lock-a", "alice", 60)
  })

  it("POST /locks ignores unknown body properties", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-e", owner: "x", duration: "1m", bogus: 1 },
    })
    expect(res.statusCode).toBe(201)
    expectCreateBody(res.body, "lock-e", "x", 60)
  })

  it("POST /locks answers 409 for an existing key without an error member", async () => {
    const { app } = createApp()
    const payload = { key: "lock-a", owner: "alice", duration: "1m" }
    await app.inject({ method: "POST", url: "/locks", payload })
    const res = await app.inject({ method: "POST", url: "/locks", payload })
    expectExact(res, {
      statusCode: 409,
      contentType: json,
      body: '{"statusCode":409,"message":"lock \'lock-a\' already aquired"}',
    })
  })

  it("POST /locks answers 500 when the duration cannot be parsed", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-d", owner: "x", duration: "nope" },
    })
    expectExact(res, {
      statusCode: 500,
      contentType: json,
      body: '{"statusCode":500,"message":"Internal server error"}',
    })
  })

  it("POST /locks answers 400 for a malformed JSON body", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "POST",
      url: "/locks",
      headers: { "content-type": "application/json" },
      payload: "{",
    })
    expect(res.statusCode).toBe(400)
    expect(res.headers["content-type"]).toBe(json)
    const body = res.json<Record<string, unknown>>()
    expect(Object.keys(body)).toEqual(["message", "error", "statusCode"])
    expect(typeof body.message).toBe("string")
    expect(body.error).toBe("Bad Request")
    expect(body.statusCode).toBe(400)
  })

  it("POST /locks treats an empty JSON body like an empty object", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "POST",
      url: "/locks",
      headers: { "content-type": "application/json" },
      payload: "",
    })
    // Express' body parser turns an empty body into `{}`, so validation (not
    // the parser) rejects it: 400 and never 500.
    expect(res.statusCode).toBe(400)
    expect(res.headers["content-type"]).toBe(json)
    const body = res.json<Record<string, unknown>>()
    expect(body).toEqual({
      message: [
        "key must be longer than or equal to 3 characters",
        "key should not be empty",
        "key must be a string",
        "owner should not be empty",
        "owner must be a string",
        "duration must be longer than or equal to 2 characters",
        "duration should not be empty",
        "duration must be a string",
      ],
      error: "Bad Request",
      statusCode: 400,
    })
  })

  it("GET /locks/:key returns a stored lock", async () => {
    const { app } = createApp()
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })
    const res = await app.inject({ method: "GET", url: "/locks/lock-a" })
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toBe(json)
    expectCreateBody(res.body, "lock-a", "alice", 60)
  })

  it("GET /locks/:key answers 404 for a missing lock", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/locks/nope" })
    expectExact(res, {
      statusCode: 404,
      contentType: json,
      body: '{"statusCode":404,"message":"lock \'nope\' not found","error":"Not Found"}',
    })
  })

  it("GET /locks lists every active lock", async () => {
    const { app } = createApp()
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-e", owner: "x", duration: "1m" },
    })
    const res = await app.inject({ method: "GET", url: "/locks" })
    expect(res.statusCode).toBe(200)
    const locks = res.json<Array<Record<string, unknown>>>()
    expect(locks.map((lock) => lock.key).sort()).toEqual(["lock-a", "lock-e"])
    for (const lock of locks) {
      expect(typeof lock.duration).toBe("number")
    }
  })

  it("returns a legacy stored row unchanged", async () => {
    const { app, repository } = createApp()
    const stored = {
      key: "x",
      owner: "o",
      duration: 60,
      createdAt: "2026-01-01T00:00:00.000Z",
      expireAt: "2026-01-01T00:01:00.000Z",
    }
    repository.locks.set("x", stored)

    const one = await app.inject({ method: "GET", url: "/locks/x" })
    expect(one.body).toBe(JSON.stringify(stored))

    const all = await app.inject({ method: "GET", url: "/locks" })
    expect(all.body).toBe(`[${JSON.stringify(stored)}]`)
  })

  it("DELETE /locks/:key answers 200 with an empty body and no content-type", async () => {
    const { app } = createApp()
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })

    const existing = await app.inject({ method: "DELETE", url: "/locks/lock-a" })
    expectExact(existing, { statusCode: 200, contentType: undefined, body: "" })

    const missing = await app.inject({ method: "DELETE", url: "/locks/nope" })
    expectExact(missing, { statusCode: 200, contentType: undefined, body: "" })

    const list = await app.inject({ method: "GET", url: "/locks" })
    expect(list.body).toBe("[]")
  })
})

describe("contract: validation", () => {
  const cases: Array<{ name: string; payload: Record<string, unknown>; body: string }> = [
    {
      name: "missing duration",
      payload: { key: "lock-b", owner: "bob" },
      body: '{"message":["duration must be longer than or equal to 2 characters","duration should not be empty","duration must be a string"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "short key",
      payload: { key: "ab", owner: "x", duration: "1m" },
      body: '{"message":["key must be longer than or equal to 3 characters"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "short duration",
      payload: { key: "lock-c", owner: "x", duration: "1" },
      body: '{"message":["duration must be longer than or equal to 2 characters"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "empty body",
      payload: {},
      body: '{"message":["key must be longer than or equal to 3 characters","key should not be empty","key must be a string","owner should not be empty","owner must be a string","duration must be longer than or equal to 2 characters","duration should not be empty","duration must be a string"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "numeric duration",
      payload: { key: "lock-f", owner: "x", duration: 60 },
      body: '{"message":["duration must be longer than or equal to 2 characters","duration must be a string"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "numeric key",
      payload: { key: 1, owner: "x", duration: "1m" },
      body: '{"message":["key must be longer than or equal to 3 characters","key must be a string"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "missing owner",
      payload: { key: "lock-g", duration: "1m" },
      body: '{"message":["owner should not be empty","owner must be a string"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "empty owner",
      payload: { key: "lock-h", owner: "", duration: "1m" },
      body: '{"message":["owner should not be empty"],"error":"Bad Request","statusCode":400}',
    },
    {
      name: "empty key",
      payload: { key: "", owner: "x", duration: "1m" },
      body: '{"message":["key must be longer than or equal to 3 characters","key should not be empty"],"error":"Bad Request","statusCode":400}',
    },
  ]

  for (const testCase of cases) {
    it(`answers 400 with class-validator messages for ${testCase.name}`, async () => {
      const { app } = createApp()
      const res = await app.inject({ method: "POST", url: "/locks", payload: testCase.payload })
      expectExact(res, { statusCode: 400, contentType: json, body: testCase.body })
    })
  }
})

describe("contract: routing", () => {
  it("accepts a trailing slash", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/locks/" })
    expectExact(res, { statusCode: 200, contentType: json, body: "[]" })
  })

  it("is case insensitive about paths", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/Locks" })
    expectExact(res, { statusCode: 200, contentType: json, body: "[]" })
  })

  it("answers 404 for an unsupported method", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "PUT", url: "/locks" })
    expectExact(res, {
      statusCode: 404,
      contentType: json,
      body: '{"message":"Cannot PUT /locks","error":"Not Found","statusCode":404}',
    })
  })

  it("answers 404 for an unknown route", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/nope" })
    expectExact(res, {
      statusCode: 404,
      contentType: json,
      body: '{"message":"Cannot GET /nope","error":"Not Found","statusCode":404}',
    })
  })
})

describe("contract: pretty printing", () => {
  it("keeps JSON responses compact by default", async () => {
    const { app } = createApp()
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })
    const res = await app.inject({ method: "GET", url: "/locks" })
    expect(res.body).toBe(JSON.stringify(res.json()))
  })

  it("pretty prints JSON responses when app.pretty is enabled", async () => {
    const { app } = createApp({ pretty: true })
    await app.inject({
      method: "POST",
      url: "/locks",
      payload: { key: "lock-a", owner: "alice", duration: "1m" },
    })
    const res = await app.inject({ method: "GET", url: "/locks" })
    expect(res.body).toBe(JSON.stringify(res.json(), null, 2))
    expect(res.body).toContain('\n  {\n    "key": "lock-a"')
  })
})

describe("contract: openapi", () => {
  /**
   * The subset of the OpenAPI document these tests read. The served document is
   * JSON, so the nested members are modelled as optional and narrowed by the
   * accessors below instead of being read off `any`.
   */
  interface OpenApiSchema {
    type?: string
    minLength?: number
    example?: unknown
    properties?: Record<string, OpenApiSchema>
    items?: OpenApiSchema
  }

  interface OpenApiMediaType {
    schema: OpenApiSchema
  }

  interface OpenApiResponse {
    description?: string
    content?: Record<string, OpenApiMediaType>
  }

  interface OpenApiOperation {
    requestBody?: { content?: Record<string, OpenApiMediaType> }
    responses: Record<string, OpenApiResponse>
  }

  interface OpenApiPathItem {
    get?: OpenApiOperation
    post?: OpenApiOperation
  }

  interface OpenApiDocument {
    paths: Record<string, OpenApiPathItem>
  }

  const operationOf = (
    doc: OpenApiDocument,
    path: string,
    method: "get" | "post"
  ): OpenApiOperation => {
    const operation = doc.paths[path]?.[method]
    if (!operation) {
      throw new Error(`OpenAPI document has no ${method.toUpperCase()} ${path}`)
    }
    return operation
  }

  const responseOf = (operation: OpenApiOperation, status: string): OpenApiResponse => {
    const response = operation.responses[status]
    if (!response) {
      throw new Error(`operation has no ${status} response`)
    }
    return response
  }

  const mediaSchemaOf = (
    media: Record<string, OpenApiMediaType> | undefined,
    mediaType: string
  ): OpenApiSchema => {
    const entry = media?.[mediaType]
    if (!entry) {
      throw new Error(`document has no ${mediaType} content`)
    }
    return entry.schema
  }

  const responseSchemaOf = (response: OpenApiResponse, mediaType: string): OpenApiSchema =>
    mediaSchemaOf(response.content, mediaType)

  const requestSchemaOf = (operation: OpenApiOperation, mediaType: string): OpenApiSchema =>
    mediaSchemaOf(operation.requestBody?.content, mediaType)

  const propertiesOf = (schema: OpenApiSchema): Record<string, OpenApiSchema> => {
    if (!schema.properties) {
      throw new Error("schema has no properties")
    }
    return schema.properties
  }

  const itemsOf = (schema: OpenApiSchema): OpenApiSchema => {
    if (!schema.items) {
      throw new Error("schema has no items")
    }
    return schema.items
  }

  it("serves the swagger UI and the OpenAPI document", async () => {
    const { app } = createApp()

    const ui = await app.inject({ method: "GET", url: "/api" })
    expect(ui.statusCode).toBe(200)
    expect(ui.headers["content-type"]).toBe("text/html; charset=utf-8")
    expect(ui.body).toContain("Swagger UI")

    const doc = await app.inject({ method: "GET", url: "/api-json" })
    expect(doc.statusCode).toBe(200)
    expect(doc.headers["content-type"]).toBe(json)
  })

  it("documents the request and the response schema", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/api-json" })
    const doc = res.json<OpenApiDocument>()

    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/", "/health", "/locks", "/locks/{key}"])
    )

    const create = operationOf(doc, "/locks", "post")
    const request = propertiesOf(requestSchemaOf(create, "application/json"))
    expect(request.key.minLength).toBe(3)
    expect(request.duration.type).toBe("string")
    expect(request.duration.minLength).toBe(2)

    const created = propertiesOf(responseSchemaOf(responseOf(create, "201"), "application/json"))
    expect(created.duration.type).toBe("number")

    const listed = responseSchemaOf(
      responseOf(operationOf(doc, "/locks", "get"), "200"),
      "application/json"
    )
    expect(propertiesOf(itemsOf(listed)).duration.type).toBe("number")
  })

  it("documents the identifier and the health endpoint as string responses", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/api-json" })
    const doc = res.json<OpenApiDocument>()

    const identifier = responseOf(operationOf(doc, "/", "get"), "200")
    expect(responseSchemaOf(identifier, "application/json")).toEqual({ type: "string" })

    const health = responseOf(operationOf(doc, "/health", "get"), "200")
    expect(responseSchemaOf(health, "text/plain")).toEqual({ type: "string" })
  })

  it("documents the failure responses of the lock routes", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/api-json" })
    const doc = res.json<OpenApiDocument>()

    const findOne = operationOf(doc, "/locks/{key}", "get").responses
    expect(Object.keys(findOne)).toEqual(expect.arrayContaining(["400", "404", "500"]))
    expect(findOne["404"].description).toBe("Lock with given key not found")
    expect(responseSchemaOf(findOne["404"], "application/json").example).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "lock 'some-fancy-lock.name' not found",
    })
    expect(findOne["500"].description).toBe("Internal server error")

    const create = operationOf(doc, "/locks", "post").responses
    expect(Object.keys(create)).toEqual(expect.arrayContaining(["201", "400", "409", "500"]))
    expect(responseSchemaOf(create["409"], "application/json").example).toEqual({
      statusCode: 409,
      message: "lock 'some-fancy-lock.name' already aquired!",
    })
    expect(create["500"].description).toBe("Internal server error")
  })

  it("documents owner without a minLength", async () => {
    const { app } = createApp()
    const res = await app.inject({ method: "GET", url: "/api-json" })
    const doc = res.json<OpenApiDocument>()

    const request = propertiesOf(
      requestSchemaOf(operationOf(doc, "/locks", "post"), "application/json")
    )
    expect(request.owner.type).toBe("string")
    expect(request.owner.minLength).toBeUndefined()
  })
})

describe("contract: etag", () => {
  it("sends a weak ETag on GET / and answers a matching If-None-Match with 304", async () => {
    const { app } = createApp()
    const first = await app.inject({ method: "GET", url: "/" })
    expect(first.statusCode).toBe(200)

    const etag = first.headers["etag"]
    expect(typeof etag).toBe("string")
    expect(etag).toMatch(/^W\/"[^"]+"$/)

    // Not a gap: the previous implementation leaked Express' banner.
    expect(first.headers["x-powered-by"]).toBeUndefined()

    const conditional = await app.inject({
      method: "GET",
      url: "/",
      headers: { "if-none-match": etag as string },
    })
    expect(conditional.statusCode).toBe(304)
    expect(conditional.body).toBe("")
  })

  it("answers a non matching If-None-Match with the full response", async () => {
    const { app } = createApp()
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { "if-none-match": 'W/"stale"' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('{\n  "service": "locking-service",\n  "version": "0.1.1"\n}')
  })
})
