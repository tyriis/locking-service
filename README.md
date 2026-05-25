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

The service is configured exclusively via environment variables (validated using Zod at startup):

- `PORT` (default: `3000`)
- `REDIS_URL` (default: `redis://localhost:6379`)
- `REDIS_KEY_PREFIX` (default: `""` / empty string)

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
[fastify-shield]: https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify&logoColor=white
[fastify-url]: https://fastify.dev/
[zod-shield]: https://img.shields.io/badge/Zod-3.x-3068b7?logo=zod&logoColor=white
[zod-url]: https://zod.dev/
[typescript-shield]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript
[typescript-url]: https://www.typescriptlang.org/
