I’m going to make a few architect-level calls to remove ambiguity for an agentic coder:

Even though PRD says “no persistence,” I’m still defining a Postgres + Prisma data model with TTL-based sessions so:

exports are reliable

you can refresh without losing work (optional toggle)

we can capture analytics later
If you truly want zero DB, you can delete the DB layer and keep everything in localStorage — but this spec assumes DB because your tech prompt requires it.

Desktop-first web app, Next.js App Router, minimal auth (none), rate-limited API.

TECH_SPEC.md — Decision Loom (v0.1)
1. System Architecture
High-Level Diagram (Mermaid)
flowchart LR
  U[User Browser] -->|HTTPS| FE[Next.js App Router Frontend]
  FE -->|Route Handlers| API[Next.js API Layer]
  API -->|Prisma| DB[(PostgreSQL)]
  API -->|LLM Provider| LLM[OpenAI-Compatible API]
  API -->|Search (optional)| WEB[External Search Proxy]
  API -->|Rate Limit| RL[Upstash Redis Ratelimit]

  subgraph Next.js App
    FE
    API
  end

Component Responsibilities

Frontend (Next.js)

Multi-panel UI: left rubric nav, center active section editor, right assist panel

Local state for in-progress edits; server persistence via session autosave

Artifact preview + download

API Layer (Route Handlers)

/api/suggest → suggestion generation (non-authoritative)

/api/summarize → section summaries

/api/generate/prd → PRD markdown generation

/api/generate/tech-spec → TECH spec markdown generation (later)

Optional /api/search/suggest → query suggestions (not crawling)

DB (PostgreSQL)

TTL sessions (anonymous)

Section answers, summaries

Generated artifacts (PRD, TECH_SPEC)

LLM Provider

OpenAI-compatible endpoint (use OpenRouter for model flexibility)

Strict prompt boundaries: suggest vs summarize vs generate

Data Flow (Core User Story: produce PRD)

User opens app → frontend requests POST /api/session (or uses existing session id from localStorage).

User fills “Context” questions → frontend autosaves PATCH /api/session/:id/section.

User clicks “Get Suggestions” → frontend calls POST /api/suggest with current section + prior summaries.

User selects suggestion snippets (optional) → merged into their text locally.

User marks section “Complete” → frontend calls POST /api/summarize → summary is stored and displayed read-only.

User completes all sections → user clicks “Generate PRD” → frontend calls POST /api/generate/prd.

API returns markdown → frontend renders preview + enables download → API persists artifact.

Tech Stack Decisions (Pinned)

Runtime / Framework

Node.js 20.x

Next.js 14.2.x (App Router)

React 18.2.x

TypeScript 5.5.x

UI

Tailwind CSS 3.4.x

shadcn/ui components (generated) + Radix UI

lucide-react 0.4xx

State / Data

Zustand 4.5.x (global store)

TanStack Query 5.51.x (server state)

Zod 3.23.x (validation)

DB

PostgreSQL 15+

Prisma 5.18.x

LLM

OpenAI-compatible SDK: openai 4.56.x

Provider: OpenRouter (OpenAI-compatible base URL)

Rate Limiting

Upstash Redis + @upstash/ratelimit 2.0.x

@upstash/redis 1.34.x

Markdown

react-markdown 9.x

remark-gfm 4.x

2. Data Model (Schema First)
Prisma Schema (PostgreSQL)
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SectionKey {
  CONTEXT
  OUTCOME
  RISKS
  EXPERIENCE
  FLOW
  LIMITS
  OPERATIONS
  WINS
}

enum ArtifactType {
  PRD
  TECH_SPEC
}

model Session {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  expiresAt   DateTime
  title       String?  // optional user-provided product name
  activeKey   SectionKey @default(CONTEXT)

  sections    SectionAnswer[]
  summaries   SectionSummary[]
  artifacts   Artifact[]

  @@index([expiresAt])
}

model SectionAnswer {
  id         String    @id @default(cuid())
  sessionId  String
  key        SectionKey
  // array of question/answer pairs stored as JSON for flexibility
  qaJson     Json
  // raw notes blob (optional)
  notes      String?

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  session    Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, key])
  @@index([sessionId, key])
}

model SectionSummary {
  id         String    @id @default(cuid())
  sessionId  String
  key        SectionKey
  summary    String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  session    Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, key])
  @@index([sessionId, key])
}

