import type { SectionKey, QAItem } from "@/types/core";
import { getSection } from "@/content/questions";

export function buildSummarizePrompt(
  sectionKey: SectionKey,
  qa: QAItem[],
  notes?: string
): { system: string; user: string } {
  const section = getSection(sectionKey);

  const system = `You are a product thinking assistant. Your task is to create a concise summary of the user's answers for a product requirements section.

Guidelines:
- Be concise (2-4 sentences max)
- Capture the key decisions and constraints
- Highlight any notable tradeoffs mentioned
- Use clear, professional language
- Do not add information the user didn't provide`;

  const qaText = qa
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
    .join("\n\n");

  const user = `Section: ${section.label}
Goal: ${section.goal}

## User's Answers
${qaText}

${notes ? `## Additional Notes\n${notes}\n` : ""}

Provide a concise summary (2-4 sentences) that captures the key points from this section.`;

  return { system, user };
}
