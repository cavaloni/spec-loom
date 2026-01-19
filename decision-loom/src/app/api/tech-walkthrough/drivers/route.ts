import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const driversSchema = z.object({
  walkthroughId: z.string(),
  drivers: z.array(
    z.object({
      questionKey: z.string(),
      answer: z.string(),
    })
  ),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/drivers" });

  try {
    const body = await request.json();
    const parsed = driversSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { walkthroughId, drivers } = parsed.data;

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

    // Upsert each driver answer
    for (const driver of drivers) {
      await prisma.architectureDriverAnswer.upsert({
        where: {
          walkthroughId_questionKey: {
            walkthroughId,
            questionKey: driver.questionKey,
          },
        },
        create: {
          walkthroughId,
          questionKey: driver.questionKey,
          answer: driver.answer,
        },
        update: {
          answer: driver.answer,
        },
      });
    }

    const response: ApiResponse<{ saved: number }> = {
      ok: true,
      data: { saved: drivers.length },
    };

    log.info({ event: "tech-walkthrough.drivers.saved", count: drivers.length });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.drivers.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to save drivers" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
