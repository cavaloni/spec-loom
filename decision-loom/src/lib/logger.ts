import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Structured logger for server-side use.
 * - JSON output in production (for log aggregators like Grafana Loki)
 * - Pretty output in development
 * - Redacts sensitive fields by default
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "apiKey",
      "password",
      "secret",
      "token",
      // Redact prompt/response content by default in prod
      ...(isDev ? [] : ["prompt", "response", "systemPrompt", "userPrompt"]),
    ],
    censor: "[REDACTED]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

/**
 * Create a child logger with request context (requestId, route, etc.)
 */
export function createRequestLogger(context: {
  requestId: string;
  route?: string;
  ip?: string;
  sessionId?: string;
}) {
  return logger.child(context);
}

export type Logger = typeof logger;
