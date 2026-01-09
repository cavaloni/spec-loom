import type { SectionKey } from "@/types/core";
import { getSection } from "@/content/questions";

export function buildSuggestPrompt(
  sectionKey: SectionKey,
  currentText: string,
  priorSummaries: Record<string, string>
): { system: string; user: string } {
  const section = getSection(sectionKey);

  const priorContext = Object.entries(priorSummaries)
    .map(([key, summary]) => `## ${key}\n${summary}`)
    .join("\n\n");

  const system = `You are a product thinking assistant helping users develop clear product requirements.

Your role is to suggest ideas, risks, tradeoffs, and clarifying questions that help the user think more deeply. You are NOT authoritative - you offer suggestions that the user can accept, modify, or ignore.

Guidelines:
- Be concise and specific
- Suggest alternatives they may not have considered
- Highlight potential risks or tradeoffs
- Ask clarifying questions when the thinking seems incomplete
- Never overwrite or replace user input
- Format suggestions as actionable items

Current section: ${section.label}
Section goal: ${section.goal}`;

  const user = `${priorContext ? `## Prior Context\n${priorContext}\n\n` : ""}## Current Input
${currentText}

Provide 3-5 suggestions to help improve this thinking. Format as JSON array:
[
  { "type": "risk|tradeoff|question|example", "text": "..." }
]`;

  return { system, user };
}
