CORE-FLOW sections + labels

4–6 questions per section (enough to guide, not overwhelm)

“Why this matters” hints (optional UI)

Placeholders

A lightweight “quality bar” per section (for completion checks)

// src/content/questions.ts

import type { SectionKey } from "@/types/core";

export type Question = {
  id: string;
  prompt: string;
  placeholder?: string;
  why?: string; // optional helper text for UI
  examples?: string[]; // optional examples shown in UI
};

export type SectionDefinition = {
  key: SectionKey;
  label: string;
  goal: string; // what the user should accomplish in this section
  completionHint: string; // what "good enough" looks like
  questions: Question[];
};

export const SECTIONS: SectionDefinition[] = [
  {
    key: "CONTEXT",
    label: "Context",
    goal: "Anchor on who this is for and the real-world situation driving the need.",
    completionHint:
      "You’ve named a specific user, their moment-of-use, and the constraints shaping behavior.",
    questions: [
      {
        id: "context.primary_user",
        prompt: "Who is the primary user, specifically?",
        placeholder:
          "e.g., on-call engineers in a distributed team, support agents, founders, etc.",
        why:
          "Vague users create vague products. Specificity makes decisions easier.",
      },
      {
        id: "context.moment",
        prompt: "What moment are they in when they feel the pain?",
        placeholder:
          "e.g., starting work after a handoff, responding to an incident, reviewing a PR on mobile",
        why:
          "The moment-of-use determines UI, latency tolerance, and what ‘help’ means.",
      },
      {
        id: "context.current_workaround",
        prompt: "What do they do today (workaround), and what’s frustrating about it?",
        placeholder:
          "e.g., skim Slack + email + tickets, ask coworkers to recap, re-open threads repeatedly",
        why:
          "Workarounds reveal the real job-to-be-done and adoption constraints.",
      },
      {
        id: "context.constraints",
        prompt: "What constraints shape their behavior?",
        placeholder:
          "Time pressure, interruption, fear of mistakes, compliance, device limits, etc.",
        why:
          "Constraints are often more important than features.",
      },
      {
        id: "context.why_now",
        prompt: "Why is this problem important now (timing trigger)?",
        placeholder:
          "Team growth, timezone expansion, more tools, higher complexity, new workflows, etc.",
        why:
          "‘Why now’ prevents building a timeless but low-urgency product.",
      },
    ],
  },

  {
    key: "OUTCOME",
    label: "Outcome",
    goal: "Define success in one sentence and set clear boundaries.",
    completionHint:
      "You have a crisp win statement, a measurable success signal, and explicit non-goals.",
    questions: [
      {
        id: "outcome.problem_statement",
        prompt: "In one sentence, what is the core problem?",
        placeholder:
          "e.g., People lose critical context between shifts and waste time reconstructing what matters.",
        why:
          "This is your anchor. If it’s unclear, everything downstream becomes fuzzy.",
      },
      {
        id: "outcome.win_statement",
        prompt: "In one sentence, what does a win look like for the user?",
        placeholder:
          "e.g., I start my day knowing what matters, why, and exactly where to act in under 5 minutes.",
        why:
          "Wins should be felt, not just measured.",
      },
      {
        id: "outcome.success_metric",
        prompt: "What is one leading indicator that this is working?",
        placeholder:
          "e.g., time-to-orientation, fewer clarifying pings, fewer reopened threads, higher task completion",
        why:
          "A leading indicator lets you learn early without waiting for long-term metrics.",
      },
      {
        id: "outcome.non_goals",
        prompt: "What are 2–3 explicit non-goals for the MVP?",
        placeholder:
          "e.g., not replacing Slack, not doing full project management, not automating decisions",
        why:
          "Non-goals are a senior signal. They prevent accidental scope creep.",
      },
    ],
  },

  {
    key: "RISKS",
    label: "Risks",
    goal: "Identify failure modes and decide what must never happen.",
    completionHint:
      "You’ve ranked the top risks, named unacceptable failures, and chosen mitigations.",
    questions: [
      {
        id: "risks.top3",
        prompt: "What are the top 3 risks or failure modes (ranked)?",
        placeholder:
          "1) … 2) … 3) … (think trust, correctness, adoption, privacy, scope, etc.)",
        why:
          "Ranking forces judgment—some risks matter more than others.",
      },
      {
        id: "risks.unacceptable",
        prompt: "Which failure is unacceptable (the trust-killer)?",
        placeholder:
          "e.g., missing a critical alert, hallucinating a summary, exposing private info, irreversible action",
        why:
          "Naming unacceptable failure shapes guardrails and default behavior.",
      },
      {
        id: "risks.mitigations",
        prompt: "What are the simplest mitigations for the top risks?",
        placeholder:
          "e.g., source citations, user confirmation, read-only mode, minimal permissions, rate limits",
        why:
          "Mitigation thinking shows you can ship safely, not just ideate.",
      },
      {
        id: "risks.scope_risk",
        prompt: "Where is scope most likely to explode—and how do we constrain it?",
        placeholder:
          "e.g., integrations, custom workflows, edge cases, org-specific logic",
        why:
          "Most products fail by trying to satisfy everyone too early.",
      },
    ],
  },

  {
    key: "EXPERIENCE",
    label: "Experience",
    goal: "Design how it should feel: clarity, confidence, and control.",
    completionHint:
      "You’ve described the UX posture, the level of friction, and what’s visible vs hidden.",
    questions: [
      {
        id: "experience.posture",
        prompt: "What should this feel like (tone/posture)?",
        placeholder:
          "e.g., calming, decisive, transparent, minimal; not chatty or overwhelming",
        why:
          "Tone is product behavior. It influences trust and perceived quality.",
      },
      {
        id: "experience.visibility",
        prompt: "What must be visible to the user vs hidden behind the scenes?",
        placeholder:
          "e.g., uncertainty, sources, assumptions, next actions, system status",
        why:
          "Visibility prevents ‘magic’ and reduces mistrust when things go wrong.",
      },
      {
        id: "experience.friction",
        prompt: "Where should we add friction on purpose (and why)?",
        placeholder:
          "e.g., confirmations, diff previews, citations, review steps",
        why:
          "Friction can be a feature when it prevents costly mistakes.",
      },
      {
        id: "experience.escape",
        prompt: "How does the user recover or escape when the product is wrong?",
        placeholder:
          "e.g., undo, edit, ignore, regenerate, report issue, switch modes",
        why:
          "Recovery is often more important than correctness.",
      },
    ],
  },

  {
    key: "FLOW",
    label: "Flow",
    goal: "Define the user journey from intent to result, including recovery paths.",
    completionHint:
      "You can narrate the happy path end-to-end and name at least two alternate paths.",
    questions: [
      {
        id: "flow.happy_path",
        prompt: "Walk through the happy path in 5–7 steps.",
        placeholder:
          "Step 1… Step 2… (start to finish, including the final ‘done’ moment)",
        why:
          "Flow forces concreteness. It reveals missing steps and hidden complexity.",
      },
      {
        id: "flow.alt_paths",
        prompt: "What are 2 alternate paths (common variations)?",
        placeholder:
          "e.g., user has partial info, user is interrupted, user only wants a quick skim",
        why:
          "Alternate paths are where real products get tested.",
      },
      {
        id: "flow.inputs_outputs",
        prompt: "What are the key inputs and outputs for this flow?",
        placeholder:
          "Inputs: … Outputs: … (artifacts, messages, actions, notifications)",
        why:
          "This bridges product intent to implementation boundaries.",
      },
      {
        id: "flow.relevance",
        prompt: "What determines relevance or prioritization (if applicable)?",
        placeholder:
          "e.g., ownership, recent mentions, ticket assignment, severity, user preferences",
        why:
          "Most ‘smart’ products live or die on relevance and prioritization logic.",
      },
    ],
  },

  {
    key: "LIMITS",
    label: "Limits",
    goal: "Acknowledge constraints and choose what to cut.",
    completionHint:
      "You’ve stated MVP limits and what you’re intentionally not building yet.",
    questions: [
      {
        id: "limits.time_team",
        prompt: "What are the constraints (time, team, money, dependencies)?",
        placeholder:
          "e.g., 3 engineers, 6 weeks, must use existing tools, cannot require org-wide rollout",
        why:
          "Constraints create the shape of the MVP.",
      },
      {
        id: "limits.mvp_cut",
        prompt: "What will we intentionally cut from MVP to ship faster?",
        placeholder:
          "e.g., advanced integrations, customization, analytics, long-term storage",
        why:
          "Great MVPs are defined by what they exclude.",
      },
      {
        id: "limits.latency_budget",
        prompt: "What is an acceptable latency/interaction budget?",
        placeholder:
          "e.g., <1s for UI actions; <3s for summaries; async for heavy tasks",
        why:
          "Latency is product behavior—especially when AI or external APIs are involved.",
      },
      {
        id: "limits.data_access",
        prompt: "What data can we realistically access in v1?",
        placeholder:
          "e.g., Slack only; GitHub later; no email in MVP",
        why:
          "Data access constraints define feasibility more than UI does.",
      },
    ],
  },

  {
    key: "OPERATIONS",
    label: "Operations",
    goal: "Define how this runs in production and stays healthy over time.",
    completionHint:
      "You’ve named basic monitoring, rollout strategy, and support posture.",
    questions: [
      {
        id: "ops.monitoring",
        prompt: "What do we monitor to know it’s healthy?",
        placeholder:
          "e.g., error rate, latency, API failures, job backlog, suggestion rejection rate",
        why:
          "If you can’t monitor it, you can’t operate it.",
      },
      {
        id: "ops.rollout",
        prompt: "How do we roll this out safely?",
        placeholder:
          "e.g., internal pilot, feature flags, gradual enablement, opt-in",
        why:
          "Rollout is a product decision and a risk mitigation strategy.",
      },
      {
        id: "ops.support",
        prompt: "What does ‘support’ look like in MVP?",
        placeholder:
          "e.g., feedback button, error reports, minimal admin view, logs only",
        why:
          "Support posture prevents a small MVP from becoming an ops nightmare.",
      },
    ],
  },

  {
    key: "WINS",
    label: "Wins",
    goal: "Define success signals and learning loops.",
    completionHint:
      "You have measurable criteria and a plan for iteration based on user behavior.",
    questions: [
      {
        id: "wins.most_important_metric",
        prompt: "What is the single most important MVP metric?",
        placeholder:
          "e.g., weekly active usage, time-to-first-success, completion rate, retention",
        why:
          "One core metric prevents scattered optimization.",
      },
      {
        id: "wins.leading_signals",
        prompt: "What are 2–3 leading signals that it’s working?",
        placeholder:
          "e.g., fewer pings for context, fewer reopenings, higher completion, lower time-to-orientation",
        why:
          "Leading signals allow fast iteration without waiting months.",
      },
      {
        id: "wins.kill_criteria",
        prompt: "What would tell us to stop, pivot, or rethink?",
        placeholder:
          "e.g., low repeat usage, users distrust summaries, high correction rates, integration friction",
        why:
          "Kill criteria are a senior product signal: you’re not attached to the idea.",
      },
      {
        id: "wins.next_iteration",
        prompt: "What’s the next iteration after MVP if this works?",
        placeholder:
          "e.g., add one integration, add personalization, add team mode, add export formats",
        why:
          "Shows you can think beyond MVP without overbuilding it.",
      },
    ],
  },
];

export const SECTION_ORDER: SectionKey[] = SECTIONS.map((s) => s.key);

export function getSection(key: SectionKey): SectionDefinition {
  const section = SECTIONS.find((s) => s.key === key);
  if (!section) throw new Error(`Unknown section key: ${key}`);
  return section;
}
