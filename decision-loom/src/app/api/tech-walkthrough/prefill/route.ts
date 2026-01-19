import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const prefillSchema = z.object({
  prdContent: z.string().min(10),
});

const DRIVER_QUESTIONS = [
  { key: "unit_of_work", label: "Unit of Work" },
  { key: "scale_shape", label: "Scale Shape" },
  { key: "latency_contract", label: "Latency Contract" },
  { key: "data_volatility", label: "Data Volatility" },
  { key: "correctness_risk", label: "Correctness & Risk" },
  { key: "cost_envelope", label: "Cost Envelope" },
  { key: "privacy_compliance", label: "Privacy & Compliance" },
  { key: "observability", label: "Day-One Observability" },
];

function extractJsonFromLLMContent(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = createRequestLogger({ requestId, route: "tech-walkthrough/prefill" });

  try {
    const body = await request.json();
    const parsed = prefillSchema.safeParse(body);

    if (!parsed.success) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { prdContent } = parsed.data;

    const systemPrompt = `You are a senior software architect analyzing a PRD to extract architecture drivers and agentic profile.

PART 1: Architecture Drivers
For each of the following questions, provide a concise, specific answer based on the PRD content. Make reasonable inferences where the PRD doesn't explicitly state something.

Questions:
1. unit_of_work: What is the atomic unit of work in this system?
2. scale_shape: How will load grow? (linear, bursty, steady)
3. latency_contract: What are the latency requirements?
4. data_volatility: How often does data change? Read/write ratio?
5. correctness_risk: What's the cost of errors?
6. cost_envelope: What are the budget constraints?
7. privacy_compliance: What regulations apply?
8. observability: What metrics are needed from day one?

PART 2: Agentic Profile
Analyze whether this system uses AI agents and extract the agentic profile. Be conservative - only infer agentic behavior if the PRD explicitly mentions agents, AI autonomy, or human-in-the-loop workflows.

Fields:
- agenticMode: "none" (traditional app), "assistive" (AI suggests, user drives), "semi_autonomous" (agent proposes, user approves), "autonomous" (agent executes within guardrails)
- orchestrationShape: "single_agent" (one agent), "multi_agent_collaborative" (agents work together), "multi_agent_specialist" (specialist roles like planner/executor), or null if not agentic
- toolCapabilities: Array of capabilities - "text_only", "tool_calls", "external_actions"
- memoryRequirements: "none", "session_only", "long_term", or null if not agentic
- humanApprovalRequired: Array of what needs approval - "tool_calls", "external_actions", "data_access", or empty array if not required
- guardrailsNotes: Any safety constraints, compliance requirements, evaluation protocols, audit requirements, or policy checks mentioned

Return a JSON object with both parts.`;

    const userPrompt = `## PRD
${prdContent}

Analyze this PRD and provide:
1. Answers for all 8 architecture driver questions
2. Agentic profile (infer from mentions of agents, AI autonomy, human-in-the-loop workflows, tool use, memory, guardrails)

Return JSON format:
{
  "drivers": {
    "unit_of_work": "...",
    "scale_shape": "...",
    "latency_contract": "...",
    "data_volatility": "...",
    "correctness_risk": "...",
    "cost_envelope": "...",
    "privacy_compliance": "...",
    "observability": "..."
  },
  "agenticProfile": {
    "agenticMode": "none|assistive|semi_autonomous|autonomous",
    "orchestrationShape": "single_agent|multi_agent_collaborative|multi_agent_specialist|null",
    "toolCapabilities": ["text_only", "tool_calls", "external_actions"],
    "memoryRequirements": "none|session_only|long_term|null",
    "humanApprovalRequired": ["tool_calls", "external_actions", "data_access"],
    "guardrailsNotes": "..."
  }
}`;

    const model = process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    log.info({ event: "tech-walkthrough.prefill.start", model });

    const content = await generateCompletion(model, systemPrompt, userPrompt, 2000, {
      requestId,
      route: "tech-walkthrough/prefill",
    });

    let llmResponse;
    try {
      llmResponse = JSON.parse(extractJsonFromLLMContent(content));
    } catch {
      log.error({ event: "tech-walkthrough.prefill.parse.error", content: content.slice(0, 500) });
      throw new Error("Failed to parse LLM response");
    }

    const response: ApiResponse<{ answers: Record<string, string>, agenticProfile?: any }> = {
      ok: true,
      data: {
        answers: llmResponse.drivers || llmResponse,
        agenticProfile: llmResponse.agenticProfile || null,
      },
    };

    log.info({ event: "tech-walkthrough.prefill.success" });
    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "tech-walkthrough.prefill.error", error: errMsg });
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to prefill answers" },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
