import { FastifyInstance, FastifyPluginAsync } from "fastify"
import { serviceIdentifier } from "./identifier.js"

/**
 * `/` answers with an already serialized (pretty printed) JSON document, and
 * `/health` with plain text, exactly like the previous implementation.
 */
export const appRoutes = (): FastifyPluginAsync => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (fastify: FastifyInstance) => {
    fastify.get("/", async (_request, reply) => {
      return reply
        .header("content-type", "application/json; charset=utf-8")
        .send(serviceIdentifier())
    })

    fastify.get("/health", async (_request, reply) => {
      return reply
        .header("content-type", "text/plain; charset=utf-8")
        .send("Service operating normally.")
    })
  }
}
