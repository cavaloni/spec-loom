import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const patchSchema = z.object({
  decisionId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    area: z.string().optional(),
    chosenOption: z.string().optional(),
    alternatives: z.array(z.string()).optional(),
    tradeoffs: z.string().optional(),
    userVisibleConsequence: z.string().optional(),
    mvpImpact: z.string().optional(),
    openQuestions: z.string().optional(),
    status: z.enum(["tentative", "approved"]).optional(),
  }),
});

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/decisions" });

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { decisionId, updates } = parsed.data;

    // Transform alternatives to JSON string if present
    const dbUpdates: Record<string, unknown> = { ...updates };
    if (updates.alternatives) {
      dbUpdates.alternatives = JSON.stringify(updates.alternatives);
    }

    const decision = await prisma.architectureDecision.update({
      where: { id: decisionId },
      data: dbUpdates,
    });

    const response: ApiResponse<{ id: string }> = {
      ok: true,
      data: { id: decision.id },
    };

    log.info({ event: "tech-walkthrough.decision.updated", decisionId });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.decision.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update decision" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
