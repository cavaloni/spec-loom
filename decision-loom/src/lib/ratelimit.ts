import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let suggestLimiter: Ratelimit | null = null;
let summarizeLimiter: Ratelimit | null = null;
let generateLimiter: Ratelimit | null = null;

function initRateLimiters() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return;
  }

  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  suggestLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:suggest",
  });

  summarizeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:summarize",
  });

  generateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:generate",
  });
}

initRateLimiters();

export async function checkRateLimit(
  type: "suggest" | "summarize" | "generate",
  identifier: string
): Promise<{ success: boolean; remaining: number }> {
  const limiter =
    type === "suggest"
      ? suggestLimiter
      : type === "summarize"
        ? summarizeLimiter
        : generateLimiter;

  if (!limiter) {
    return { success: true, remaining: -1 };
  }

  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
