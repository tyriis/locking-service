import { z } from "zod"

/**
 * Request body schema. Used for validation and for the generated OpenAPI
 * document, which must keep documenting `duration` as a timestring.
 *
 * `owner` is required to be non empty (like the `@IsNotEmpty()` of the previous
 * implementation) but must not be documented with a `minLength`, which the
 * published contract never had. A refinement is not expressible in JSON Schema,
 * so it validates without leaking into the document.
 */
export const createLockSchema = z.object({
  key: z.string().min(3).describe("The lock key/identifier"),
  owner: z
    .string()
    .describe("The owner of the lock")
    .refine((value) => value.length > 0),
  duration: z.string().min(2).describe("The lock duration as timestring"),
})

export type CreateLockInput = z.infer<typeof createLockSchema>

/**
 * Lock resource. `duration` is the parsed timestring in seconds, exactly like
 * the previous implementation returned it.
 */
export const lockSchema = z.object({
  key: z.string().describe("The lock key/identifier"),
  owner: z.string().describe("The owner of the lock"),
  duration: z.number().describe("The lock duration in seconds"),
  createdAt: z.string().datetime().describe("The lock creation as Date string"),
  expireAt: z.string().datetime().describe("The lock expire as Date string"),
})

export type Lock = z.infer<typeof lockSchema>

interface FieldRule {
  name: "key" | "owner" | "duration"
  minLength?: number
}

const createLockRules: readonly FieldRule[] = [
  { name: "key", minLength: 3 },
  { name: "owner" },
  { name: "duration", minLength: 2 },
]

/**
 * Reproduce class-validator's messages, field order and constraint order
 * (minLength, notEmpty, isString) for a failed CreateLockDto validation.
 */
export const createLockValidationMessages = (body: unknown): string[] => {
  const input: Record<string, unknown> =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}

  const messages: string[] = []

  for (const rule of createLockRules) {
    const value = input[rule.name]
    const missing = value === undefined || value === null
    const isString = typeof value === "string"

    if (rule.minLength !== undefined) {
      if (missing || typeof value !== "string" || value.length < rule.minLength) {
        messages.push(`${rule.name} must be longer than or equal to ${rule.minLength} characters`)
      }
    }

    if (missing || value === "") {
      messages.push(`${rule.name} should not be empty`)
    }

    if (!isString) {
      messages.push(`${rule.name} must be a string`)
    }
  }

  return messages
}
