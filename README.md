<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD051 -->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![renovate][renovate-shield]][renovate-url]
[![Fastify][fastify-shield]][fastify-url]
[![Zod][zod-shield]][zod-url]
[![TypeScript][typescript-shield]][typescript-url]

# locking-service

REST API service built with Fastify and Zod that provides distributed locking capabilities using Redis as the backend.

## User Story

As an automation engineer, I need a locking service API to:

- Create locks with configurable TTL using timestring format (e.g. "5m", "1h")
- List active locks and their status
- Auto-expiration
- Owner validation for lock operations

So that I can coordinate access to shared resources across distributed systems.

## Installation

```bash
pnpm install
```

## Configuration

The service is configured with a single YAML file. Its location is taken from `CONFIG_PATH` and
defaults to `${XDG_CONFIG_HOME:-~/.config}/locking-service/configuration.yaml`. `NODE_ENV` must be
set to `development`, `production` or `test`; the file itself is required and the process refuses
to start without it.

```yaml
app:
  # interface to bind, default: 127.0.0.1
  host: 127.0.0.1
  # TCP port, default: 3000
  port: 3000
  # pretty print JSON responses, default: false
  pretty: false

# either a single Redis instance...
redis:
  host: localhost
  port: 6379
  # optional key prefix for every key written by the service
  keyPrefix: "locking-service:"

# ...or a sentinel setup (host/port and sentinels/name are mutually exclusive)
# redis:
#   sentinels:
#     - host: sentinel-1
#       port: 26379
#   name: mymaster
```

Every string value may reference an environment variable using `${env.VAR}`; an unset variable is
a startup error:

```yaml
redis:
  host: ${env.REDIS_HOST}
```

Unknown `app` or `redis` keys are rejected, as are invalid combinations such as `host` together
with `sentinels`.

## API

| Method   | Path          | Description                                                   |
| -------- | ------------- | ------------------------------------------------------------- |
| `GET`    | `/`           | Service name and version as a pretty printed JSON document.   |
| `GET`    | `/health`     | Plain text health probe, always `Service operating normally.` |
| `POST`   | `/locks`      | Create a lock, `409` when the key is already locked.          |
| `GET`    | `/locks`      | List all active locks.                                        |
| `GET`    | `/locks/:key` | Read a single lock, `404` when it does not exist.             |
| `DELETE` | `/locks/:key` | Remove a lock, `200` whether or not it existed.               |
| `GET`    | `/api`        | Swagger UI.                                                   |
| `GET`    | `/api-json`   | Generated OpenAPI document.                                   |

Creating a lock takes a timestring `duration`, the response contains the parsed duration in
seconds:

```bash
curl -X POST http://127.0.0.1:3000/locks \
  -H 'Content-Type: application/json' \
  -d '{"key":"lock-a","owner":"alice","duration":"1m"}'
```

```json
{
  "key": "lock-a",
  "owner": "alice",
  "duration": 60,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "expireAt": "2026-01-01T00:01:00.000Z"
}
```

## Running the app

```bash
# development / watch mode
$ pnpm run dev

# build for production
$ pnpm run build

# production mode (after build)
$ pnpm run start
```

## Test

```bash
# run tests (vitest)
$ pnpm run test

# watch tests
$ pnpm run test:watch

# test coverage
$ pnpm run test:coverage
```

## Lint & Format

```bash
# run eslint
$ pnpm run lint

# run prettier formatting
$ pnpm run format

# typecheck
$ pnpm run typecheck
```

[renovate-shield]: https://img.shields.io/badge/renovate-enabled-brightgreen?logo=renovate&logoColor=308BE3
[renovate-url]: https://www.mend.io/renovate/
[fastify-shield]: https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white
[fastify-url]: https://fastify.dev/
[zod-shield]: https://img.shields.io/badge/Zod-3.x-3068b7?logo=zod&logoColor=white
[zod-url]: https://zod.dev/
[typescript-shield]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript
[typescript-url]: https://www.typescriptlang.org/
