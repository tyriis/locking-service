import { describe, expect, it } from "vitest"
import { RedisClient, RedisLockRepository } from "./repository.js"
import { Lock } from "./schema.js"

/**
 * Minimal stand-in for ioredis: `keyPrefix` is applied to get/set/del/mget but
 * not to the keys returned by SCAN, which is the behaviour we have to survive.
 */
class PrefixedFakeRedis implements RedisClient {
  private readonly store = new Map<string, string>()

  constructor(private readonly prefix: string) {}

  private prefixed(key: string): string {
    return `${this.prefix}${key}`
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(this.prefixed(key)) ?? null)
  }

  set(key: string, value: string): Promise<"OK"> {
    this.store.set(this.prefixed(key), value)
    return Promise.resolve<"OK">("OK")
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(this.prefixed(key)) ? 1 : 0)
  }

  scan(
    _cursor: string,
    _matchKeyword: "MATCH",
    pattern: string,
    _countKeyword: "COUNT",
    _count: number
  ): Promise<[string, string[]]> {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
    const matcher = new RegExp(`^${escaped}$`)
    return Promise.resolve<[string, string[]]>([
      "0",
      [...this.store.keys()].filter((key) => matcher.test(key)),
    ])
  }

  mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.resolve(keys.map((key) => this.store.get(this.prefixed(key)) ?? null))
  }
}

const lock: Lock = {
  key: "lock-a",
  owner: "alice",
  duration: 60,
  createdAt: "2026-01-01T00:00:00.000Z",
  expireAt: "2026-01-01T00:01:00.000Z",
}

describe("RedisLockRepository", () => {
  it("round-trips a lock without a key prefix", async () => {
    const repository = new RedisLockRepository(new PrefixedFakeRedis(""))
    await repository.set(lock.key, lock, lock.duration)
    expect(await repository.get(lock.key)).toEqual(lock)
    expect(await repository.getAll("")).toEqual([lock])
    await repository.delete(lock.key)
    expect(await repository.get(lock.key)).toBeNull()
  })

  it("lists locks when the client applies a keyPrefix", async () => {
    // ioredis prefixes get/set/del/mget but not the keys returned by SCAN, so
    // a naive mget(scanResult) doubles the prefix and silently returns [].
    const repository = new RedisLockRepository(new PrefixedFakeRedis("testlock:"))
    await repository.set(lock.key, lock, lock.duration)

    expect(await repository.get(lock.key)).toEqual(lock)
    expect(await repository.getAll("testlock:")).toEqual([lock])
  })
})
