import type {
  JobPersona,
  JsonValue,
  ProviderId,
  Questions,
  ReviewResponse,
  SystemOneResult,
} from "../../packages/jev/types.ts";

export type StorageKind = "d1" | "memory";

export const EVAL_KINDS = ["general_review", "job_review", "persona_build"] as const;
export type EvalKind = (typeof EVAL_KINDS)[number];

export function isEvalKind(value: string): value is EvalKind {
  return (EVAL_KINDS as readonly string[]).includes(value);
}

export function parseEvalKind(value: string): EvalKind {
  if (isEvalKind(value)) {
    return value;
  }
  throw new Error(`Unknown eval kind: ${value}`);
}

export type StoredResume = {
  id: string;
  text: string;
  filename?: string;
  source?: string;
  contentHash: string;
  charCount: number;
  createdAt: string;
};

export type ResumeListFilter = {
  q?: string;
  source?: string;
  limit?: number;
};

export type PersonaListFilter = {
  q?: string;
  tag?: string;
  limit?: number;
};

export type EvalListFilter = {
  kind?: EvalKind;
  resumeId?: string;
  personaId?: string;
  provider?: ProviderId;
  promptHash?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
};

export type StoredEvalRun = {
  id: string;
  kind: EvalKind;
  resumeId: string | null;
  personaId: string | null;
  provider: ProviderId;
  model: string | null;
  jevScore: number | null;
  promptHash: string;
  input: JsonValue;
  prompt: Questions;
  output: SystemOneResult;
  review: ReviewResponse | null;
  usageInputTokens: number | null;
  usageOutputTokens: number | null;
  createdAt: string;
};

export type EvalRunSummary = {
  id: string;
  kind: EvalKind;
  resumeId: string | null;
  personaId: string | null;
  provider: ProviderId;
  model: string | null;
  jevScore: number | null;
  promptHash: string;
  createdAt: string;
};

export type PersonaStore = {
  put(persona: JobPersona): Promise<JobPersona>;
  get(id: string): Promise<JobPersona | null>;
  list(filter?: PersonaListFilter): Promise<JobPersona[]>;
};

export type ResumeStore = {
  put(resume: StoredResume): Promise<StoredResume>;
  get(id: string): Promise<StoredResume | null>;
  getByHash(contentHash: string): Promise<StoredResume | null>;
  list(filter?: ResumeListFilter): Promise<StoredResume[]>;
};

export type EvalStore = {
  put(run: StoredEvalRun): Promise<StoredEvalRun>;
  get(id: string): Promise<StoredEvalRun | null>;
  list(filter?: EvalListFilter): Promise<EvalRunSummary[]>;
};

export type ReviewStores = {
  kind: StorageKind;
  personas: PersonaStore;
  resumes: ResumeStore;
  evals: EvalStore;
};
