import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { buildGenerateTechSpecPrompt } from "@/server/llm/prompts/generateTechSpec";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse, SectionAnswer, SectionSummary, Artifact, QAItem, SectionKey } from "@/types/core";

const generateTechSpecSchema = z.object({
  sessionId: z.string(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "generate-tech-spec", ip });

  try {
    log.info({ event: "generate-tech-spec.start" });
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
    const parsed = generateTechSpecSchema.safeParse(body);

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
        artifacts: {
          where: { type: "PRD" },
        },
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

    const prdArtifact = session.artifacts.find((a: { type: string; contentMd: string }) => a.type === "PRD");
    if (!prdArtifact) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "PREREQUISITE_MISSING",
          message: "PRD must be generated before tech spec",
        },
      };
      return NextResponse.json(response, { status: 400 });
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

    const { system, user } = buildGenerateTechSpecPrompt(
      session.title,
      prdArtifact.contentMd,
      answers,
      summaries
    );

    const model =
      process.env.OPENROUTER_MODEL_GENERATE || "anthropic/claude-3.5-sonnet";
    log.info({ event: "generate-tech-spec.llm.start", model });
    const contentMd = await generateCompletion(model, system, user, 8000, {
      requestId,
      route: "generate-tech-spec",
      sessionId,
    });
    log.info({ event: "generate-tech-spec.llm.done", contentLength: contentMd.length });

    const artifact = await prisma.artifact.upsert({
      where: {
        id: `${sessionId}-TECH_SPEC`,
      },
      create: {
        id: `${sessionId}-TECH_SPEC`,
        sessionId,
        type: "TECH_SPEC",
        title: `Tech Spec - ${session.title || "Untitled"}`,
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
          type: "TECH_SPEC",
          title: artifact.title,
          contentMd: artifact.contentMd,
        },
      },
    };

    log.info({ event: "generate-tech-spec.success" });
    return NextResponse.json(response, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "generate-tech-spec.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate tech spec",
      },
    };
    return NextResponse.json(response, {
      status: 500,
      headers: { "x-request-id": requestId },
    });
  }
}
