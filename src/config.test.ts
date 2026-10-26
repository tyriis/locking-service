import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadConfig } from "./config.js"

const written: string[] = []

const writeConfig = (content: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "locking-service-"))
  const file = path.join(dir, "configuration.yaml")
  fs.writeFileSync(file, content)
  written.push(dir)
  return file
}

afterEach(() => {
  for (const dir of written.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  delete process.env.LOCKING_SERVICE_TEST_VALUE
})

const withConfig = <T>(content: string, fn: () => T): T => {
  process.env.CONFIG_PATH = writeConfig(content)
  try {
    return fn()
  } finally {
    delete process.env.CONFIG_PATH
  }
}

describe("loadConfig", () => {
  it("applies the documented defaults", () => {
    const config = withConfig("redis:\n  host: 127.0.0.1\n  port: 6379\n", () => loadConfig())
    expect(config.app).toEqual({ host: "127.0.0.1", port: 3000, pretty: false })
    expect(config.redis.host).toBe("127.0.0.1")
    expect(config.redis.port).toBe(6379)
    expect(config.redis.keyPrefix).toBe("")
  })

  it("coerces the port from a numeric string", () => {
    const config = withConfig("app:\n  port: '4000'\nredis:\n  host: 127.0.0.1\n", () =>
      loadConfig()
    )
    expect(config.app.port).toBe(4000)
  })

  it("rejects unknown app keys", () => {
    expect(() =>
      withConfig("app:\n  port: 3000\n  bogus: true\nredis:\n  host: 127.0.0.1\n", () =>
        loadConfig()
      )
    ).toThrow(/Config validation error/)
  })

  it("substitutes environment variables", () => {
    process.env.LOCKING_SERVICE_TEST_VALUE = "redis.internal"
    const config = withConfig(
      "redis:\n  host: ${env.LOCKING_SERVICE_TEST_VALUE}\n  keyPrefix: '${env.LOCKING_SERVICE_TEST_VALUE}:'\n",
      () => loadConfig()
    )
    expect(config.redis.host).toBe("redis.internal")
    expect(config.redis.keyPrefix).toBe("redis.internal:")
  })

  it("fails on an unset environment variable", () => {
    expect(() =>
      withConfig("redis:\n  host: ${env.LOCKING_SERVICE_MISSING}\n", () => loadConfig())
    ).toThrow(/Environment variable LOCKING_SERVICE_MISSING is not set!/)
  })

  it("requires either host or sentinels plus a name", () => {
    expect(() => withConfig("redis:\n  port: 6379\n", () => loadConfig())).toThrow(
      /Redis config must provide either host\/port or sentinels\/name/
    )

    expect(() =>
      withConfig("redis:\n  sentinels:\n    - host: 10.0.0.1\n", () => loadConfig())
    ).toThrow(/Redis config must provide either host\/port or sentinels\/name/)

    expect(() =>
      withConfig(
        "redis:\n  host: 127.0.0.1\n  sentinels:\n    - host: 10.0.0.1\n  name: mymaster\n",
        () => loadConfig()
      )
    ).toThrow(/Redis config must provide either host\/port or sentinels\/name/)

    const sentinel = withConfig(
      "redis:\n  sentinels:\n    - host: 10.0.0.1\n  name: mymaster\n",
      () => loadConfig()
    )
    expect(sentinel.redis.sentinels).toEqual([{ host: "10.0.0.1", port: 26379 }])
    expect(sentinel.redis.name).toBe("mymaster")
  })

  it("rejects an invalid NODE_ENV", () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = "staging"
    try {
      expect(() => withConfig("redis:\n  host: 127.0.0.1\n", () => loadConfig())).toThrow(
        /NODE_ENV/
      )
    } finally {
      process.env.NODE_ENV = original
    }
  })

  it("fails when the configuration file is missing", () => {
    process.env.CONFIG_PATH = path.join(os.tmpdir(), "locking-service-does-not-exist.yaml")
    try {
      expect(() => loadConfig()).toThrow(/is not a file!/)
    } finally {
      delete process.env.CONFIG_PATH
    }
  })
})
