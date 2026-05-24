import { describe, it, expect } from 'vitest'
import { createLockSchema, lockSchema } from './schema.ts'

describe('Lock Schemas', () => {
  it('validates CreateLock input', () => {
    const input = { key: 'test-lock', owner: 'user-1', duration: '1h' }
    const result = createLockSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('fails CreateLock on invalid duration type', () => {
    const input = { key: 'test-lock', owner: 'user-1', duration: 3600 }
    const result = createLockSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('validates Lock object', () => {
    const lock = {
      key: 'test',
      owner: 'user',
      duration: '10m',
      createdAt: new Date().toISOString(),
      expireAt: new Date(Date.now() + 600000).toISOString()
    }
    const result = lockSchema.safeParse(lock)
    expect(result.success).toBe(true)
  })
})