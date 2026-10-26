/**
 * Domain errors carry the exact payload the previous implementation sent, so
 * both the key order and the presence/absence of `error` stay byte identical.
 */
export abstract class DomainError extends Error {
  public readonly statusCode: number
  public readonly payload: Record<string, unknown>

  protected constructor(
    message: string,
    payload: Record<string, unknown> & { statusCode: number }
  ) {
    super(message)
    this.payload = payload
    this.statusCode = payload.statusCode
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: 409, message })
    this.name = "ConflictError"
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: 404, message, error: "Not Found" })
    this.name = "NotFoundError"
  }
}
