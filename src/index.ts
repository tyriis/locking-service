import { sdk } from "./otel.js"
import { buildApp } from "./app.js"

const { app, config } = buildApp()

const start = async (): Promise<void> => {
  try {
    const port = config.app.port
    await app.listen({ port, host: config.app.host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const gracefulShutdown = async (): Promise<void> => {
  app.log.info("Graceful shutdown signal received")
  await app.close()
  await sdk.shutdown()
  process.exit(0)
}

process.on("SIGTERM", () => void gracefulShutdown())
process.on("SIGINT", () => void gracefulShutdown())

void start()
