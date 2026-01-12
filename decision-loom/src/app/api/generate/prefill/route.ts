import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateCompletion } from "@/server/llm/client";
import { SECTIONS } from "@/content/questions";
import type { ApiResponse, QAItem, SectionKey } from "@/types/core";

const prefillSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
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
      process.env.OPENROUTER_MODEL_GENERATE || "anthropic/claude-3.5-sonnet";
    const content = await generateCompletion(model, systemPrompt, userPrompt, 8000);

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      console.error("Failed to parse LLM response:", content);
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error prefilling answers:", error);
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate initial answers",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
