import fs from "node:fs"
import os from "node:os"
import YAML from "yaml"
import { z } from "zod"

export const NODE_ENVS = ["development", "production", "test"] as const

const portSchema = z.coerce.number().int().min(0).max(65535)

// YAML may hand us booleans already; quoted values are coerced like Joi did.
const booleanSchema = z.preprocess((value) => {
  if (value === "true") return true
  if (value === "false") return false
  return value
}, z.boolean())

const redisSentinelSchema = z
  .object({
    host: z.string(),
    port: portSchema.default(26379),
  })
  .strict()

const redisConfigSchema = z
  .object({
    host: z.string().optional(),
    port: portSchema.optional(),
    keyPrefix: z.string().default(""),
    sentinels: z.array(redisSentinelSchema).optional(),
    name: z.string().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasHost = !!data.host
      const hasSentinels = !!data.sentinels && data.sentinels.length > 0
      const hasName = !!data.name

      if (hasSentinels) {
        return hasName && !hasHost
      }
      return hasHost && !hasName && !hasSentinels
    },
    {
      message: "Redis config must provide either host/port or sentinels/name",
    }
  )

const appConfigSchema = z
  .object({
    host: z.string().default("127.0.0.1"),
    port: portSchema.default(3000),
    pretty: booleanSchema.default(false),
  })
  .strict()

export const configSchema = z.object({
  app: appConfigSchema.prefault({}),
  redis: redisConfigSchema,
})

export type Config = z.infer<typeof configSchema>

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS, {
    error: `"NODE_ENV" must be one of [${NODE_ENVS.join(", ")}]`,
  }),
  CONFIG_PATH: z.string().optional(),
})

const formatIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => {
      const path = issue.path.join(".")
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join(", ")

/**
 * Replace every `${env.VAR}` placeholder with the matching environment variable.
 * Mirrors the loader of the previous implementation: a missing or empty variable
 * is a hard error.
 */
export const replaceEnvVars = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.replace(/\$\{env\.(.*?)}/g, (_match, envVar: string): string => {
      const env = process.env[envVar]
      if (!env) {
        throw new Error(`Environment variable ${envVar} is not set!`)
      }
      return env
    })
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceEnvVars(item))
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      result[key] = replaceEnvVars(nested)
    }
    return result
  }

  return value
}

export function loadConfig(): Config {
  const env = envSchema.safeParse(process.env)
  if (!env.success) {
    throw new Error(`Config validation error: ${formatIssues(env.error.issues)}`)
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME ?? `${os.homedir()}/.config`
  const CONFIG_PATH = env.data.CONFIG_PATH ?? `${xdgConfig}/locking-service/configuration.yaml`

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`${CONFIG_PATH} is not a file! Please create it or set CONFIG_PATH.`)
  }

  const rawConfig: unknown = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  const configWithEnv = replaceEnvVars(rawConfig)

  const result = configSchema.safeParse(configWithEnv)
  if (!result.success) {
    throw new Error(`Config validation error: ${formatIssues(result.error.issues)}`)
  }

  return result.data
}
