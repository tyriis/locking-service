# Locking Service Rewrite Design

**Status:** implemented and verified; this describes the service in `src/` today.

## 1. Purpose and the governing constraint

`locking-service` hands out named, owner-attributed, expiring locks over HTTP with Redis as the store. The rewrite replaces NestJS +
class-validator with Fastify + Zod under one constraint: **the public HTTP API stays byte-identical to the previous service** — paths, methods,
status codes, content types, field names and order, message wording, header presence. New fields were allowed but none were added, so no client
has to change.

Most decisions below exist only for that constraint, and would be over-engineering in a greenfield service: the compatibility error layer, the
schema refinements, the empty-body `DELETE`, the `duration` split.

**Boundaries.** The service is an advisory registry, not a distributed lock manager: there is no authentication, no renewal or refresh,
no release-by-owner check (any caller may delete any key), and no fencing token. A `201` means "this name is claimed until `expireAt`",
and clients are trusted to honour it.

## 2. Stack

**Fastify 5** for HTTP, ESM-only (`"type": "module"`, `NodeNext`), Node 24. **zod 3.x** with `fastify-type-provider-zod` 4.x for validation,
types and OpenAPI (the zod 4 migration is a follow-up, §12). **ioredis** for Redis, **timestring** for durations, **yaml** for configuration,
**vitest** for tests, **pnpm 12.15.0** as package manager.

## 3. Layout and composition

```text
src/
  index.ts        # telemetry, buildApp(), listen, signal handling
  app.ts          # buildApp(): plugins, error/404 handlers, wiring
  config.ts       # YAML loader + config schema, ${env.VAR} substitution
  errors.ts       # DomainError + ConflictError/NotFoundError, payload carrying
  identifier.ts   # service name/version document for GET /
  openapi.ts      # transformObject hook for undocumented responses
  otel.ts         # OpenTelemetry bootstrap and exporter defaults
  routes.ts       # GET / and GET /health
  locks/          # schema.ts, repository.ts, service.ts, routes.ts
```

One feature vertical (`locks`), because there is one domain; tests sit next to their subjects (`src/**/*.test.ts`).

**Composition.** No DI framework. `buildApp({config?, repository?, logger?})` returns `{app, config}`; an injected repository skips Redis and
registers no close hook, otherwise a client is built from config and quit on `onClose`. `LockService` takes the repository and key prefix through
its constructor, and endpoints and lock routes are Fastify plugins, so tests exercise the real plugin graph. The `#root/*` alias is declared in
`package.json` `imports`, `tsconfig.json` `paths` and vitest.

## 4. Configuration contract

Configuration is a **YAML file**, not environment variables: operators already ship a `configuration.yaml` and point `CONFIG_PATH` at it,
and that operations contract had to survive. The file is parsed and validated with zod at boot.

- `CONFIG_PATH` defaults to `${XDG_CONFIG_HOME:-~/.config}/locking-service/configuration.yaml`, and the file is required: a missing file is a
  startup error, never a silent fallback to defaults.
- Every string may reference `${env.VAR}`; an unset or empty variable is a hard error, which is how secrets and hostnames arrive without new
  config keys. `app` and `redis` are strict objects, so unknown keys fail at boot instead of being ignored.

| Key               | Type / rule                                | Default     |
| ----------------- | ------------------------------------------ | ----------- |
| `app.host`        | string, interface to bind                  | `127.0.0.1` |
| `app.port`        | string or number, coerced to integer       | `3000`      |
| `app.pretty`      | boolean; `"true"`/`"false"` also accepted  | `false`     |
| `redis.host`      | string, exclusive with `sentinels`         | —           |
| `redis.port`      | string or number, coerced to integer       | `6379`      |
| `redis.keyPrefix` | string, prepended to every key             | `""`        |
| `redis.sentinels` | array of strict `{host, port}`             | —           |
| `redis.name`      | string, required together with `sentinels` | —           |

`NODE_ENV` must be `development`, `production` or `test`. The sentinel rule is one refinement: `sentinels` (non-empty) **plus** `name` and **no**
`host`, or `host` alone, with entries defaulting to port `26379`. Failures read `Config validation error: <path>: <message>`, pointing an
operator at the offending YAML key.

