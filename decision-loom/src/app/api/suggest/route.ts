import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { buildSuggestPrompt } from "@/server/llm/prompts/suggest";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse, SectionKey, Suggestion } from "@/types/core";
import { randomUUID } from "crypto";

const suggestSchema = z.object({
  sessionId: z.string(),
  key: z.enum([
    "CONTEXT",
    "OUTCOME",
    "RISKS",
    "EXPERIENCE",
    "FLOW",
    "LIMITS",
    "OPERATIONS",
    "WINS",
  ]),
  currentText: z.string(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "suggest", ip });

  try {
    log.info({ event: "suggest.start" });
    const rateLimit = await checkRateLimit("suggest", ip);

    if (!rateLimit.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      };
      return NextResponse.json(response, { status: 429 });
    }

    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten(),
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { sessionId, key, currentText } = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { summaries: true },
    });

    if (!session) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Session not found",
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const priorSummaries: Record<string, string> = {};
    for (const summary of session.summaries) {
      priorSummaries[summary.key] = summary.summary;
    }

    const { system, user } = buildSuggestPrompt(
      key as SectionKey,
      currentText,
      priorSummaries,
      session.productDescription || undefined
    );

    const model =
      process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    const result = await generateCompletion(model, system, user, 1000, {
      requestId,
      route: "suggest",
      sessionId,
    });

    let suggestions: Suggestion[] = [];
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.map(
          (s: { type: string; text: string }) => ({
            id: randomUUID(),
            type: s.type as Suggestion["type"],
            text: s.text,
          })
        );
      }
    } catch {
      suggestions = [
        {
          id: randomUUID(),
          type: "example",
          text: result.trim(),
        },
      ];
    }

    const response: ApiResponse<{ suggestions: Suggestion[] }> = {
      ok: true,
      data: { suggestions },
    };

    log.info({ event: "suggest.success", suggestionCount: suggestions.length });
    return NextResponse.json(response, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "suggest.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate suggestions",
      },
    };
    return NextResponse.json(response, {
      status: 500,
      headers: { "x-request-id": requestId },
    });
  }
}
