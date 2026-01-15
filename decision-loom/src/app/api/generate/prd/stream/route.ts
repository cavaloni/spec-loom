import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletionStream } from "@/server/llm/client";
import { buildGeneratePrdPrompt } from "@/server/llm/prompts/generatePrd";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { SectionAnswer, SectionSummary, QAItem, SectionKey } from "@/types/core";

const generatePrdSchema = z.object({
  sessionId: z.string(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "generate-prd-stream", ip });

  try {
    log.info({ event: "generate-prd-stream.start" });
    const rateLimit = await checkRateLimit("generate", ip);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = generatePrdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sessionId } = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sections: true,
        summaries: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Session not found",
          },
        },
        { status: 404 }
      );
    }

    const answers: SectionAnswer[] = session.sections.map(
      (s: { key: string; qaJson: string; notes: string | null }) => ({
        key: s.key as SectionKey,
        qa: JSON.parse(s.qaJson) as QAItem[],
        notes: s.notes || undefined,
      })
    );

    const summaries: SectionSummary[] = session.summaries.map(
      (s: { key: string; summary: string }) => ({
        key: s.key as SectionSummary["key"],
        summary: s.summary,
      })
    );

    const { system, user } = buildGeneratePrdPrompt(
      session.title,
      answers,
      summaries,
      session.productDescription || undefined
    );

    const model =
      process.env.OPENROUTER_MODEL_GENERATE || "anthropic/claude-3.5-sonnet";
    log.info({ event: "generate-prd-stream.llm.start", model });

    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateCompletionStream(
            model,
            system,
            user,
            8000,
            { requestId, route: "generate-prd-stream", sessionId }
          )) {
            fullContent += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Save the artifact after streaming completes
          await prisma.artifact.upsert({
            where: {
              id: `${sessionId}-PRD`,
            },
            create: {
              id: `${sessionId}-PRD`,
              sessionId,
              type: "PRD",
              title: `PRD - ${session.title || "Untitled"}`,
              contentMd: fullContent.trim(),
            },
            update: {
              contentMd: fullContent.trim(),
            },
          });

          log.info({ event: "generate-prd-stream.success", contentLength: fullContent.length });
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error({ event: "generate-prd-stream.stream.error", error: errMsg });
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "generate-prd-stream.error", error: errMsg });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate PRD",
        },
      },
      {
        status: 500,
        headers: { "x-request-id": requestId },
      }
    );
  }
}
