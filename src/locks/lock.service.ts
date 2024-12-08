import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { CreateLockDto, ILock } from "src/locks"
import { RedisService, DEFAULT_REDIS } from "@liaoliaots/nestjs-redis"
import Redis from "ioredis"
import * as timestring from "timestring"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name)
  private readonly redis: Redis

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getOrThrow(DEFAULT_REDIS)
    if (this.redis === null) {
      this.logger.error("Redis connection is not available")
    }
  }

  /**
   * Create a new lock based on `createLock` input data
   * @throws {Error} On any error
   * @param {CreateLockDto} createLock An object containing the lock data
   * @returns {Promise<ILock>} Async new lock resource
   */
  async create(createLock: CreateLockDto): Promise<ILock> {
    const result: string | null = await this.redis.get(createLock.key)
    if (result !== null) {
      throw new ConflictException({
        statusCode: 409,
        message: `lock '${createLock.key}' already aquired`,
      })
    }
    const duration = timestring(createLock.duration ?? "unknown")
    const createdAt = new Date()
    const expireAt = new Date(createdAt.getTime() + duration * 1000)
    const lock: ILock = {
      key: createLock.key,
      owner: createLock.owner,
      duration,
      createdAt,
      expireAt,
    }
    await this.redis.set(createLock.key, JSON.stringify(lock), "EX", lock.duration)
    return lock
  }

  /**
   * Find a lock by its `key`
   * @throws {Error} On any error
   * @param {string} key The `key` of the lock
   * @returns {Promise<ILock>} The lock with `id`
   */
  async findOne(key: string): Promise<ILock> {
    const result: string | null = await this.redis.get(key)
    if (result === null) {
      throw new NotFoundException({
        statusCode: 404,
        message: `lock '${key}' not found`,
        error: "Not Found",
      })
    }
    const lock: ILock = JSON.parse(result)
    return lock
  }

  /**
   * Delete a lock by its `key`
   * @throws {Error} On any error
   * @param {string} key The `key` of the lock
   * @returns {Promise<null>} Return null no matter if lock has existed or not
   */
  async remove(key: string): Promise<null> {
    await this.redis.del(key)
    return null
  }

  /**
   * Find all active locks
   * @throws {Error} On any error
   * @returns {Promise<ILock[]>} Return the list of all active locks
   */
  async findAll(): Promise<ILock[]> {
    const prefix = this.configService.get<string>("redis.keyPrefix") ?? ""
    const keys = await this.redis.keys(`${prefix}*`)
    if (keys.length === 0) {
      return []
    }
    const values = await this.redis.mget(keys.map((key) => key.replace(prefix, "")))
    return values.map((item: string) => JSON.parse(item))
  }
}
