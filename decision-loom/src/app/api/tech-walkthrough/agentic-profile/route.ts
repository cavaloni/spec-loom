import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const agenticProfileSchema = z.object({
  walkthroughId: z.string(),
  agenticMode: z.string(),
  orchestrationShape: z.string().nullable(),
  toolCapabilities: z.array(z.string()),
  memoryRequirements: z.string().nullable(),
  humanApprovalRequired: z.array(z.string()),
  guardrailsNotes: z.string().nullable(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/agentic-profile" });

  try {
    const body = await request.json();
    const parsed = agenticProfileSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const {
      walkthroughId,
      agenticMode,
      orchestrationShape,
      toolCapabilities,
      memoryRequirements,
      humanApprovalRequired,
      guardrailsNotes,
    } = parsed.data;

    // Verify walkthrough exists
    const walkthrough = await prisma.techWalkthrough.findUnique({
      where: { id: walkthroughId },
    });

    if (!walkthrough) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "NOT_FOUND", message: "Walkthrough not found" },
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Upsert agentic profile
    const profile = await prisma.agenticProfile.upsert({
      where: { walkthroughId },
      create: {
        walkthroughId,
        agenticMode,
        orchestrationShape,
        toolCapabilities: JSON.stringify(toolCapabilities),
        memoryRequirements,
        humanApprovalRequired: JSON.stringify(humanApprovalRequired),
        guardrailsNotes,
      },
      update: {
        agenticMode,
        orchestrationShape,
        toolCapabilities: JSON.stringify(toolCapabilities),
        memoryRequirements,
        humanApprovalRequired: JSON.stringify(humanApprovalRequired),
        guardrailsNotes,
      },
    });

    const response: ApiResponse<{ saved: boolean }> = {
      ok: true,
      data: { saved: true },
    };

    log.info({ event: "tech-walkthrough.agentic-profile.saved", profileId: profile.id });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.agentic-profile.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to save agentic profile" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