model Artifact {
  id          String      @id @default(cuid())
  sessionId   String
  type        ArtifactType
  title       String
  contentMd   String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  session     Session     @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, type])
}

TypeScript Shared Types
// src/types/core.ts
export type SectionKey =
  | "CONTEXT"
  | "OUTCOME"
  | "RISKS"
  | "EXPERIENCE"
  | "FLOW"
  | "LIMITS"
  | "OPERATIONS"
  | "WINS";

export type QAItem = {
  questionId: string;
  question: string;
  answer: string;
};

export type SectionAnswer = {
  key: SectionKey;
  qa: QAItem[];
  notes?: string;
};

export type SectionSummary = {
  key: SectionKey;
  summary: string;
};

export type ArtifactType = "PRD" | "TECH_SPEC";

export type Artifact = {
  type: ArtifactType;
  title: string;
  contentMd: string;
};

Global State Management (Zustand Store Structure)

Use Zustand slices to keep it clean:

sessionSlice

sessionId, title, activeKey

setActiveKey, setTitle, ensureSession

answersSlice

answersByKey: Record<SectionKey, SectionAnswer>

updateAnswer(questionId, answer)

setNotes(key, notes)

markSectionComplete(key) (triggers summarize)

summariesSlice

summariesByKey: Record<SectionKey, string>

artifactsSlice

prgArtifact, techSpecArtifact

generatePRD(), generateTechSpec()

3. API & Interface Contracts
Standard JSON Envelope

All API responses use:

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

API Routes (MVP)
1) Create Session

POST /api/session

Input (JSON Schema):

{
  "type": "object",
  "properties": { "title": { "type": "string" } },
  "additionalProperties": false
}


Output:

{
  "ok": true,
  "data": {
    "sessionId": "cuid",
    "expiresAt": "ISO-8601",
    "activeKey": "CONTEXT"
  }
}


Behavior: sets expiresAt = now + 7 days

2) Upsert Section Answers

PATCH /api/session/:id/section

Input:

{
  "type": "object",
  "properties": {
    "key": { "type": "string" },
    "qa": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "questionId": { "type": "string" },
          "question": { "type": "string" },
          "answer": { "type": "string" }
        },
        "required": ["questionId", "question", "answer"],
        "additionalProperties": false
      }
    },
    "notes": { "type": "string" }
  },
  "required": ["key", "qa"],
  "additionalProperties": false
}


Output: { ok: true, data: { saved: true } }

3) Suggest (AI assist)

POST /api/suggest

Input:

{
  "type": "object",
  "properties": {
    "sessionId": { "type": "string" },
    "key": { "type": "string" },
    "currentText": { "type": "string" }
  },
  "required": ["sessionId", "key", "currentText"],
  "additionalProperties": false
}


Output:

{
  "ok": true,
  "data": {
    "suggestions": [
      { "id": "uuid", "type": "risk|tradeoff|question|example", "text": "..." }
    ]
  }
}

4) Summarize Section

POST /api/summarize

Input:

{
  "type": "object",
  "properties": { "sessionId": { "type": "string" }, "key": { "type": "string" } },
  "required": ["sessionId", "key"],
  "additionalProperties": false
}


Output: { ok: true, data: { summary: "..." } }

5) Generate PRD

POST /api/generate/prd

Input:

{
  "type": "object",
  "properties": { "sessionId": { "type": "string" } },
  "required": ["sessionId"],
  "additionalProperties": false
}


Output:

{
  "ok": true,
  "data": {
    "artifact": { "type": "PRD", "title": "PRD", "contentMd": "..." }
  }
}

6) Generate Tech Spec

POST /api/generate/tech-spec

Same as PRD, returns TECH_SPEC artifact.

Top 3 Complex UI Components — Props
A) SectionEditor
type SectionEditorProps = {
  sectionKey: SectionKey;
  title: string;
  questions: { id: string; prompt: string; placeholder?: string }[];
  qa: QAItem[];
  notes?: string;

  onChangeAnswer: (questionId: string, answer: string) => void;
  onChangeNotes: (notes: string) => void;

  onSuggest: () => Promise<void>;
  suggestions: { id: string; type: string; text: string }[];
  onApplySuggestion: (suggestionId: string) => void;

  onComplete: () => Promise<void>;
  isComplete: boolean;
};

