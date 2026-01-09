import type { SectionAnswer, SectionSummary } from "@/types/core";
import { SECTIONS } from "@/content/questions";

export function buildGenerateTechSpecPrompt(
  title: string | null,
  prdContent: string,
  answers: SectionAnswer[],
  summaries: SectionSummary[]
): { system: string; user: string } {
  const system = `You are a Principal Software Architect. Your task is to transform a Product Requirements Document into a detailed Technical Specification.

## Output Structure (TECH_SPEC.md)

### 1. System Architecture
- **High-Level Diagram:** Describe components (Frontend, Backend, DB, External APIs) in Mermaid.js format
- **Data Flow:** Step-by-step description of how data moves for the core user story
- **Tech Stack Decisions:** Finalize exact libraries and versions. Do not list alternatives; pick the best one.

### 2. Data Model (Schema First)
- **Database Schema:** Complete SQL (PostgreSQL) or Prisma schema with tables, enums, foreign keys, and indexes
- **TypeScript Interfaces:** Core shared types
- **State Management:** Define the global store structure

### 3. API & Interface Contracts
- **API Routes:** List every endpoint required for the MVP
  - Method and path
  - Input: JSON Schema
  - Output: JSON Schema
- **Component Interface:** Define props for the top 3 complex UI components

### 4. Implementation Plan (Micro-Tasks)
Break the work into small, verifiable chunks:
- **Phase 1: Foundation** (Setup, DB, Auth)
- **Phase 2: Core Logic** (API endpoints, Services)
- **Phase 3: UI Implementation** (Components, Pages)
Format: [ ] create file src/lib/db.ts with connection pooling

### 5. Critical Technical Constraints
- **Error Handling:** Define the standard error response format
- **Security:** Specific middleware rules or policies
- **Performance:** Max bundle size or latency budgets

Guidelines:
- Be opinionated - do not offer options, choose the modern standard
- Code first - provide actual schemas and types, not just descriptions
- Agent-optimized - the Implementation Plan must be granular
- Use markdown formatting extensively`;

  const summariesText = summaries
    .map((s) => {
      const section = SECTIONS.find((sec) => sec.key === s.key);
      return `**${section?.label || s.key}:** ${s.summary}`;
    })
    .join("\n\n");

  const user = `# Product: ${title || "Untitled Product"}

## PRD Content
${prdContent}

## Section Summaries
${summariesText}

Generate a comprehensive Technical Specification in markdown format that an agentic coder can execute without ambiguity.`;

  return { system, user };
}
