# Locking Service Rewrite Design

## 1. Overview

A cleanroom rewrite of the `locking-service` transitioning from a NestJS foundation to a lightweight Fastify + Zod stack.
The rewrite adopts "Pragmatic Vertical Slices" architecture, aiming for clear boundaries, simple dependency injection,
and excellent testability, mirroring the core setup of the `agent-test` project.

## 2. Project Structure

The application will use ESM modules and organize code by feature vertical (`locks`):

```text
src/
  index.ts         # Entry point, OpenTelemetry initialization, server start
  app.ts           # Fastify application factory, plugin registration
  config.ts        # Zod schema for environment variables (Redis URL, Port)
  locks/
    schema.ts      # Zod schemas (Lock, CreateLock)
    repository.ts  # Redis interaction (LockRepository interface & RedisLockRepository class)
    service.ts     # Business logic (LockService)
    routes.ts      # Fastify routes, connecting schema, service, and HTTP
```

## 3. Validation & Domain (Zod)

Zod will serve as the single source of truth for both runtime validation and TypeScript types.

- **`CreateLockSchema`**: Validates the payload for `POST /locks` (`key`, `owner`, `duration`).
- **`LockSchema`**: Represents the persisted domain object (includes `createdAt` and `expireAt`).
- `@fastify/type-provider-zod` will be utilized to infer request and response types automatically in the route handlers.

## 4. Data Flow & Dependency Injection

To avoid heavy DI frameworks, the application will use manual dependency injection via constructors/factories:

1. **Repository**: `RedisLockRepository` implements a `LockRepository` interface. It handles `ioredis` interactions (`get`, `set` with `EX`, `del`, `keys`, `mget`).
2. **Service**: `LockService` takes `LockRepository` as a constructor argument. It handles business logic, such as using `timestring` to calculate lock expiration and ensuring a lock doesn't already exist.
3. **Routes**: The Fastify plugin in `routes.ts` instantiates the repository and service, then maps the endpoints to the service methods.

## 5. Error Handling

The domain will define custom error classes (e.g., `ConflictError`, `NotFoundError`) that `LockService` will throw.
Fastify's `setErrorHandler` (configured in `app.ts`) will catch these domain errors and map them to standard HTTP responses
(409 Conflict, 404 Not Found), preserving exact parity with the original NestJS API responses.

## 6. Testing Strategy

- **Unit Tests**: `LockService` will be tested using a mock `LockRepository` via `vitest`.
- **Integration/E2E Tests**: The `buildApp()` factory in `app.ts` allows spinning up the Fastify instance in memory for robust HTTP testing.