B) RubricSidebar
type RubricSidebarProps = {
  activeKey: SectionKey;
  sections: { key: SectionKey; label: string; isComplete: boolean }[];
  onNavigate: (key: SectionKey) => void;
};

C) ArtifactPreview
type ArtifactPreviewProps = {
  artifact?: Artifact;
  isGenerating: boolean;
  onGenerate: () => Promise<void>;
  onDownload: (format: "md") => void;
};

4. Implementation Plan (Micro-Tasks)
Phase 1: Foundation (Setup, DB, Session)

 init Next.js 14 app router project with TypeScript

 add Tailwind CSS + shadcn/ui scaffold

 create prisma/schema.prisma from spec

 add DATABASE_URL and run prisma migrate dev

 create src/lib/prisma.ts Prisma singleton

 create src/lib/env.ts with Zod validation of env vars

 create route POST /api/session to create session with TTL

 implement localStorage session bootstrap in src/lib/session.ts

 add Upstash Redis + ratelimit middleware wrapper src/lib/ratelimit.ts

Phase 2: Core Logic (Answers, Summaries, Suggestions)

 create DB upsert for section answers src/server/sections.ts

 implement PATCH /api/session/:id/section

 define question bank file src/content/questions.ts (per section)

 create POST /api/summarize (LLM + store summary)

 implement POST /api/suggest (LLM returns typed suggestions)

 create src/server/llm/client.ts using OpenAI SDK configured for OpenRouter

 create prompt templates:

 src/server/llm/prompts/suggest.ts

 src/server/llm/prompts/summarize.ts

 src/server/llm/prompts/generatePrd.ts

 implement POST /api/generate/prd returning markdown + storing artifact

Phase 3: UI Implementation (Panels, Editing, Preview)

 build RubricSidebar with completion states

 build SectionEditor with per-question textareas + notes

 implement autosave debounce (800ms) using TanStack Query mutation

 add Suggestions panel inside SectionEditor (apply inserts into notes or answer)

 create read-only summary card per section

 build ArtifactPreview with markdown render + “Download .md”

 create top-level layout with 3-pane grid:

 left sidebar

 center editor

 right assist panel (future: search)

 wire generate PRD button to API and store artifact in Zustand

Phase 4: Polish & Guardrails

 add empty states + progress indicator (e.g., 3/8 complete)

 add error toasts (consistent error envelope)

 add basic analytics events (local only) for completion + generation

 add cron or manual script to delete expired sessions (optional)

5. Critical Technical Constraints
Error Handling Standard

All API endpoints must:

Validate inputs with Zod

Return ApiErr on failure

Use HTTP status codes:

400 validation

401/403 (future)

429 rate-limited

500 unexpected

Example error:

{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": { "field": "sessionId" }
  }
}

Security

MVP security rules:

No auth; sessions are anonymous but unguessable (cuid).

Rate limit all LLM endpoints:

/api/suggest: 30/min per IP

/api/summarize: 10/min per IP

/api/generate/*: 5/min per IP

Never log raw user content in server logs by default.

Use env var validation at boot.

Middleware

src/middleware.ts applies ratelimit to /api/(suggest|summarize|generate) routes.

Performance

Frontend bundle target: < 300KB gz (don’t add heavy UI libs)

/api/suggest latency target: < 2.5s p95

/api/summarize latency target: < 3.5s p95

/api/generate/prd latency target: < 8s p95

Autosave debounce: 800ms and cancel in-flight on fast typing

Environment Variables (Required)
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL_SUGGEST=anthropic/claude-3.5-sonnet
OPENROUTER_MODEL_SUMMARY=anthropic/claude-3.5-sonnet
OPENROUTER_MODEL_GENERATE=anthropic/claude-3.5-sonnet

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...


(You can change models later, but the implementation should treat them as config.)

Notes / Assumptions (Made to Remove Ambiguity)

We persist sessions in Postgres with an expiration timestamp, despite PRD’s “no persistence,” because the tech spec requires schema-first and it makes the MVP more resilient.

“Search assist” is deferred unless you explicitly add it—this tech spec does not implement a web search proxy by default.

We use OpenRouter via the OpenAI SDK to keep provider flexibility while staying implementation-simple.

