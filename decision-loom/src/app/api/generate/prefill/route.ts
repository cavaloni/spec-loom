import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { SECTIONS } from "@/content/questions";
import { createRequestLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import type { ApiResponse, QAItem, SectionKey } from "@/types/core";

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

const prefillSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  const log = createRequestLogger({ requestId, route: "prefill", ip });

  try {
    log.info({ event: "prefill.start" });
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
    const parsed = prefillSchema.safeParse(body);

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

    const { description } = parsed.data;

    const startedAt = Date.now();

    const systemPrompt = `You are a product specification expert. Your task is to generate initial, thoughtful answers for a product specification based on a user's product description.

Guidelines:
- Provide concrete, specific answers based on the product description
- Make reasonable assumptions when information is missing
- Keep answers concise but informative (2-4 sentences per answer)
- Use placeholders like "[specific details]" where you need more information
- Maintain a professional, product-focused tone
- Focus on what's most important for an MVP`;

    const userPrompt = `Product Description:
${description}

Please provide answers for each question below. Format your response as JSON with this structure:
{
  "answers": {
    "SECTION_KEY": {
      "qa": [
        {
          "questionId": "question.id",
          "question": "question text",
          "answer": "your answer"
        }
      ]
    }
  }
}

Sections and questions:
${SECTIONS.map(section => `
${section.key}:
${section.questions.map(q => `- ${q.id}: ${q.prompt}`).join('\n')}
`).join('\n')}

Generate the JSON response now:`;

    const model =
      process.env.OPENROUTER_MODEL_SUGGEST || "anthropic/claude-3.5-sonnet";
    log.info({ event: "prefill.llm.start", model });
    const content = await generateCompletion(model, systemPrompt, userPrompt, 8000, {
      requestId,
      route: "prefill",
    });
    log.info({ event: "prefill.llm.done", durationMs: Date.now() - startedAt, contentLength: content.length });

    let parsedContent;
    try {
      parsedContent = JSON.parse(extractJsonFromLLMContent(content));
    } catch {
      const preview = content.length > 4000 ? `${content.slice(0, 4000)}\n...[truncated]` : content;
      log.error({ event: "prefill.parse.error", preview });
      throw new Error("Invalid response from LLM");
    }

    if (!parsedContent.answers || typeof parsedContent.answers !== "object") {
      throw new Error("Invalid response structure from LLM");
    }

    const response: ApiResponse<{ answers: Record<SectionKey, { qa: QAItem[] }> }> = {
      ok: true,
      data: {
        answers: parsedContent.answers,
      },
    };

    log.info({ event: "prefill.success", durationMs: Date.now() - startedAt });
    return NextResponse.json(response, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ event: "prefill.error", error: errMsg });

    const maybeAny = error as any;
    const msg = (maybeAny?.message || "").toString().toLowerCase();
    const isTimeoutLike =
      msg.includes("timeout") ||
      maybeAny?.name === "AbortError" ||
      maybeAny?.code === "ETIMEDOUT" ||
      maybeAny?.code === "ECONNABORTED";

    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate initial answers",
      },
    };
    return NextResponse.json(response, {
      status: isTimeoutLike ? 504 : 500,
      headers: { "x-request-id": requestId },
    });
  }
}
