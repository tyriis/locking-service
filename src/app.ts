import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import Redis from 'ioredis'
import { loadConfig } from './config.js'
import { RedisLockRepository } from './locks/repository.js'
import { LockService } from './locks/service.js'
import { lockRoutes } from './locks/routes.js'
import { DomainError } from './errors.js'

export function buildApp() {
  const config = loadConfig()
  
  const app = Fastify({
    logger: true
  })

  // Add Zod Compilers
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Error Handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      app.log.warn(error)
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name.replace('Error', ''),
        message: error.message
      })
    }
    
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message
      })
    }

    app.log.error(error)
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    })
  })

  const redis = new Redis(config.REDIS_URL)
  const lockRepo = new RedisLockRepository(redis)
  const lockService = new LockService(lockRepo, config.REDIS_KEY_PREFIX)

  app.register(lockRoutes({ lockService }))

  app.addHook('onClose', async (instance) => {
    await redis.quit()
  })

  return { app, config }
}
