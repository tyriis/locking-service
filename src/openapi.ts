/**
 * Response documentation the route schemas cannot express.
 *
 * Every response schema declared on a route is compiled into a serializer by
 * the Zod serializer compiler, so a status code that only needs a description
 * (or an `example` body) cannot be declared there. The previous implementation
 * documented those status codes anyway, and the OpenAPI document is part of the
 * published contract, so they are added to the generated document instead.
 */

interface MediaTypeObject {
  schema?: Record<string, unknown>
}

interface ResponseObject {
  description?: string
  content?: Record<string, MediaTypeObject>
}

interface OperationObject {
  responses?: Record<string, ResponseObject>
}

interface PathItemObject {
  get?: OperationObject
  post?: OperationObject
  put?: OperationObject
  delete?: OperationObject
}

interface OpenApiDocument {
  paths?: Record<string, PathItemObject | undefined>
}

const notFoundExample = {
  statusCode: 404,
  error: "Not Found",
  message: "lock 'some-fancy-lock.name' not found",
}

const conflictExample = {
  statusCode: 409,
  message: "lock 'some-fancy-lock.name' already aquired!",
}

const validationExample = {
  message: ["key must be longer than or equal to 3 characters"],
  error: "Bad Request",
  statusCode: 400,
}

const exampleContent = (example: Record<string, unknown>): Record<string, MediaTypeObject> => ({
  "application/json": { schema: { example } },
})

const described = (description: string): ResponseObject => ({ description })

/**
 * Add the response documentation of the previous implementation to a generated
 * OpenAPI document. Mutates and returns the given document.
 */
export const documentContractResponses = <Document>(document: Document): Document => {
  const { paths } = document as OpenApiDocument

  const identifier = paths?.["/"]?.get?.responses?.["200"]
  if (identifier) {
    identifier.content = { "application/json": { schema: { type: "string" } } }
  }

  const health = paths?.["/health"]?.get?.responses?.["200"]
  if (health) {
    health.content = { "text/plain": { schema: { type: "string" } } }
  }

  const create = paths?.["/locks"]?.post?.responses
  if (create) {
    create["400"] = described("Input validation failed")
    create["409"] = {
      description: "A lock with given `key` already exists.",
      content: exampleContent(conflictExample),
    }
    create["500"] = described("Internal server error")
  }

  const findOne = paths?.["/locks/{key}"]?.get?.responses
  if (findOne) {
    findOne["400"] = {
      description: "Input validation failed",
      content: exampleContent(validationExample),
    }
    findOne["404"] = {
      description: "Lock with given key not found",
      content: exampleContent(notFoundExample),
    }
    findOne["500"] = described("Internal server error")
  }

  return document
}
