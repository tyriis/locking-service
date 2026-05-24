import Redis from 'ioredis'
import { Lock } from './schema.js'

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
    try {
      return JSON.parse(val) as Lock
    } catch (e) {
      return null
    }
  }

  async set(key: string, lock: Lock, durationSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(lock), 'EX', durationSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async getAll(prefix: string = ''): Promise<Lock[]> {
    let cursor = '0'
    const keys: string[] = []
    do {
      const [nextCursor, elements] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
      cursor = nextCursor
      keys.push(...elements)
    } while (cursor !== '0')

    if (keys.length === 0) return []
    
    // remove prefix for internal querying if your system needs it, 
    // but in vanilla ioredis you fetch with the literal key found.
    const values = await this.redis.mget(keys)
    
    return values
      .filter((v: string | null): v is string => v !== null)
      .map((v: string) => {
        try {
          return JSON.parse(v) as Lock
        } catch (e) {
          return null
        }
      })
      .filter((v: Lock | null): v is Lock => v !== null)
  }
}
