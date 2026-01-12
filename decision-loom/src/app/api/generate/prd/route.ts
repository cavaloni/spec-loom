import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { buildGeneratePrdPrompt } from "@/server/llm/prompts/generatePrd";
import type { ApiResponse, SectionAnswer, SectionSummary, Artifact, QAItem, SectionKey } from "@/types/core";

const generatePrdSchema = z.object({
  sessionId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = await checkRateLimit("generate", ip);

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
    const parsed = generatePrdSchema.safeParse(body);

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

    const { sessionId } = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sections: true,
        summaries: true,
      },
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

    const answers: SectionAnswer[] = session.sections.map((s: { key: string; qaJson: string; notes: string | null }) => ({
      key: s.key as SectionKey,
      qa: JSON.parse(s.qaJson) as QAItem[],
      notes: s.notes || undefined,
    }));

    const summaries: SectionSummary[] = session.summaries.map((s: { key: string; summary: string }) => ({
      key: s.key as SectionSummary["key"],
      summary: s.summary,
    }));

    const { system, user } = buildGeneratePrdPrompt(
      session.title,
      answers,
      summaries,
      session.productDescription || undefined
    );

    const model =
      process.env.OPENROUTER_MODEL_GENERATE || "anthropic/claude-3.5-sonnet";
    const contentMd = await generateCompletion(model, system, user, 8000);

    const artifact = await prisma.artifact.upsert({
      where: {
        id: `${sessionId}-PRD`,
      },
      create: {
        id: `${sessionId}-PRD`,
        sessionId,
        type: "PRD",
        title: `PRD - ${session.title || "Untitled"}`,
        contentMd: contentMd.trim(),
      },
      update: {
        contentMd: contentMd.trim(),
      },
    });

    const response: ApiResponse<{ artifact: Artifact }> = {
      ok: true,
      data: {
        artifact: {
          type: "PRD",
          title: artifact.title,
          contentMd: artifact.contentMd,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating PRD:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate PRD",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
