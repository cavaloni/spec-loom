import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateChatStream } from "@/server/llm/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const refineSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  artifactType: z.enum(["PRD", "TECH_SPEC"]),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = await checkRateLimit("refine", ip);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = refineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, message, artifactType } = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        artifacts: {
          where: { type: artifactType },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Session not found",
          },
        },
        { status: 404 }
      );
    }

    const artifact = session.artifacts[0];
    if (!artifact) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: `${artifactType} not found`,
          },
        },
        { status: 404 }
      );
    }

    const systemPrompt = `You are a helpful assistant that helps refine ${artifactType === "PRD" ? "Product Requirements Documents (PRDs)" : "Technical Specifications"}.

The user has generated the following document:

---
${artifact.contentMd}
---

Your role is to:
1. Answer questions about the document
2. Suggest improvements when asked
3. Help clarify sections
4. Make specific edits when requested

When responding:
- Be concise and helpful
- If the user asks for changes, describe what you would change
- If you're making substantial edits to the document, include the marker "---ARTIFACT_UPDATE---" followed by the complete updated document
- Only include the artifact update marker if you're providing a full revised version of the document

Keep your responses focused and actionable.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const model =
      process.env.OPENROUTER_MODEL_REFINE ||
      process.env.OPENROUTER_MODEL_GENERATE ||
      "anthropic/claude-3.5-sonnet";

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateChatStream(model, messages, 4000)) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in refine endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process refinement request",
        },
      },
      { status: 500 }
    );
  }
}
