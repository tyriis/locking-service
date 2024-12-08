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

[![taskfile][taskfile-shield]][taskfile-url]
[![pre-commit][pre-commit-shield]][pre-commit-url]
[![renovate][renovate-shield]][renovate-url]
[![NestJS][nestjs-shield]][nestjs-url]
[![TypeScript][typescript-shield]][typescript-url]

# locking-service

REST API service built with NestJS that provides distributed locking capabilities using Redis as backend.

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

You can pass `CONFIG_PATH` env variable to point to your `configuration.yaml`. Default path is `$(XDG_CONFIG_HOME)/locking-service/configuration.yaml`

You can use env variables as placeholder in the configuration.yaml

```yaml
---
app:
  port: 3000
  host: 0.0.0.0

redis:
  host: ${env.REDIS_HOST}
  port: 6379
  keyPrefix: locking-service.
  # sentinels:
  #   - host: ${env.REDIS_HOST}
  #     port: 26379
  # name: redis-master
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Lint

```bash
# run eslint
$ pnpm run lint
```

[taskfile-shield]: https://img.shields.io/badge/Taskfile-enabled-brightgreen?logo=task
[taskfile-url]: https://taskfile.dev/
[pre-commit-shield]: https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit
[pre-commit-url]: https://github.com/pre-commit/pre-commit
[renovate-shield]: https://img.shields.io/badge/renovate-enabled-brightgreen?logo=renovate&logoColor=308BE3
[renovate-url]: https://www.mend.io/renovate/
[nestjs-shield]: https://img.shields.io/badge/NestJS-10.4.13-E0234E?logo=nestjs&logoColor=E0234E
[nestjs-url]: https://nestjs.com/
[typescript-shield]: https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript
[typescript-url]: https://www.typescriptlang.org/
