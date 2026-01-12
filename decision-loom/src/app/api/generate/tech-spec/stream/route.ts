import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletionStream } from "@/server/llm/client";
import { buildGenerateTechSpecPrompt } from "@/server/llm/prompts/generateTechSpec";
import type { SectionAnswer, SectionSummary, QAItem, SectionKey } from "@/types/core";

const generateTechSpecSchema = z.object({
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
    const parsed = generateTechSpecSchema.safeParse(body);

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
        artifacts: {
          where: { type: "PRD" },
        },
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

    const prdArtifact = session.artifacts.find(
      (a: { type: string; contentMd: string }) => a.type === "PRD"
    );
    if (!prdArtifact) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PREREQUISITE_MISSING",
            message: "PRD must be generated before tech spec",
          },
        },
        { status: 400 }
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

    const { system, user } = buildGenerateTechSpecPrompt(
      session.title,
      prdArtifact.contentMd,
      answers,
      summaries
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
              id: `${sessionId}-TECH_SPEC`,
            },
            create: {
              id: `${sessionId}-TECH_SPEC`,
              sessionId,
              type: "TECH_SPEC",
              title: `Tech Spec - ${session.title || "Untitled"}`,
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
    console.error("Error generating tech spec:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate tech spec",
        },
      },
      { status: 500 }
    );
  }
}
