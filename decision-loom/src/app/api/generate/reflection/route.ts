import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import type { ApiResponse } from "@/types/core";

const generateReflectionSchema = z.object({
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
    const parsed = generateReflectionSchema.safeParse(body);

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

    const prdArtifact = session.artifacts.find((a: { type: string }) => a.type === "PRD");
    const techSpecArtifact = session.artifacts.find((a: { type: string }) => a.type === "TECH_SPEC");

    if (!prdArtifact || !techSpecArtifact) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "MISSING_ARTIFACTS",
          message: "Both PRD and Tech Spec must be generated first",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const system = `You are an experienced product strategist and technical lead. Your role is to provide sharp, actionable reflections on product plans and technical specifications.

Your output must be:
- Concise and direct (no fluff, no AI verbosity)
- Actionable and specific
- Focused on pressure-testing assumptions
- Structured in markdown with clear sections

Keep each section brief and to the point. Avoid lengthy explanations.`;

    const user = `I have a product plan with the following PRD and Tech Spec. Please provide final reflections and considerations before we start building.

## Product Context
Title: ${session.title || "Untitled"}
Description: ${session.productDescription || "Not provided"}

## PRD
${prdArtifact.contentMd}

## Tech Spec
${techSpecArtifact.contentMd}

Please provide reflections in the following markdown structure:

## Pressure Tests
Provide 3-5 short, sharp questions that pressure-test the plan. Each question should be one sentence, maximum.

### What would make this obviously not work?

### What must be true for this to succeed?

### Where are we likely overconfident?

### What's the smallest version that still proves value?

### What will users do instead if we don't exist?

## What to Validate Next
Provide 2-3 specific experiment suggestions framed as learning opportunities, not features.

For each experiment:
- **Experiment title**
- **Hypothesis**: What you're testing
- **How to run it**: 1-2 bullet points
- **What you learn**: Success signal

## Alternative Lenses
Provide 2-3 reframes that challenge assumptions.

### If we weren't allowed to build software, what would we do?

### What if we must charge from day 1?

### What if we must deliver value in 5 minutes?

Keep all responses concise and actionable. No lengthy explanations.`;

    const model = process.env.OPENROUTER_MODEL_REFLECT || "google/gemini-3-pro-preview";
    const contentMd = await generateCompletion(model, system, user, 6000);

    const response: ApiResponse<{ content: string }> = {
      ok: true,
      data: {
        content: contentMd.trim(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating reflection:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate reflections",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
