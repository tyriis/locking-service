import { describe, it, expect, vi } from 'vitest'
import { LockService } from './service.js'
import { LockRepository } from './repository.js'
import { ConflictError, NotFoundError } from '../errors.js'
import { Lock } from './schema.js'

describe('LockService', () => {
  const mockRepo = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
  } as unknown as LockRepository

  const service = new LockService(mockRepo, 'prefix:')

  it('creates a lock if it does not exist', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce(null)
    const lock = await service.create({ key: 'a', owner: 'b', duration: '10s' })
    expect(lock.key).toBe('a')
    expect(mockRepo.set).toHaveBeenCalled()
  })

  it('throws ConflictError if lock exists', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce({} as Lock)
    await expect(service.create({ key: 'a', owner: 'b', duration: '10s' })).rejects.toThrow(
      ConflictError
    )
  })

  it('finds one lock', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce({ key: 'a' } as Lock)
    const lock = await service.findOne('a')
    expect(lock.key).toBe('a')
  })

  it('throws NotFoundError if lock not found', async () => {
    vi.mocked(mockRepo.get).mockResolvedValueOnce(null)
    await expect(service.findOne('b')).rejects.toThrow(NotFoundError)
  })

  it('removes a lock', async () => {
    vi.mocked(mockRepo.delete).mockResolvedValueOnce(undefined)
    const result = await service.remove('a')
    expect(result).toBeNull()
    expect(mockRepo.delete).toHaveBeenCalledWith('a')
  })

  it('finds all locks', async () => {
    vi.mocked(mockRepo.getAll).mockResolvedValueOnce([{ key: 'a' } as Lock])
    const result = await service.findAll()
    expect(result).toEqual([{ key: 'a' }])
    expect(mockRepo.getAll).toHaveBeenCalledWith('prefix:')
  })
})
