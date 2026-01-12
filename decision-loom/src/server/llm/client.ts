import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

let client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    });
  }
  return client;
}

export async function generateCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2000
): Promise<string> {
  const client = getLLMClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

export async function* generateCompletionStream(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2000
): AsyncGenerator<string, void, unknown> {
  const client = getLLMClient();

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
      yield content;
    }
  }
}

export async function* generateChatStream(
  model: string,
  messages: ChatCompletionMessageParam[],
  maxTokens: number = 2000
): AsyncGenerator<string, void, unknown> {
  const client = getLLMClient();

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
      yield content;
    }
  }
}
