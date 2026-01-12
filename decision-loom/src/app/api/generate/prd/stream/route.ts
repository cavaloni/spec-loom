import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletionStream } from "@/server/llm/client";
import { buildGeneratePrdPrompt } from "@/server/llm/prompts/generatePrd";
import type { SectionAnswer, SectionSummary, QAItem, SectionKey } from "@/types/core";

const generatePrdSchema = z.object({
  sessionId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
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

    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateCompletionStream(
            model,
            system,
            user,
            8000
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

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
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
      },
    });
  } catch (error) {
    console.error("Error generating PRD:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate PRD",
        },
      },
      { status: 500 }
    );
  }
}
