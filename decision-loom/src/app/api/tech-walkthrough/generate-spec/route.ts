import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const generateSpecSchema = z.object({
  walkthroughId: z.string(),
  sessionId: z.string(),
  prdContent: z.string(),
  drivers: z.record(z.string()),
  decisions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      area: z.string(),
      chosenOption: z.string(),
      alternatives: z.array(z.string()),
      tradeoffs: z.string(),
      userVisibleConsequence: z.string(),
      mvpImpact: z.string(),
      openQuestions: z.string(),
      status: z.string(),
    })
  ),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/generate-spec" });

  try {
    const body = await request.json();
    const parsed = generateSpecSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { walkthroughId, sessionId, prdContent, drivers, decisions } = parsed.data;

    const systemPrompt = `You are a senior software architect writing a comprehensive technical specification.

Generate a complete tech spec document in Markdown format with the following sections:

1. **Executive Summary** - Brief overview of the system and key decisions
2. **Architecture Drivers Summary** - Summarize the key constraints and requirements
3. **Load-Bearing Decisions** - Detail each architecture decision with:
   - Decision title and area
   - Chosen approach and rationale
   - Alternatives considered
   - Tradeoffs accepted
   - User-visible consequences (how users will experience this)
   - MVP impact
   - Open questions
4. **System Architecture** - High-level component diagram description and tech stack
5. **Data Model** - Key entities and relationships (Prisma schema style)
6. **API Contracts** - Key endpoints with request/response shapes
7. **Implementation Plan** - Phased approach with micro-tasks
8. **Operational Considerations** - Monitoring, deployment, incident response

Focus on practical, actionable content. Reference the user-visible consequences throughout to keep the spec grounded in user experience.`;

    const driversText = Object.entries(drivers)
      .map(([key, value]) => `- **${key}**: ${value}`)
      .join("\n");

    const decisionsText = decisions
      .map(
        (d, i) => `### Decision ${i + 1}: ${d.title}
- **Area**: ${d.area}
- **Chosen Option**: ${d.chosenOption}
- **Alternatives**: ${d.alternatives.join(", ")}
- **Tradeoffs**: ${d.tradeoffs}
- **User-Visible Consequence**: ${d.userVisibleConsequence}
- **MVP Impact**: ${d.mvpImpact}
- **Open Questions**: ${d.openQuestions}
- **Status**: ${d.status}`
      )
      .join("\n\n");

    const userPrompt = `## PRD
${prdContent}

## Architecture Drivers
${driversText}

## Architecture Decisions
${decisionsText}

Generate a comprehensive technical specification document in Markdown format.`;

    const model = process.env.OPENROUTER_MODEL_GENERATE || "openai/gpt-4o";
    log.info({ event: "tech-walkthrough.generate-spec.start", model });

    const spec = await generateCompletion(model, systemPrompt, userPrompt, 16000, {
      requestId,
      route: "tech-walkthrough/generate-spec",
    });

    // Save as TECH_SPEC artifact
    await prisma.artifact.upsert({
      where: {
        id: `tech-spec-${sessionId}`,
      },
      create: {
        id: `tech-spec-${sessionId}`,
        sessionId,
        type: "TECH_SPEC",
        title: "Technical Specification",
        contentMd: spec,
      },
      update: {
        contentMd: spec,
        updatedAt: new Date(),
      },
    });

    // Update walkthrough status
    await prisma.techWalkthrough.update({
      where: { id: walkthroughId },
      data: { status: "completed" },
    });

    const response: ApiResponse<{ spec: string }> = {
      ok: true,
      data: { spec },
    };

    log.info({ event: "tech-walkthrough.generate-spec.success", specLength: spec.length });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.generate-spec.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to generate spec" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
