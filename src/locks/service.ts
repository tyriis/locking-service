import timestring from 'timestring'
import { LockRepository } from './repository.js'
import { CreateLockInput, Lock } from './schema.js'
import { ConflictError, NotFoundError } from '../errors.js'

export class LockService {
  constructor(
    private readonly repo: LockRepository,
    private readonly keyPrefix: string = ''
  ) {}

  async create(input: CreateLockInput): Promise<Lock> {
    const existing = await this.repo.get(input.key)
    if (existing) {
      throw new ConflictError(`lock '${input.key}' already aquired`)
    }

    const durationSeconds = timestring(input.duration)
    const createdAt = new Date()
    const expireAt = new Date(createdAt.getTime() + durationSeconds * 1000)

    const lock: Lock = {
      key: input.key,
      owner: input.owner,
      duration: input.duration,
      createdAt: createdAt.toISOString(),
      expireAt: expireAt.toISOString()
    }

    await this.repo.set(input.key, lock, durationSeconds)
    return lock
  }

  async findOne(key: string): Promise<Lock> {
    const lock = await this.repo.get(key)
    if (!lock) {
      throw new NotFoundError(`lock '${key}' not found`)
    }
    return lock
  }

  async remove(key: string): Promise<null> {
    await this.repo.delete(key)
    return null
  }

  async findAll(): Promise<Lock[]> {
    return this.repo.getAll(this.keyPrefix)
  }
}