## 5. HTTP contract

| Method   | Path          | Success          | Notes                                          |
| -------- | ------------- | ---------------- | ---------------------------------------------- |
| `GET`    | `/`           | 200 JSON string  | Pretty-printed identifier document             |
| `GET`    | `/health`     | 200 `text/plain` | `Service operating normally.`                  |
| `POST`   | `/locks`      | 201 JSON lock    | 409 if the key is taken                        |
| `GET`    | `/locks`      | 200 JSON array   | Active (non-expired) locks                     |
| `GET`    | `/locks/:key` | 200 JSON lock    | 404 if absent                                  |
| `DELETE` | `/locks/:key` | 200, empty body  | No content-type; 200 whether or not it existed |
| `GET`    | `/api`        | 200 `text/html`  | Swagger UI                                     |
| `GET`    | `/api-json`   | 200 JSON         | Generated OpenAPI document                     |

JSON responses are `application/json; charset=utf-8` and `/health` is `text/plain; charset=utf-8`. `duration` is a **timestring string in the
request** (`"1m"`) and a **number of seconds in stored data and responses** (`60`), like the old `LockDto` and `openapi.yaml`: posting `"1m"`
still returns `60`. A lock is `{key, owner, duration, createdAt, expireAt}` in that order, with ISO-8601 timestamps.

Deliberate behaviours, all covered by tests:

- Trailing slashes are ignored and paths are case-insensitive (`GET /Locks/` works).
- A weak `ETag` is sent; a matching `If-None-Match` yields `304`. The hook runs after the pretty-printer, so the tag covers the bytes actually
  sent.
