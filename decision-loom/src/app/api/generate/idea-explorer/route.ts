import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse } from "@/types/core";

const questionSchema = z.object({
  label: z.string(),
  question: z.string(),
  answer: z.string(),
});

const ideaExplorerSchema = z.object({
  questionSetId: z.string(),
  questions: z.array(questionSchema).length(3),
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

type IdeaSuggestion = {
  title: string;
  oneLiner: string;
  descriptionToPaste: string;
};

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "idea-explorer", ip });

  try {
    log.info({ event: "idea-explorer.start" });
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
    const parsed = ideaExplorerSchema.safeParse(body);

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

    const { questionSetId, questions } = parsed.data;

    const hasAnyInput = questions.some((q) => q.answer.trim());

    const systemPrompt = `You are a creative product founder who helps people discover app ideas through playful brainstorming.

Your job is to take the user's abstract, playful inputs and converge them into 3 DISTINCT, CONCRETE app ideas.

Guidelines:
- Each idea should be genuinely different (different problem space, different user, or different approach)
- Be specific: name the target user, the core action, and the MVP loop
- Avoid generic "AI productivity assistant" ideas unless the inputs clearly point there
- Make ideas feel achievable as side projects or MVPs
- The "descriptionToPaste" should be a short paragraph (2-4 sentences) suitable for feeding into a spec generator
- Keep titles punchy (2-4 words)
- Keep oneLiner to one sentence

Return ONLY a valid JSON array with exactly 3 objects. No other text.`;

    let userPrompt: string;

    if (hasAnyInput) {
      const questionsText = questions
        .map((q) => `**${q.label}**: ${q.question}\nAnswer: ${q.answer || "(left blank)"}`)
        .join("\n\n");

      userPrompt = `The user answered these playful brainstorming prompts (question set: "${questionSetId}"):

${questionsText}

Based on these inputs, generate 3 distinct app ideas. Return as JSON array:
[
  {
    "title": "Short punchy name",
    "oneLiner": "One sentence describing the app",
    "descriptionToPaste": "A 2-4 sentence description suitable for a product spec. Include target user, core problem, and MVP approach."
  }
]`;
    } else {
      userPrompt = `The user wants app ideas but left all prompts blank. Generate 3 surprising, distinct app ideas that are:
- Weird but plausible
- Have a clear target user
- Could be built as an MVP in a few weeks

Return as JSON array:
[
  {
    "title": "Short punchy name",
    "oneLiner": "One sentence describing the app",
    "descriptionToPaste": "A 2-4 sentence description suitable for a product spec. Include target user, core problem, and MVP approach."
  }
]`;
    }

    const startedAt = Date.now();
    const model = process.env.OPENROUTER_MODEL_IDEA_EXPLORER || process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    log.info({ event: "idea-explorer.llm.start", model, hasAnyInput });

    const content = await generateCompletion(model, systemPrompt, userPrompt, 2000, {
      requestId,
      route: "idea-explorer",
    });

    log.info({ event: "idea-explorer.llm.done", durationMs: Date.now() - startedAt, contentLength: content.length });

    let ideas: IdeaSuggestion[];
    try {
      ideas = JSON.parse(extractJsonFromLLMContent(content));
      if (!Array.isArray(ideas) || ideas.length !== 3) {
        throw new Error("Expected array of 3 ideas");
      }
    } catch (parseErr) {
      const preview = content.length > 500 ? `${content.slice(0, 500)}...` : content;
      log.error({ event: "idea-explorer.parse.error", preview });
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "PARSE_ERROR",
          message: "Failed to parse ideas. Try again?",
        },
      };
      return NextResponse.json(response, { status: 500 });
    }

    const response: ApiResponse<{ ideas: IdeaSuggestion[] }> = {
      ok: true,
      data: { ideas },
    };

    log.info({ event: "idea-explorer.success", durationMs: Date.now() - startedAt });
    return NextResponse.json(response, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "idea-explorer.error", error: errMsg });

    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate ideas",
      },
    };
    return NextResponse.json(response, {
      status: 500,
      headers: { "x-request-id": requestId },
    });
  }
}
