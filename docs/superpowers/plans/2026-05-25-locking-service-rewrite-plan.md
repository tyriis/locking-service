# Locking Service Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cleanroom rewrite of locking-service from NestJS to Fastify/Zod following Pragmatic Vertical Slices.

**Architecture:** Fastify for HTTP delivery, Zod for domain schema/validation, isolated LockService with dependency injected LockRepository (Redis).

**Tech Stack:** Fastify, Zod, @fastify/type-provider-zod, ioredis, timestring, vitest, pnpm.

---

### Task 1: Scaffolding & Initial Setup

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/config.ts`

- [ ] **Step 1: Write `package.json` and install dependencies**

```bash
cat << 'EOF' > package.json
{
  "name": "locking-service",
  "version": "0.1.1",
  "description": "Locking service rewrite",
  "type": "module",
  "imports": {
    "#root/*": {
      "development": "./src/*.ts",
      "default": "./dist/*.js"
    }
  },
  "main": "dist/index.js",
  "scripts": {
    "clean": "rm -rf dist",
    "dev": "NODE_OPTIONS=--conditions=development tsx watch src/index.ts",
    "build": "pnpm run clean && tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "packageManager": "pnpm@10.9.0",
  "devDependencies": {
    "@types/node": "22.0.0",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vitest": "^2.0.4"
  },
  "dependencies": {
    "fastify": "^4.28.1",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.2",
    "@fastify/type-provider-zod": "^4.0.2",
    "ioredis": "^5.4.1",
    "timestring": "^7.0.0",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-node": "^0.52.1",
    "@opentelemetry/instrumentation-http": "^0.52.1",
    "@fastify/otel": "^0.18.1"
  }
}
EOF
pnpm install
```

- [ ] **Step 2: Write `tsconfig.json` and `vitest.config.ts`**

```bash
cat << 'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "baseUrl": ".",
    "outDir": "./dist",
    "paths": {
      "#root/*": ["./src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
EOF

cat << 'EOF' > vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
EOF
```

- [ ] **Step 3: Write configuration schema**

Create `src/config.ts`:

```typescript
import { z } from 'zod'

export const configSchema = z.object({
  PORT: z.string().default('3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default(''),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(): Config {
  return configSchema.parse(process.env)
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts src/config.ts
git commit -m "chore: scaffold project structure and config"
```

### Task 2: Domain Schema (Zod)

**Files:**

- Create: `src/locks/schema.ts`
- Create: `src/locks/schema.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/locks/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createLockSchema, lockSchema } from './schema.ts'

describe('Lock Schemas', () => {
  it('validates CreateLock input', () => {
    const input = { key: 'test-lock', owner: 'user-1', duration: '1h' }
    const result = createLockSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('fails CreateLock on invalid duration type', () => {
    const input = { key: 'test-lock', owner: 'user-1', duration: 3600 }
    const result = createLockSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('validates Lock object', () => {
    const lock = {
      key: 'test',
      owner: 'user',
      duration: '10m',
      createdAt: new Date().toISOString(),
      expireAt: new Date(Date.now() + 600000).toISOString(),
    }
    const result = lockSchema.safeParse(lock)
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/locks/schema.test.ts`
Expected: FAIL due to missing schema file.

- [ ] **Step 3: Write minimal implementation**

Create `src/locks/schema.ts`:

```typescript
import { z } from 'zod'

export const createLockSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  owner: z.string().min(1, 'Owner is required'),
  duration: z.string().min(1, 'Duration is required'),
})

export type CreateLockInput = z.infer<typeof createLockSchema>

export const lockSchema = z.object({
  key: z.string(),
  owner: z.string(),
  duration: z.string(),
  createdAt: z.string().datetime(),
  expireAt: z.string().datetime(),
})

export type Lock = z.infer<typeof lockSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/locks/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/locks/schema.ts src/locks/schema.test.ts
git commit -m "feat: define domain schemas using zod"
```

### Task 3: Error Classes

**Files:**

- Create: `src/errors.ts`

- [ ] **Step 1: Write error classes implementation**

Create `src/errors.ts`:

```typescript
export class DomainError extends Error {
  constructor(
    public message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/errors.ts
git commit -m "feat: add domain error classes"
```

### Task 4: Repository Layer

**Files:**

- Create: `src/locks/repository.ts`

- [ ] **Step 1: Write Repository Implementation**

Create `src/locks/repository.ts`:

```typescript
import Redis from 'ioredis'
import { Lock } from './schema.ts'

export interface LockRepository {
  get(key: string): Promise<Lock | null>
  set(key: string, lock: Lock, durationSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  getAll(prefix: string): Promise<Lock[]>
}

export class RedisLockRepository implements LockRepository {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<Lock | null> {
    const val = await this.redis.get(key)
    if (!val) return null
    return JSON.parse(val) as Lock
  }

  async set(key: string, lock: Lock, durationSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(lock), 'EX', durationSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async getAll(prefix: string = ''): Promise<Lock[]> {
    const keys = await this.redis.keys(`${prefix}*`)
    if (keys.length === 0) return []

    // remove prefix for internal querying if your system needs it,
    // but in vanilla ioredis you fetch with the literal key found.
    const values = await this.redis.mget(keys)

    return values.filter((v): v is string => v !== null).map((v) => JSON.parse(v) as Lock)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/locks/repository.ts
git commit -m "feat: implement RedisLockRepository"
```

### Task 5: Service Layer

**Files:**

- Create: `src/locks/service.test.ts`
- Create: `src/locks/service.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/locks/service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { LockService } from './service.ts'
import { LockRepository } from './repository.ts'
import { ConflictError, NotFoundError } from '../errors.ts'
import { Lock } from './schema.ts'

describe('LockService', () => {
  const mockRepo = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
  } as unknown as LockRepository

  const service = new LockService(mockRepo, 'prefix:')

  it('creates a lock if it does not exist', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce(null)
    const lock = await service.create({ key: 'a', owner: 'b', duration: '10s' })
    expect(lock.key).toBe('a')
    expect(mockRepo.set).toHaveBeenCalled()
  })

  it('throws ConflictError if lock exists', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce({} as Lock)
    await expect(service.create({ key: 'a', owner: 'b', duration: '10s' })).rejects.toThrow(
      ConflictError
    )
  })

  it('finds one lock', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce({ key: 'a' } as Lock)
    const lock = await service.findOne('a')
    expect(lock.key).toBe('a')
  })

  it('throws NotFoundError if lock not found', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce(null)
    await expect(service.findOne('b')).rejects.toThrow(NotFoundError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/locks/service.test.ts`
Expected: FAIL due to missing service file.

- [ ] **Step 3: Write implementation**

Create `src/locks/service.ts`:

```typescript
import timestring from 'timestring'
import { LockRepository } from './repository.ts'
import { CreateLockInput, Lock } from './schema.ts'
import { ConflictError, NotFoundError } from '../errors.ts'

export class LockService {
  constructor(
    private readonly repo: LockRepository,
    private readonly keyPrefix: string = ''
  ) {}

  async create(input: CreateLockInput): Promise<Lock> {
    const existing = await this.repo.get(input.key)
    if (existing) {
      throw new ConflictError(`lock '${input.key}' already aquired`)
    }

    const durationSeconds = timestring(input.duration)
    const createdAt = new Date()
    const expireAt = new Date(createdAt.getTime() + durationSeconds * 1000)

    const lock: Lock = {
      key: input.key,
      owner: input.owner,
      duration: input.duration,
      createdAt: createdAt.toISOString(),
      expireAt: expireAt.toISOString(),
    }

    await this.repo.set(input.key, lock, durationSeconds)
    return lock
  }

  async findOne(key: string): Promise<Lock> {
    const lock = await this.repo.get(key)
    if (!lock) {
      throw new NotFoundError(`lock '${key}' not found`)
    }
    return lock
  }

  async remove(key: string): Promise<null> {
    await this.repo.delete(key)
    return null
  }

  async findAll(): Promise<Lock[]> {
    return this.repo.getAll(this.keyPrefix)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/locks/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/locks/service.ts src/locks/service.test.ts
git commit -m "feat: implement LockService with tests"
```

### Task 6: Fastify Routes

**Files:**

- Create: `src/locks/routes.ts`

- [ ] **Step 1: Write Route Implementations**

Create `src/locks/routes.ts`:

```typescript
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { LockService } from './service.ts'
import { createLockSchema, lockSchema } from './schema.ts'

interface RouteOptions {
  lockService: LockService
}

export const lockRoutes = (options: RouteOptions): FastifyPluginAsync => {
  return async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>()

    app.post(
      '/locks',
      {
        schema: {
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
      '/locks',
      {
        schema: {
          response: {
            200: z.array(lockSchema),
          },
        },
      },
      async (request, reply) => {
        const locks = await options.lockService.findAll()
        return reply.send(locks)
      }
    )

    app.get(
      '/locks/:key',
      {
        schema: {
          params: z.object({ key: z.string() }),
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

    app.delete(
      '/locks/:key',
      {
        schema: {
          params: z.object({ key: z.string() }),
        },
      },
      async (request, reply) => {
        await options.lockService.remove(request.params.key)
        return reply.send(null)
      }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/locks/routes.ts
git commit -m "feat: implement fastify routes for locks"
```

### Task 7: App Construction and Entry

**Files:**

- Create: `src/app.ts`
- Create: `src/index.ts`
- Create: `src/otel.ts`

- [ ] **Step 1: Write OpenTelemetry setup**

Create `src/otel.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'

export const sdk = new NodeSDK({
  instrumentations: [new HttpInstrumentation()],
})

sdk.start()
```

- [ ] **Step 2: Write App Builder**

Create `src/app.ts`:

```typescript
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod'
import Redis from 'ioredis'
import { loadConfig } from './config.ts'
import { RedisLockRepository } from './locks/repository.ts'
import { LockService } from './locks/service.ts'
import { lockRoutes } from './locks/routes.ts'
import { DomainError } from './errors.ts'

export function buildApp() {
  const config = loadConfig()

  const app = Fastify({
    logger: true,
  })

  // Add Zod Compilers
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Error Handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      app.log.warn(error)
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name.replace('Error', ''),
        message: error.message,
      })
    }

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      })
    }

    app.log.error(error)
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    })
  })

  const redis = new Redis(config.REDIS_URL)
  const lockRepo = new RedisLockRepository(redis)
  const lockService = new LockService(lockRepo, config.REDIS_KEY_PREFIX)

  app.register(lockRoutes({ lockService }))

  app.addHook('onClose', async (instance) => {
    await redis.quit()
  })

  return { app, config }
}
```

- [ ] **Step 3: Write Entrypoint**

Create `src/index.ts`:

```typescript
import { sdk } from './otel.ts'
import { buildApp } from './app.ts'

const { app, config } = buildApp()

const start = async () => {
  try {
    const port = parseInt(config.PORT, 10)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const gracefulShutdown = async () => {
  app.log.info('Graceful shutdown signal received')
  await app.close()
  await sdk.shutdown()
  process.exit(0)
}

process.on('SIGTERM', () => void gracefulShutdown())
process.on('SIGINT', () => void gracefulShutdown())

void start()
```

- [ ] **Step 4: Commit**

```bash
git add src/app.ts src/index.ts src/otel.ts
git commit -m "feat: assemble app factory and server entrypoint"
```

### Task 8: Build Verification and Cleanup

**Files:**

- Delete old NestJS code in `src/` (and test/ e2e config).

- [ ] **Step 1: Remove old framework files**

```bash
rm -rf test/
rm -f src/app.controller*
rm -f src/app.module*
rm -f src/app.service*
rm -f src/main.ts
rm -rf src/utils/
rm -f src/locks/lock.interface.ts
rm -f src/locks/lock.module.ts
rm -f src/locks/index.ts
rm -rf src/locks/dto
rm -f src/locks/lock.controller*
rm -f src/locks/lock.service*
```

- [ ] **Step 2: Run all tests and build**

Run: `pnpm test`
Expected: PASS

Run: `pnpm build`
Expected: Successfully generates `dist/`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old nestjs code and verify build"
```