- `app.pretty` pretty-prints JSON responses (Express' `json spaces`) without touching the identifier document.
- The JSON parser reads an empty body as `{}`, so an empty POST is a validation `400`, never a `500`.
- The only header not reproduced is Express' `X-Powered-By`: accepted and test-covered, nothing uses it.

## 6. Error and response compatibility layer

`src/errors.ts` plus the handler in `src/app.ts` form one deliberate layer. Domain errors carry their **finished payload** instead of a status
and a message, so key order and the presence or absence of `error` cannot drift as handlers are refactored.

| Situation               | Status | Body (exact key order)                                                           |
| ----------------------- | ------ | -------------------------------------------------------------------------------- |
| Validation failed       | 400    | `{"message": string[], "error": "Bad Request", "statusCode": 400}`               |
| Malformed JSON body     | 400    | `{"message": "<parser message>", "error": "Bad Request", "statusCode": 400}`     |
| Lock missing            | 404    | `{"statusCode": 404, "message": "lock '<key>' not found", "error": "Not Found"}` |
| Key already locked      | 409    | `{"statusCode": 409, "message": "lock '<key>' already aquired"}`                 |
| Unparsable `duration`   | 500    | `{"statusCode": 500, "message": "Internal server error"}`                        |
| Unknown route or method | 404    | `{"message": "Cannot <METHOD> <path>", "error": "Not Found", "statusCode": 404}` |

Two details are contractual. The 409 body has **no** `error` key and keeps the misspelling `aquired`; fixing it would break clients that match on
the message. And the 400 `message` array reproduces class-validator: fields in `key`, `owner`, `duration` order, constraints in `minLength`,
`notEmpty`, `isString` order, wording included. Examples: `key must be longer than or equal to 3 characters`, `owner should not be empty`,
`duration must be a string`. `createLockValidationMessages()` in `src/locks/schema.ts` owns that mapping, so zod's messages never reach the wire;
unhandled failures get the generic 500 body.

## 7. Redis storage and prefix handling

A lock is one Redis string: key = lock key, value = the JSON document, TTL = parsed seconds (`SET ... EX <seconds>`). Redis owns expiry, so
`GET /locks` only ever returns active locks.

Listing uses `SCAN` (cursor loop, `MATCH <prefix>*`, `COUNT 100`) then one `MGET`; `KEYS` was dropped because it blocks the server. `SCAN`
carries a trap that cost a real bug: **ioredis applies `keyPrefix` to `GET`/`SET`/`DEL`/`MGET` but not to the keys `SCAN MATCH` returns.** A
naive `MGET` over scanned keys prepends the prefix twice, so `GET /locks` returned `[]` for every deployment with a prefix configured. The
repository strips the prefix from each scanned key before fetching, pinned by `src/locks/repository.test.ts` with a fake client mimicking
ioredis' asymmetry; `null` values are filtered because a key can expire between scan and fetch. `RedisClient` is a structural interface, so tests
need no mocking library.

## 8. OpenAPI

Swagger was part of the published service, so it was re-added: `@fastify/swagger` 9 with `@fastify/swagger-ui` 6 serve `/api` (UI) and
`/api-json` (document, OpenAPI 3.1.0). Route schemas generate request and success shapes; failure responses cannot live there, because every
response schema on a route becomes a serializer, turning a description into a body contract. The `transformObject` hook in `src/openapi.ts` adds
`/` as a JSON string, `/health` as `text/plain`, and `400`/`404`/`409`/`500` on the lock routes with the originally published examples.
`openapi.yaml` is generated from `/api-json`.

## 9. Telemetry policy

`src/otel.ts` starts `@opentelemetry/sdk-node` 0.300 with `HttpInstrumentation` before the app is built. The service ships no collector, and
sdk-node 0.3x enables bundled OTLP exporters for traces, metrics and logs whenever `OTEL_*_EXPORTER` is unset — every request would chase a
collector that is not there. Each signal therefore defaults to `none`; an operator opts in with the standard variables
(`OTEL_TRACES_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_ENDPOINT=...`). Shutdown awaits `sdk.shutdown()` in a `try`, so a failed flush cannot turn a
controlled `SIGTERM` into a crash.

## 10. Tooling and delivery

`tsconfig.json` typechecks sources and tests, `tsconfig.build.json` excludes `*.test.ts` so `dist/` holds runtime code only. ESLint is a flat,
type-aware reference config with tests ignored; Prettier owns formatting and skips `docs/superpowers/`. lefthook formats, lints and tests on
commit, then typechecks and measures coverage on push. `.nvmrc` pins Node 24.22.1 and `pnpm-workspace.yaml` records `allowBuilds`. CI is one
`verify` job: install, audit, format check, lint, typecheck, coverage, coverage upload, build, Docker smoke build. The Dockerfile is a two-stage
build on digest-pinned `node:24.22.1-alpine`, deriving pnpm from `packageManager`, installing with `--ignore-scripts` (the `prepare` hook needs
git), a production-only runtime, `USER node`, no test stage.

## 11. Testing strategy and parity evidence

Five files, 56 tests, no real Redis anywhere.

- Contract tests (`src/app.test.ts`) drive `app.inject` against an in-memory repository and assert exact bytes — status, content type, body
  string — across the error table, validation messages, pretty printing, ETag/304, routing quirks and the OpenAPI document.
- Unit tests cover `LockService` with a mock repository, both schemas, the YAML loader (defaults, coercion, sentinel rules, env substitution,
  missing file) and the repository's prefix handling. Coverage: 97.08% statements and 84% branches; the 100% gate is a follow-up.

Tests encode what we believe the contract is; the parity capture checks that belief against the original. A 27-case HTTP capture from the
previous NestJS service running against a real Redis was diffed against the new one, comparing status, headers and body. Timestamps and the
ordering of `GET /locks` aside, the responses match. That evidence lives in the plan, not in a suite: the old service is gone.

## 12. Known gaps / follow-ups

- **zod 4 migration.** zod stays 3.x with `fastify-type-provider-zod` 4.x; moving to zod 4 and the provider's 7.x line clears the last accepted
  production advisory — one high advisory is why CI audits at `--audit-level critical` rather than `high`.
- **100% coverage gate.** 97.08% statements and 84% branches are healthy but uneven; the gate waits for deliberately covered branches rather
  than a round number.
- **`@fastify/otel` is unused.** Declared, never imported, and it adds a peer warning (`@opentelemetry/core@2.12.0` wants
  `@opentelemetry/api` below 1.10.0). Wire it in or drop it.
- **vitest 2.x dev-toolchain advisories.** Dev dependencies only, resolved by the vitest 5 / vite 8 line.
