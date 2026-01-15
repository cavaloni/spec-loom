import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { Langfuse } from "langfuse";
import { logger } from "@/lib/logger";
import { trace, SpanStatusCode } from "@/lib/telemetry";

let client: OpenAI | null = null;
let langfuse: Langfuse | null = null;

const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 120_000);
const DEFAULT_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 0);

function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse;
  
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";
  
  if (!publicKey || !secretKey) {
    return null;
  }
  
  langfuse = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
  });
  
  return langfuse;
}

export interface LLMCallOptions {
  requestId?: string;
  route?: string;
  sessionId?: string;
}

export function getLLMClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
    });
  }
  return client;
}

export async function generateCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2000,
  options: LLMCallOptions = {}
): Promise<string> {
  const client = getLLMClient();
  const lf = getLangfuse();
  const tracer = trace.getTracer("llm-client");
  const startTime = Date.now();
  const { requestId, route, sessionId } = options;

  const log = logger.child({ requestId, route, model, maxTokens });
  log.info({ event: "llm.request.start", promptLength: userPrompt.length });

  // Create Langfuse trace if available
  const lfTrace = lf?.trace({
    id: requestId,
    name: route || "generateCompletion",
    sessionId,
    metadata: { model, maxTokens },
  });

  const generation = lfTrace?.generation({
    name: "chat-completion",
    model,
    input: { system: systemPrompt, user: userPrompt },
    modelParameters: { maxTokens, temperature: 0.7 },
  });

  return tracer.startActiveSpan("llm.generateCompletion", async (span) => {
    span.setAttribute("llm.model", model);
    span.setAttribute("llm.max_tokens", maxTokens);
    if (requestId) span.setAttribute("request.id", requestId);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "";
      const durationMs = Date.now() - startTime;
      const usage = response.usage;

      log.info({
        event: "llm.request.end",
        durationMs,
        outputLength: content.length,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
      });

      span.setAttribute("llm.duration_ms", durationMs);
      span.setAttribute("llm.output_length", content.length);
      if (usage) {
        span.setAttribute("llm.prompt_tokens", usage.prompt_tokens);
        span.setAttribute("llm.completion_tokens", usage.completion_tokens);
      }
      span.setStatus({ code: SpanStatusCode.OK });

      // End Langfuse generation
      generation?.end({
        output: content,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      });

      return content;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);

      log.error({ event: "llm.request.error", durationMs, error: errMsg });

      span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
      span.recordException(error as Error);

      generation?.end({ output: null, statusMessage: errMsg, level: "ERROR" });

      throw error;
    } finally {
      span.end();
      // Flush Langfuse events (non-blocking)
      lf?.flushAsync().catch(() => {});
    }
  });
}

export async function* generateCompletionStream(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2000,
  options: LLMCallOptions = {}
): AsyncGenerator<string, void, unknown> {
  const client = getLLMClient();
  const lf = getLangfuse();
  const tracer = trace.getTracer("llm-client");
  const startTime = Date.now();
  const { requestId, route, sessionId } = options;

  const log = logger.child({ requestId, route, model, maxTokens });
  log.info({ event: "llm.stream.start", promptLength: userPrompt.length });

  const lfTrace = lf?.trace({
    id: requestId,
    name: route || "generateCompletionStream",
    sessionId,
    metadata: { model, maxTokens, streaming: true },
  });

  const generation = lfTrace?.generation({
    name: "chat-completion-stream",
    model,
    input: { system: systemPrompt, user: userPrompt },
    modelParameters: { maxTokens, temperature: 0.7 },
  });

  const span = tracer.startSpan("llm.generateCompletionStream");
  span.setAttribute("llm.model", model);
  span.setAttribute("llm.max_tokens", maxTokens);
  span.setAttribute("llm.streaming", true);
  if (requestId) span.setAttribute("request.id", requestId);

  let totalContent = "";

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        totalContent += content;
        yield content;
      }
    }

    const durationMs = Date.now() - startTime;
    log.info({ event: "llm.stream.end", durationMs, outputLength: totalContent.length });

    span.setAttribute("llm.duration_ms", durationMs);
    span.setAttribute("llm.output_length", totalContent.length);
    span.setStatus({ code: SpanStatusCode.OK });

    generation?.end({ output: totalContent });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    log.error({ event: "llm.stream.error", durationMs, error: errMsg });

    span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
    span.recordException(error as Error);

    generation?.end({ output: null, statusMessage: errMsg, level: "ERROR" });

    throw error;
  } finally {
    span.end();
    lf?.flushAsync().catch(() => {});
  }
}

export async function* generateChatStream(
  model: string,
  messages: ChatCompletionMessageParam[],
  maxTokens: number = 2000,
  options: LLMCallOptions = {}
): AsyncGenerator<string, void, unknown> {
  const client = getLLMClient();
  const lf = getLangfuse();
  const tracer = trace.getTracer("llm-client");
  const startTime = Date.now();
  const { requestId, route, sessionId } = options;

  const log = logger.child({ requestId, route, model, maxTokens });
  log.info({ event: "llm.chat_stream.start", messageCount: messages.length });

  const lfTrace = lf?.trace({
    id: requestId,
    name: route || "generateChatStream",
    sessionId,
    metadata: { model, maxTokens, streaming: true, messageCount: messages.length },
  });

  const generation = lfTrace?.generation({
    name: "chat-stream",
    model,
    input: messages,
    modelParameters: { maxTokens, temperature: 0.7 },
  });

  const span = tracer.startSpan("llm.generateChatStream");
  span.setAttribute("llm.model", model);
  span.setAttribute("llm.max_tokens", maxTokens);
  span.setAttribute("llm.streaming", true);
  span.setAttribute("llm.message_count", messages.length);
  if (requestId) span.setAttribute("request.id", requestId);

  let totalContent = "";

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        totalContent += content;
        yield content;
      }
    }

    const durationMs = Date.now() - startTime;
    log.info({ event: "llm.chat_stream.end", durationMs, outputLength: totalContent.length });

    span.setAttribute("llm.duration_ms", durationMs);
    span.setAttribute("llm.output_length", totalContent.length);
    span.setStatus({ code: SpanStatusCode.OK });

    generation?.end({ output: totalContent });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    log.error({ event: "llm.chat_stream.error", durationMs, error: errMsg });

    span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
    span.recordException(error as Error);

    generation?.end({ output: null, statusMessage: errMsg, level: "ERROR" });

    throw error;
  } finally {
    span.end();
    lf?.flushAsync().catch(() => {});
  }
}
