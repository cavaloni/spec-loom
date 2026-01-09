import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z
    .string()
    .url()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL_SUGGEST: z.string().default("anthropic/claude-3.5-sonnet"),
  OPENROUTER_MODEL_SUMMARY: z.string().default("anthropic/claude-3.5-sonnet"),
  OPENROUTER_MODEL_GENERATE: z.string().default("anthropic/claude-3.5-sonnet"),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = getEnv();
