import { z } from 'zod'

export const createLockSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  owner: z.string().min(1, 'Owner is required'),
  duration: z.string().min(1, 'Duration is required'),
})

export type CreateLockInput = z.infer<typeof createLockSchema>

export const lockSchema = z.object({
  key: z.string(),
  owner: z.string(),
  duration: z.string(),
  createdAt: z.string().datetime(),
  expireAt: z.string().datetime(),
})

export type Lock = z.infer<typeof lockSchema>
