import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const getSchema = z.object({
  sessionId: z.string(),
});

const postSchema = z.object({
  sessionId: z.string(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough" });

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    const parsed = getSchema.safeParse({ sessionId });
    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid sessionId" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const walkthrough = await prisma.techWalkthrough.findUnique({
      where: { sessionId: parsed.data.sessionId },
      include: {
        drivers: true,
        decisions: { orderBy: { sortOrder: "asc" } },
        agenticProfile: true,
      },
    });

    if (!walkthrough) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "NOT_FOUND", message: "Walkthrough not found" },
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Transform decisions to include parsed alternatives
    const transformedDecisions = walkthrough.decisions.map((d) => ({
      id: d.id,
      title: d.title,
      area: d.area,
      chosenOption: d.chosenOption,
      alternatives: JSON.parse(d.alternatives || "[]") as string[],
      tradeoffs: d.tradeoffs,
      userVisibleConsequence: d.userVisibleConsequence,
      mvpImpact: d.mvpImpact,
      openQuestions: d.openQuestions,
      status: d.status,
    }));

    // Transform drivers for frontend consumption
    const transformedDrivers = walkthrough.drivers.map((d) => ({
      questionKey: d.questionKey,
      answer: d.answer,
    }));

    // Transform agentic profile if exists
    const transformedAgenticProfile = walkthrough.agenticProfile
      ? {
          agenticMode: walkthrough.agenticProfile.agenticMode,
          orchestrationShape: walkthrough.agenticProfile.orchestrationShape,
          toolCapabilities: JSON.parse(walkthrough.agenticProfile.toolCapabilities || "[]") as string[],
          memoryRequirements: walkthrough.agenticProfile.memoryRequirements,
          humanApprovalRequired: JSON.parse(walkthrough.agenticProfile.humanApprovalRequired || "[]") as string[],
          guardrailsNotes: walkthrough.agenticProfile.guardrailsNotes,
        }
      : null;

    const responseData = {
      id: walkthrough.id,
      sessionId: walkthrough.sessionId,
      status: walkthrough.status,
      drivers: transformedDrivers,
      decisions: transformedDecisions,
      agenticProfile: transformedAgenticProfile,
    };

    const response: ApiResponse<typeof responseData> = {
      ok: true,
      data: responseData,
    };

    log.info({ event: "tech-walkthrough.get.success", walkthroughId: walkthrough.id });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.get.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to load walkthrough" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough" });

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { sessionId } = parsed.data;

    // Ensure session exists (dev DB can be recreated; client may still hold a sessionId)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const existingSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existingSession) {
      await prisma.session.create({
        data: {
          id: sessionId,
          expiresAt,
          title: "Restored Session",
        },
      });
      log.info({ event: "tech-walkthrough.session.restored", sessionId });
    } else if (existingSession.expiresAt < new Date()) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt },
      });
      log.info({ event: "tech-walkthrough.session.extended", sessionId });
    }

    // Create or get existing walkthrough
    const walkthrough = await prisma.techWalkthrough.upsert({
      where: { sessionId },
      create: { sessionId, status: "in_progress" },
      update: {},
      include: {
        drivers: true,
        decisions: { orderBy: { sortOrder: "asc" } },
      },
    });

    const response: ApiResponse<typeof walkthrough> = {
      ok: true,
      data: walkthrough,
    };

    log.info({ event: "tech-walkthrough.create.success", walkthroughId: walkthrough.id });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.create.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create walkthrough" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
