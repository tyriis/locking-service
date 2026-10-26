import { Lock } from "./schema.js"

/**
 * The subset of the ioredis client used by the repository. Declared
 * structurally so tests can substitute an in-memory fake.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode: "EX", ttl: number): Promise<unknown>
  del(key: string): Promise<unknown>
  scan(
    cursor: string,
    matchKeyword: "MATCH",
    pattern: string,
    countKeyword: "COUNT",
    count: number
  ): Promise<[string, string[]]>
  mget(keys: string[]): Promise<(string | null)[]>
}

export interface LockRepository {
  get(key: string): Promise<Lock | null>
  set(key: string, lock: Lock, durationSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  getAll(prefix?: string): Promise<Lock[]>
}

export class RedisLockRepository implements LockRepository {
  constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<Lock | null> {
    const val = await this.redis.get(key)
    if (!val) return null
    return JSON.parse(val) as Lock
  }

  async set(key: string, lock: Lock, durationSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(lock), "EX", durationSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async getAll(prefix: string = ""): Promise<Lock[]> {
    let cursor = "0"
    const keys: string[] = []
    do {
      const [nextCursor, elements] = await this.redis.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100
      )
      cursor = nextCursor
      keys.push(...elements)
    } while (cursor !== "0")

    if (keys.length === 0) return []

    // ioredis prepends `keyPrefix` to get/set/del/mget but NOT to the keys
    // returned by SCAN, so the prefix has to be stripped before fetching.
    const values = await this.redis.mget(keys.map((key) => key.replace(prefix, "")))

    return values
      .filter((value: string | null): value is string => value !== null)
      .map((value: string) => JSON.parse(value) as Lock)
  }
}
