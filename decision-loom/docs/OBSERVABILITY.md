# Observability & Telemetry

This document describes the observability stack for Decision Loom.

## Overview

The observability setup follows the **three pillars** approach:

- **Logs**: Structured JSON logs via Pino
- **Traces**: Distributed tracing via OpenTelemetry
- **LLM Observability**: Prompt/response tracking via Langfuse

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Decision Loom                            │
├─────────────────────────────────────────────────────────────────┤
│  API Routes                                                     │
│  ├── Structured logs (pino) ──────────────► Grafana Loki       │
│  ├── Request traces (OTEL) ───────────────► Grafana Tempo      │
│  └── LLM calls                                                  │
│       ├── Spans (OTEL) ───────────────────► Grafana Tempo      │
│       └── Generations (Langfuse) ─────────► Langfuse Cloud     │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Structured Logging (works out of the box)

Logs are automatically pretty-printed in development and output as JSON in production.

```bash
# Set log level (default: debug in dev, info in prod)
LOG_LEVEL=debug
```

### 2. OpenTelemetry Tracing (optional)

To enable distributed tracing, set the OTLP endpoint:

```bash
# Export traces to Grafana Tempo, Jaeger, or any OTLP-compatible backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=decision-loom
```

### 3. Langfuse LLM Observability (optional)

To track LLM prompts, responses, token usage, and costs:

```bash
# Sign up at https://cloud.langfuse.com or self-host
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

## Components

### Structured Logger (`src/lib/logger.ts`)

Pino-based logger with:
- JSON output in production (for log aggregators)
- Pretty output in development
- Automatic redaction of sensitive fields (auth headers, API keys, prompts in prod)

**Usage in API routes:**

```typescript
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "my-route", ip });

  log.info({ event: "my-route.start" });
  // ... do work
  log.info({ event: "my-route.success", durationMs: 123 });
}
```

### Request ID (`src/lib/request-id.ts`)

Generates and propagates correlation IDs:
- Accepts `x-request-id` header from client
- Generates new ID if not provided
- Returns ID in response headers

### OpenTelemetry (`src/lib/telemetry.ts`)

Auto-instrumentation for:
- HTTP requests
- Prisma/database calls
- Custom LLM spans

Initialized via Next.js instrumentation hook (`src/instrumentation.ts`).

### LLM Client (`src/server/llm/client.ts`)

All LLM calls are instrumented with:
- **Structured logs**: start/end/error events with timing
- **OpenTelemetry spans**: `llm.generateCompletion`, `llm.generateCompletionStream`, etc.
- **Langfuse generations**: prompt/response capture, token usage, model metadata

## Log Events Reference

All log events follow the pattern: `{route}.{stage}` or `llm.{action}`

### Route Events

| Event | Description |
|-------|-------------|
| `{route}.start` | Request received |
| `{route}.llm.start` | LLM call initiated |
| `{route}.llm.done` | LLM call completed |
| `{route}.success` | Request completed successfully |
| `{route}.error` | Request failed |

### LLM Events

| Event | Description |
|-------|-------------|
| `llm.request.start` | Non-streaming LLM call started |
| `llm.request.end` | Non-streaming LLM call completed |
| `llm.request.error` | LLM call failed |
| `llm.stream.start` | Streaming LLM call started |
| `llm.stream.end` | Streaming completed |
| `llm.stream.error` | Streaming failed |

## Span Attributes

OpenTelemetry spans include:

| Attribute | Description |
|-----------|-------------|
| `request.id` | Correlation ID |
| `llm.model` | Model name (e.g., `anthropic/claude-3.5-sonnet`) |
| `llm.max_tokens` | Max tokens requested |
| `llm.duration_ms` | Call duration |
| `llm.output_length` | Response character count |
| `llm.prompt_tokens` | Prompt token count (if available) |
| `llm.completion_tokens` | Completion token count (if available) |
| `llm.streaming` | Whether streaming was used |

## Recommended External Tools

### For General Telemetry

**Grafana Cloud** (recommended):
- Loki for logs
- Tempo for traces
- Prometheus/Mimir for metrics
- Single UI for all three

**Alternatives:**
- Sentry (great for errors + performance)
- Datadog / New Relic (enterprise)
- Axiom (hosted log analytics)

### For LLM Observability

**Langfuse** (recommended):
- Prompt/response tracking
- Token usage and cost analytics
- Model comparison
- Session-based traces

## Debugging Tips

### Find a stuck request

1. Get the `x-request-id` from the response headers or client logs
2. Search logs: `grep "req_abc123" logs.json`
3. In Grafana: filter by `requestId="req_abc123"`
4. In Langfuse: search by trace ID

### Check LLM latency

Look for `llm.request.end` or `llm.stream.end` events with `durationMs`:

```json
{"event":"llm.request.end","durationMs":45230,"model":"anthropic/claude-3.5-sonnet"}
```

### Identify timeout issues

Search for events with `error` containing "timeout":

```bash
grep -i timeout logs.json | jq '.requestId, .error'
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `debug` (dev) / `info` (prod) | Logging verbosity |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OTLP endpoint for traces |
| `OTEL_SERVICE_NAME` | No | `decision-loom` | Service name in traces |
| `LANGFUSE_PUBLIC_KEY` | No | - | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | No | - | Langfuse secret key |
| `LANGFUSE_BASE_URL` | No | `https://cloud.langfuse.com` | Langfuse API URL |
| `OPENROUTER_TIMEOUT_MS` | No | `120000` | LLM call timeout |
| `OPENROUTER_MAX_RETRIES` | No | `0` | LLM call retry count |
