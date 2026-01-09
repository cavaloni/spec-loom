# Create Technical Spec: Transform PRD into Engineering Blueprint

## Overview
Act as a Principal Software Architect. Review the provided Product Requirements Document (PRD) and generate a detailed Technical Specification (`TECH_SPEC.md`). Your goal is to make all architectural decisions *now* so the coding agent (Claude Opus) can execute without ambiguity.

## Input Context
- Analyze the `PRD.md` for functional requirements.
- Identify implicit technical constraints (load, security, state management).

## Output File Structure (`TECH_SPEC.md`)

### 1. System Architecture
- **High-Level Diagram:** Mermaid.js chart showing components (Frontend, Backend, DB, External APIs).
- **Data Flow:** Step-by-step description of how data moves for the core user story.
- **Tech Stack Decisions:** Finalize exact libraries (e.g., "Use Zod v3.2," "TanStack Query v5"). *Do not list alternatives; pick the best one.*

### 2. Data Model (Schema First)
- **Database Schema:** Complete SQL (PostgreSQL) or Prisma schema.
    - Define all tables, enums, foreign keys, and indexes.
- **TypeScript Interfaces:** Core shared types (e.g., `User`, `Project`, `Action`).
- **State Management:** Define the global store structure (e.g., Zustand slices or Redux tree).

### 3. API & Interface Contracts
- **API Routes:** List every endpoint required for the MVP.
    - Method: `POST /api/generate`
    - Input: JSON Schema
    - Output: JSON Schema
- **Component Interface:** Define props for the top 3 complex UI components.

### 4. Implementation Plan (Micro-Tasks)
Break the work into small, verifiable chunks for an agent coder.
- **Phase 1: Foundation** (Setup, DB, Auth)
- **Phase 2: Core Logic** (API endpoints, Services)
- **Phase 3: UI Implementation** (Components, Pages)
- *Format:* `[ ] create file src/lib/db.ts with connection pooling`

### 5. Critical Technical Constraints
- **Error Handling:** Define the standard error response format.
- **Security:** specific RLS policies or middleware rules.
- **Performance:** Max bundle size or latency budgets.

## Instructions
1. **Be Opinionated:** Do not offer options ("We could use X or Y"). Choose the modern standard (e.g., Next.js App Router) and stick to it.
2. **Code First:** Provide the actual Prisma schema and TypeScript types, not just descriptions.
3. **Agent-Optimized:** The "Implementation Plan" must be granular. Avoid "Build the dashboard." Use "Create DashboardLayout component with sidebar navigation."