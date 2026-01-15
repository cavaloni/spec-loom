import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { buildSummarizePrompt } from "@/server/llm/prompts/summarize";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse, SectionKey, QAItem } from "@/types/core";

const summarizeSchema = z.object({
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
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "summarize", ip });

  try {
    log.info({ event: "summarize.start" });
    const rateLimit = await checkRateLimit("summarize", ip);

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
    const parsed = summarizeSchema.safeParse(body);

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

    const { sessionId, key } = parsed.data;

    const sectionAnswer = await prisma.sectionAnswer.findUnique({
      where: {
        sessionId_key: {
          sessionId,
          key,
        },
      },
    });

    if (!sectionAnswer) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Section answers not found",
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const qa = JSON.parse(sectionAnswer.qaJson) as QAItem[];
    const { system, user } = buildSummarizePrompt(
      key as SectionKey,
      qa,
      sectionAnswer.notes || undefined
    );

    const model =
      process.env.OPENROUTER_MODEL_SUMMARY || "anthropic/claude-3.5-sonnet";
    const summary = await generateCompletion(model, system, user, 500, {
      requestId,
      route: "summarize",
      sessionId,
    });

    await prisma.sectionSummary.upsert({
      where: {
        sessionId_key: {
          sessionId,
          key,
        },
      },
      create: {
        sessionId,
        key,
        summary: summary.trim(),
      },
      update: {
        summary: summary.trim(),
      },
    });

    const response: ApiResponse<{ summary: string }> = {
      ok: true,
      data: { summary: summary.trim() },
    };

    log.info({ event: "summarize.success", key });
    return NextResponse.json(response, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "summarize.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate summary",
      },
    };
    return NextResponse.json(response, {
      status: 500,
      headers: { "x-request-id": requestId },
    });
  }
}
