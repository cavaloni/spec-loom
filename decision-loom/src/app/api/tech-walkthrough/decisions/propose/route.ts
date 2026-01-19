import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const agenticProfileSchema = z.object({
  agenticMode: z.string(),
  orchestrationShape: z.string().nullable(),
  toolCapabilities: z.array(z.string()),
  memoryRequirements: z.string().nullable(),
  humanApprovalRequired: z.array(z.string()),
  guardrailsNotes: z.string().nullable(),
});

const proposeSchema = z.object({
  walkthroughId: z.string(),
  prdContent: z.string(),
  drivers: z.record(z.string()),
  agenticProfile: agenticProfileSchema.optional(),
});

function extractJsonFromLLMContent(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  return trimmed;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/decisions/propose" });

  try {
    const body = await request.json();
    const parsed = proposeSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { walkthroughId, prdContent, drivers, agenticProfile } = parsed.data;

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

    // Determine if this is an agentic system
    const isAgentic = agenticProfile && agenticProfile.agenticMode !== "none";

    // Build agentic-specific instructions if applicable
    let agenticInstructions = "";
    if (isAgentic) {
      agenticInstructions = `
IMPORTANT: This is an AGENTIC SYSTEM. You MUST include at least 1-2 decisions in the "orchestration" area covering:
- Agent orchestration pattern (planner/executor, state machine, workflow graph, etc.)
- Tool calling architecture (tool registry, permissions, sandboxing)
- Memory architecture (session store, vector store, retention policies)
- Human-in-the-loop UX (approval flows, review UI, rollback mechanisms)
- Evaluation & reliability (prompt testing, golden traces, guardrails)

Agentic Profile:
- Mode: ${agenticProfile.agenticMode} (${
        agenticProfile.agenticMode === "assistive" ? "suggestions only, user drives" :
        agenticProfile.agenticMode === "semi_autonomous" ? "agent proposes, user approves" :
        "agent executes within guardrails"
      })
- Orchestration: ${agenticProfile.orchestrationShape || "not specified"}
- Tool Capabilities: ${agenticProfile.toolCapabilities.length > 0 ? agenticProfile.toolCapabilities.join(", ") : "not specified"}
- Memory: ${agenticProfile.memoryRequirements || "not specified"}
- Human Approval Required For: ${agenticProfile.humanApprovalRequired.length > 0 ? agenticProfile.humanApprovalRequired.join(", ") : "none specified"}
${agenticProfile.guardrailsNotes ? `- Additional Guardrails: ${agenticProfile.guardrailsNotes}` : ""}
`;
    }

    const systemPrompt = `You are a senior software architect. Based on the PRD and architecture drivers provided, propose 5-7 load-bearing architecture decisions.

Each decision should cover one of these areas:
- data_storage: Database choices, caching strategies, data models
- compute_strategy: Serverless vs containers, async processing, scaling approach
- ux_contract: Loading states, error handling, offline support
- state_sync: Real-time updates, optimistic UI, conflict resolution
- interfaces: API design, event schemas, integration patterns
- risk_controls: Rate limiting, circuit breakers, validation
- operations: Monitoring, deployment, incident response
- orchestration: Agent architecture, tool calling, memory, human-in-the-loop (REQUIRED for agentic systems)
${agenticInstructions}
For each decision, provide:
- title: Short descriptive name
- area: One of the areas above
- chosenOption: The recommended approach
- alternatives: 2-3 other options considered
- tradeoffs: Key tradeoffs of the chosen option
- userVisibleConsequence: How this affects the user experience (REQUIRED)
- mvpImpact: How this affects MVP scope/timeline
- openQuestions: Unresolved questions to address later

Return a JSON array of decisions.`;

    const driversText = Object.entries(drivers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const userPrompt = `## PRD
${prdContent}

## Architecture Drivers
${driversText}
${isAgentic ? `
## Agentic Profile
This system is agentic (${agenticProfile.agenticMode}). Ensure you include orchestration decisions.
` : ""}
Generate 5-7 architecture decisions as a JSON array:
[
  {
    "title": "...",
    "area": "data_storage|compute_strategy|ux_contract|state_sync|interfaces|risk_controls|operations|orchestration",
    "chosenOption": "...",
    "alternatives": ["...", "..."],
    "tradeoffs": "...",
    "userVisibleConsequence": "...",
    "mvpImpact": "...",
    "openQuestions": "..."
  }
]`;

    const model = process.env.OPENROUTER_MODEL_GENERATE || "openai/gpt-4o";
    log.info({ event: "tech-walkthrough.decisions.propose.start", model });

    const content = await generateCompletion(model, systemPrompt, userPrompt, 8000, {
      requestId,
      route: "tech-walkthrough/decisions/propose",
    });

    let decisions;
    try {
      decisions = JSON.parse(extractJsonFromLLMContent(content));
    } catch {
      log.error({ event: "tech-walkthrough.decisions.parse.error", content: content.slice(0, 500) });
      throw new Error("Failed to parse LLM response");
    }

    // Clear existing decisions and insert new ones
    await prisma.architectureDecision.deleteMany({
      where: { walkthroughId },
    });

    const createdDecisions = [];
    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i];
      const created = await prisma.architectureDecision.create({
        data: {
          walkthroughId,
          title: d.title,
          area: d.area,
          chosenOption: d.chosenOption,
          alternatives: JSON.stringify(d.alternatives || []),
          tradeoffs: d.tradeoffs || "",
          userVisibleConsequence: d.userVisibleConsequence || "",
          mvpImpact: d.mvpImpact || "",
          openQuestions: d.openQuestions || "",
          status: "tentative",
          sortOrder: i,
        },
      });
      createdDecisions.push({
        ...created,
        alternatives: d.alternatives || [],
      });
    }

    const response: ApiResponse<{ decisions: typeof createdDecisions }> = {
      ok: true,
      data: { decisions: createdDecisions },
    };

    log.info({ event: "tech-walkthrough.decisions.propose.success", count: createdDecisions.length });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.decisions.propose.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to propose decisions" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
