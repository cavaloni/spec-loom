import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const generateDiagramSchema = z.object({
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

function extractMermaidCode(content: string): string {
  // Try to extract from code fence
  const mermaidMatch = content.match(/```mermaid\s*\n([\s\S]*?)\n```/i);
  if (mermaidMatch?.[1]) {
    return mermaidMatch[1].trim();
  }

  // Try generic code fence
  const codeMatch = content.match(/```\s*\n([\s\S]*?)\n```/);
  if (codeMatch?.[1]) {
    return codeMatch[1].trim();
  }

  // Return as-is if no fence found
  return content.trim();
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/generate-diagram" });

  try {
    const body = await request.json();
    const parsed = generateDiagramSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { prdContent, drivers, decisions } = parsed.data;

    const systemPrompt = `You are a software architect creating architecture diagrams using Mermaid.js syntax.

Generate a clean, readable Mermaid.js flowchart or C4 diagram that shows:
1. Main system components
2. Data flows between components
3. External integrations
4. Key architectural boundaries

Use the flowchart TD (top-down) or LR (left-right) syntax. Keep it simple and readable.

IMPORTANT: Return ONLY the Mermaid code, no explanations. The code should be valid Mermaid.js syntax.

Example format:
\`\`\`mermaid
flowchart TD
    A[Client] --> B[API Gateway]
    B --> C[Service]
    C --> D[(Database)]
\`\`\``;

    const driversText = Object.entries(drivers)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");

    const decisionsText = decisions
      .map((d) => `- ${d.title} (${d.area}): ${d.chosenOption}`)
      .join("\n");

    const userPrompt = `Based on this system:

## PRD Summary
${prdContent.slice(0, 2000)}...

## Architecture Drivers
${driversText}

## Key Decisions
${decisionsText}

Generate a Mermaid.js architecture diagram. Return ONLY the Mermaid code.`;

    const model = process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    log.info({ event: "tech-walkthrough.generate-diagram.start", model });

    const content = await generateCompletion(model, systemPrompt, userPrompt, 2000, {
      requestId,
      route: "tech-walkthrough/generate-diagram",
    });

    const diagram = extractMermaidCode(content);

    const response: ApiResponse<{ diagram: string }> = {
      ok: true,
      data: { diagram },
    };

    log.info({ event: "tech-walkthrough.generate-diagram.success", diagramLength: diagram.length });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.generate-diagram.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to generate diagram" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
