import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { LockService } from './service.js'
import { createLockSchema, lockSchema } from './schema.js'

interface RouteOptions {
  lockService: LockService
}

export const lockRoutes = (options: RouteOptions): FastifyPluginAsync => {
  return async (fastify: FastifyInstance) => {
    const app = fastify.withTypeProvider<ZodTypeProvider>()

    app.post('/locks', {
      schema: {
        body: createLockSchema,
        response: {
          201: lockSchema
        }
      }
    }, async (request, reply) => {
      const lock = await options.lockService.create(request.body)
      return reply.code(201).send(lock)
    })

    app.get('/locks', {
      schema: {
        response: {
          200: z.array(lockSchema)
        }
      }
    }, async (request, reply) => {
      const locks = await options.lockService.findAll()
      return reply.send(locks)
    })

    app.get('/locks/:key', {
      schema: {
        params: z.object({ key: z.string() }),
        response: {
          200: lockSchema
        }
      }
    }, async (request, reply) => {
      const lock = await options.lockService.findOne(request.params.key)
      return reply.send(lock)
    })

    app.delete('/locks/:key', {
      schema: {
        params: z.object({ key: z.string() }),
        response: {
          204: z.null()
        }
      }
    }, async (request, reply) => {
      await options.lockService.remove(request.params.key)
      return reply.code(204).send(null)
    })
  }
}
