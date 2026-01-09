# Decision Loom

A guided product-thinking workspace that helps users move from an ambiguous product idea to a clear Product Requirements Document (PRD) and a reviewable technical specification.

## Features

- **Guided Flow**: 8 structured sections covering Context, Outcome, Risks, Experience, Flow, Limits, Operations, and Wins
- **AI Assistance**: Non-authoritative suggestions for risks, tradeoffs, and clarifying questions
- **Auto-Summaries**: AI-generated summaries for each completed section
- **PRD Generation**: Generate comprehensive PRD from your structured thinking
- **Tech Spec Generation**: Generate technical specifications based on your PRD
- **Session Persistence**: Work is saved to PostgreSQL with 7-day TTL
- **Export**: Download generated artifacts as Markdown files

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Database**: PostgreSQL + Prisma
- **LLM**: OpenRouter (OpenAI-compatible API)
- **Rate Limiting**: Upstash Redis (optional)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- OpenRouter API key

### Installation

1. Clone and install dependencies:
```bash
cd decision-loom
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/decision_loom
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL_SUGGEST=anthropic/claude-3.5-sonnet
OPENROUTER_MODEL_SUMMARY=anthropic/claude-3.5-sonnet
OPENROUTER_MODEL_GENERATE=anthropic/claude-3.5-sonnet

# Optional: Rate limiting with Upstash
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

4. Set up the database:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start using Decision Loom.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create new session |
| `/api/session` | GET | Get session by ID |
| `/api/session/:id/section` | PATCH | Update section answers |
| `/api/suggest` | POST | Get AI suggestions |
| `/api/summarize` | POST | Generate section summary |
| `/api/generate/prd` | POST | Generate PRD |
| `/api/generate/tech-spec` | POST | Generate Tech Spec |

## Rate Limits (with Upstash)

- `/api/suggest`: 30 requests/minute
- `/api/summarize`: 10 requests/minute
- `/api/generate/*`: 5 requests/minute

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main page
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── RubricSidebar.tsx
│   ├── SectionEditor.tsx
│   ├── ArtifactPreview.tsx
│   └── ...
├── content/
│   └── questions.ts   # Section definitions
├── lib/
│   ├── prisma.ts      # Prisma client
│   ├── ratelimit.ts   # Rate limiting
│   └── env.ts         # Environment validation
├── server/
│   └── llm/           # LLM client and prompts
├── store/
│   └── session.ts     # Zustand store
└── types/
    └── core.ts        # TypeScript types
```

## License

MIT
