import { z } from 'zod'

export const configSchema = z.object({
  PORT: z.string().default('3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default(''),
})

export type Config = z.infer<typeof configSchema>

export function loadConfig(): Config {
  return configSchema.parse(process.env)
}
