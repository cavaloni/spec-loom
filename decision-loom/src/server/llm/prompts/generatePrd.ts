import type { SectionAnswer, SectionSummary } from "@/types/core";
import { SECTIONS } from "@/content/questions";

export function buildGeneratePrdPrompt(
  title: string | null,
  answers: SectionAnswer[],
  summaries: SectionSummary[],
  productDescription?: string
): { system: string; user: string } {
  const system = `You are a product requirements document generator. Your task is to transform structured product thinking into a comprehensive, professional PRD.

## PRD Structure

Create a well-structured PRD with the following sections:

**1. Executive Summary**
- Concise product overview (2-3 paragraphs)
- Core value proposition
- MVP goal statement

**2. Mission**
- Product mission statement
- Core principles (3-5 key principles)

**3. Target Users**
- Primary user personas
- Technical comfort level
- Key user needs and pain points

**4. MVP Scope**
- **In Scope:** Core functionality for MVP (use ✅ checkboxes)
- **Out of Scope:** Features deferred to future phases (use ❌ checkboxes)

**5. User Stories**
- Primary user stories (5-8 stories) in format: "As a [user], I want to [action], so that [benefit]"

**6. Core Architecture & Patterns**
- High-level architecture approach
- Key design patterns and principles

**7. Tools/Features**
- Detailed feature specifications

**8. Technology Stack**
- Recommended technologies (if mentioned)

**9. Security & Configuration**
- Security considerations
- Configuration approach

**10. Success Criteria**
- MVP success definition
- Functional requirements
- Quality indicators

**11. Implementation Phases**
- Break down into 2-3 phases
- Each phase includes: Goal, Deliverables, Validation criteria

**12. Risks & Mitigations**
- Key risks with specific mitigation strategies

**13. Future Considerations**
- Post-MVP enhancements

Guidelines:
- Use markdown formatting extensively
- Be specific and actionable
- Maintain traceability to the user's original thinking
- Use ✅ for in-scope items, ❌ for out-of-scope
- Keep it professional but readable`;

  const answersText = answers
    .map((a) => {
      const section = SECTIONS.find((s) => s.key === a.key);
      const qaText = a.qa
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");
      return `## ${section?.label || a.key}\n${qaText}${a.notes ? `\n\nNotes: ${a.notes}` : ""}`;
    })
    .join("\n\n---\n\n");

  const summariesText = summaries
    .map((s) => {
      const section = SECTIONS.find((sec) => sec.key === s.key);
      return `**${section?.label || s.key}:** ${s.summary}`;
    })
    .join("\n\n");

  const user = `# Product: ${title || "Untitled Product"}

${productDescription ? `## Product Description\n${productDescription}\n\n` : ""}## Section Summaries
${summariesText}

## Detailed Answers
${answersText}

Generate a comprehensive PRD in markdown format based on the above product thinking.`;

  return { system, user };
}
