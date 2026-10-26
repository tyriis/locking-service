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
  try {
    await sdk.shutdown()
  } catch (error) {
    // The OTLP exporter is unavailable in most deployments; a failed flush
    // must not turn a controlled shutdown into a crash.
    app.log.warn({ err: error }, "OpenTelemetry shutdown failed")
  }
  process.exit(0)
}

process.on("SIGTERM", () => void gracefulShutdown())
process.on("SIGINT", () => void gracefulShutdown())

void start()
