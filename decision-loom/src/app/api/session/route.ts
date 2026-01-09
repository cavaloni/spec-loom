import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types/core";

const createSessionSchema = z.object({
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createSessionSchema.safeParse(body);

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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = await prisma.session.create({
      data: {
        title: parsed.data.title,
        expiresAt,
      },
    });

    const response: ApiResponse<{
      sessionId: string;
      expiresAt: string;
      activeKey: string;
    }> = {
      ok: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt.toISOString(),
        activeKey: session.activeKey,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create session",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("id");

    if (!sessionId) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Session ID is required",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sections: true,
        summaries: true,
        artifacts: true,
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

    const response: ApiResponse<typeof session> = {
      ok: true,
      data: session,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching session:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch session",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
