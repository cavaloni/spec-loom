import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const suggestSchema = z.object({
  prdContent: z.string(),
  questionKey: z.string(),
  currentAnswer: z.string(),
});

const QUESTION_CONTEXT: Record<string, { label: string; examples: string }> = {
  unit_of_work: {
    label: "Unit of Work",
    examples: "Examples: single API request, document upload cycle, user session, batch job, transaction",
  },
  scale_shape: {
    label: "Scale Shape",
    examples: "Examples: linear with users, bursty during events, steady 24/7, seasonal peaks",
  },
  latency_contract: {
    label: "Latency Contract",
    examples: "Examples: p50 < 100ms, p99 < 1s, batch jobs can take hours, real-time < 50ms",
  },
  data_volatility: {
    label: "Data Volatility",
    examples: "Examples: 95% reads, updates hourly, write-heavy, append-only, rarely changes",
  },
  correctness_risk: {
    label: "Correctness & Risk",
    examples: "Examples: financial requires ACID, analytics tolerates eventual consistency, idempotent operations",
  },
  cost_envelope: {
    label: "Cost Envelope",
    examples: "Examples: $500/month budget, cost per API call < $0.001, serverless to minimize idle costs",
  },
  privacy_compliance: {
    label: "Privacy & Compliance",
    examples: "Examples: GDPR for EU, HIPAA for health, SOC2, data residency requirements",
  },
  observability: {
    label: "Day-One Observability",
    examples: "Examples: error rates, latency percentiles, queue depths, business KPIs, alerting thresholds",
  },
};

function extractJsonFromLLMContent(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  return trimmed;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/suggest" });

  try {
    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { prdContent, questionKey, currentAnswer } = parsed.data;
    const context = QUESTION_CONTEXT[questionKey] || { label: questionKey, examples: "" };

    const systemPrompt = `You are a senior software architect helping to define architecture drivers.

Provide 2-3 specific, actionable suggestions for the "${context.label}" question.
${context.examples}

Each suggestion should be:
- Specific to the product described in the PRD
- Concrete and measurable where possible
- Different from each other (offer variety)

Return a JSON array of 2-3 suggestion strings.`;

    const userPrompt = `## PRD Summary
${prdContent.slice(0, 3000)}

## Question: ${context.label}
Current answer: ${currentAnswer || "(empty)"}

Provide 2-3 alternative suggestions as a JSON array:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

    const model = process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    log.info({ event: "tech-walkthrough.suggest.start", model, questionKey });

    const content = await generateCompletion(model, systemPrompt, userPrompt, 1000, {
      requestId,
      route: "tech-walkthrough/suggest",
    });

    let suggestions: string[];
    try {
      suggestions = JSON.parse(extractJsonFromLLMContent(content));
      if (!Array.isArray(suggestions)) {
        suggestions = [content.trim()];
      }
    } catch {
      // If parsing fails, treat the whole response as a single suggestion
      suggestions = [content.trim()];
    }

    const response: ApiResponse<{ suggestions: string[] }> = {
      ok: true,
      data: { suggestions },
    };

    log.info({ event: "tech-walkthrough.suggest.success", count: suggestions.length });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.suggest.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to get suggestions" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
