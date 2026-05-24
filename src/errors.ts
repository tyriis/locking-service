export class DomainError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message)
    this.name = 'DomainError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}
