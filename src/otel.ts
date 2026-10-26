import { NodeSDK } from "@opentelemetry/sdk-node"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"

// This service has no collector of its own: telemetry stays inside the process
// unless an operator opts in through the standard OTEL_* variables.
// sdk-node >= 0.3x switches on its bundled OTLP exporters for every signal
// (traces, metrics, logs) when those variables are absent, which would make the
// service export to a localhost collector that does not exist. Each signal is
// therefore defaulted to "none"; setting e.g. OTEL_TRACES_EXPORTER=otlp (plus
// OTEL_EXPORTER_OTLP_ENDPOINT) re-enables the exporter without a code change.
process.env.OTEL_TRACES_EXPORTER ||= "none"
process.env.OTEL_METRICS_EXPORTER ||= "none"
process.env.OTEL_LOGS_EXPORTER ||= "none"

export const sdk = new NodeSDK({
  instrumentations: [new HttpInstrumentation()],
})

sdk.start()
