import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const OTEL_EXPORTER_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "decision-loom";
const SERVICE_VERSION = process.env.npm_package_version || "0.1.0";

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK.
 * Call this once at app startup (e.g., in instrumentation.ts or a custom server).
 * 
 * Exports traces to OTLP endpoint (Grafana Tempo, Jaeger, etc.)
 */
export function initTelemetry() {
  if (sdk) {
    return; // Already initialized
  }

  if (!OTEL_EXPORTER_ENDPOINT) {
    console.warn(
      "[telemetry] OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled"
    );
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_EXPORTER_ENDPOINT}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some noisy instrumentations
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(`[telemetry] OpenTelemetry initialized, exporting to ${OTEL_EXPORTER_ENDPOINT}`);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    sdk
      ?.shutdown()
      .then(() => console.log("[telemetry] SDK shut down"))
      .catch((err) => console.error("[telemetry] Error shutting down SDK", err))
      .finally(() => process.exit(0));
  });
}

/**
 * Get the current trace/span context for manual instrumentation.
 */
export { trace, context, SpanStatusCode } from "@opentelemetry/api";
