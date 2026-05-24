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
    const keys = await this.redis.keys(`${prefix}*`)
    if (keys.length === 0) return []
    
    // remove prefix for internal querying if your system needs it, 
    // but in vanilla ioredis you fetch with the literal key found.
    const values = await this.redis.mget(keys)
    
    return values
      .filter((v): v is string => v !== null)
      .map(v => {
        try {
          return JSON.parse(v) as Lock
        } catch (e) {
          return null
        }
      })
      .filter((v): v is Lock => v !== null)
  }
}
