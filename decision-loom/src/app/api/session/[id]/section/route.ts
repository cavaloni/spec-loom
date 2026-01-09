import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types/core";

const updateSectionSchema = z.object({
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
  qa: z.array(
    z.object({
      questionId: z.string(),
      question: z.string(),
      answer: z.string(),
    })
  ),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const parsed = updateSectionSchema.safeParse(body);

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

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
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

    if (session.expiresAt < new Date()) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "SESSION_EXPIRED",
          message: "Session has expired",
        },
      };
      return NextResponse.json(response, { status: 410 });
    }

    await prisma.sectionAnswer.upsert({
      where: {
        sessionId_key: {
          sessionId,
          key: parsed.data.key,
        },
      },
      create: {
        sessionId,
        key: parsed.data.key,
        qaJson: JSON.stringify(parsed.data.qa),
        notes: parsed.data.notes,
      },
      update: {
        qaJson: JSON.stringify(parsed.data.qa),
        notes: parsed.data.notes,
      },
    });

    const response: ApiResponse<{ saved: boolean }> = {
      ok: true,
      data: { saved: true },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating section:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update section",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
