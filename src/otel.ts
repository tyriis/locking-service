import { NodeSDK } from "@opentelemetry/sdk-node"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"

export const sdk = new NodeSDK({
  instrumentations: [new HttpInstrumentation()],
})

sdk.start()
