import { NextRequest } from "next/server";

/**
 * Generate a unique request ID (UUID v4 style, but shorter for logs)
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract or generate a request ID from incoming request headers.
 * Checks x-request-id header first, then generates a new one.
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || generateRequestId();
}

/**
 * Client-side: generate a request ID for outgoing fetches
 */
export function createClientRequestId(): string {
  return generateRequestId();
}
