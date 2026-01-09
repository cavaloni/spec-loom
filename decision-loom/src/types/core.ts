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

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type Suggestion = {
  id: string;
  type: "risk" | "tradeoff" | "question" | "example";
  text: string;
};
