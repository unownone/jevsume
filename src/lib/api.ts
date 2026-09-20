import {
  hasJobTarget,
  trimJobTarget,
  type JobTarget,
} from "../../shared/job-target.ts";
import {
  isRateLimitErrorBody,
  type RateLimitCheckpoint,
  type RateLimitErrorBody,
} from "../../shared/rate-limit.ts";

export type TextSpan = {
  start: number;
  end: number;
  sectionId: string;
  fragmentId: string;
  line: number;
};

export type ReviewResponse = {
  id?: string;
  resumeId?: string;
  personaId?: string;
  mode: "general" | "job";
  jevScore: {
    value: number;
    breakdown: { key: string; score01: number; weight: number }[];
    confidence: number | null;
  };
  validity?: number;
  evidence?: number;
  dimensions: {
    id: string;
    label: string;
    score: number;
    max: number;
    confidence?: number;
  }[];
  sections: {
    id: string;
    heading: string;
    kind: string;
    text: string;
    quality?: number;
    start: number;
    end: number;
    line: number;
    fragments: { id: string; text: string; kind: string; start: number; end: number; line: number }[];
  }[];
  findings: {
    id: string;
    severity: "works" | "partial" | "missing" | "risk";
    title: string;
    detail: string;
    span: TextSpan;
    suggestedRewrite?: string;
  }[];
  requirements?: {
    id: string;
    text: string;
    category: string;
    noul: number;
    verdict: string;
  }[];
  suggestions: { id: string; text: string; span?: TextSpan; findingId?: string; sectionId?: string; recoverPoints?: number }[];
  resumeText: string;
  persona: { id: string; title: string; isDefault: boolean };
  jobTarget?: {
    jobText?: string;
    jobUrl?: string;
    jobTitle?: string;
    company?: string;
  };
  telemetry: {
    serverMs: number;
    inputTokens: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd: number;
    requestCount?: number;
  };
  hierarchy?: Array<{
    id: string;
    kind: string;
    title: string;
    level: 1 | 2;
    parentId: string | null;
    text: string;
    start: number;
    end: number;
    line: number;
    weight: number | null;
    score01: number | null;
    contribution: number | null;
    status: "pending" | "scored";
    dimensions: {
      id: string;
      label: string;
      score: number;
      max: number;
      weight01: number;
      recoverPoints: number;
    }[];
    children: ReviewResponse["hierarchy"];
  }>;
};

export type JobPersonaItem = {
  id: string;
  title: string;
  tags: string[];
  isDefault: boolean;
  summary: string;
  explanation: string;
  requirementCount: number;
  createdAt: string;
  jobDescription?: string;
};

export type JobPersonaCatalog = {
  defaultId: string;
  items: JobPersonaItem[];
};

export class RateLimitError extends Error {
  readonly checkpoint: RateLimitCheckpoint;
  readonly resetAt: string;
  readonly retryAfterSeconds: number;
  readonly limit: number;
  readonly windowSeconds: number;

  constructor(body: RateLimitErrorBody) {
    super(body.error);
    this.name = "RateLimitError";
    this.checkpoint = body.checkpoint;
    this.resetAt = body.resetAt;
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.limit = body.limit;
    this.windowSeconds = body.windowSeconds;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    if (isRateLimitErrorBody(body)) {
      throw new RateLimitError(body);
    }
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function listJobPersonas(): Promise<JobPersonaCatalog> {
  const response = await fetch("/api/job-personas");
  return parseJson(response);
}

export async function getJobPersona(id: string): Promise<JobPersonaItem> {
  const response = await fetch(`/api/job-personas/${encodeURIComponent(id)}`);
  return parseJson(response);
}

export async function createPersona(input: {
  title: string;
  tags: string[];
  jobDescription: string;
}): Promise<{ id: string; title: string }> {
  const response = await fetch("/api/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function storeResume(text: string, source: string): Promise<void> {
  await fetch("/api/resumes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });
}

export function reviewRequestBody(
  resumeText: string,
  personaId?: string,
  jobTarget?: JobTarget,
): Record<string, string | undefined> {
  const target = hasJobTarget(jobTarget) ? trimJobTarget(jobTarget) : undefined;
  return {
    resumeText,
    personaId,
    jobText: target?.jobText,
    jobUrl: target?.jobUrl,
    jobTitle: target?.jobTitle,
    company: target?.company,
  };
}

export async function runReview(
  resumeText: string,
  personaId?: string,
  jobTarget?: JobTarget,
): Promise<ReviewResponse> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewRequestBody(resumeText, personaId, jobTarget)),
  });
  return parseJson(response);
}

export async function* streamReview(
  resumeText: string,
  personaId?: string,
  jobTarget?: JobTarget,
): AsyncGenerator<Record<string, unknown>> {
  const response = await fetch("/api/reviews/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewRequestBody(resumeText, personaId, jobTarget)),
  });
  if (!response.ok || !response.body) {
    const body: unknown = await response.json().catch(() => null);
    if (isRateLimitErrorBody(body)) {
      throw new RateLimitError(body);
    }
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      yield JSON.parse(trimmed) as Record<string, unknown>;
    }
    if (done) {
      break;
    }
  }
}

export async function fetchVisitorCount(): Promise<number> {
  const response = await fetch("/api/visitors");
  const body = (await parseJson(response)) as { uniqueVisitors: number };
  return body.uniqueVisitors;
}

export async function recordVisitor(
  visitorId: string,
): Promise<{ uniqueVisitors: number; visitorId: string }> {
  const response = await fetch("/api/visitors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
    cache: "no-store",
  });
  return parseJson(response);
}

export type EvalKind = "general_review" | "job_review" | "persona_build";

export type EvalRunSummary = {
  id: string;
  kind: EvalKind;
  resumeId: string | null;
  personaId: string | null;
  provider: "jev" | "mock";
  model: string | null;
  jevScore: number | null;
  promptHash: string;
  createdAt: string;
};

export type EvalRun = EvalRunSummary & {
  input: unknown;
  prompt: Record<string, unknown>;
  output: { model?: string; answers: Record<string, unknown> };
  review: ReviewResponse | null;
};

export async function listEvals(filter: {
  kind?: EvalKind;
  resumeId?: string;
  personaId?: string;
  provider?: "jev" | "mock";
  promptHash?: string;
  minScore?: number;
  maxScore?: number;
} = {}): Promise<EvalRunSummary[]> {
  const params = new URLSearchParams();
  if (filter.kind) params.set("kind", filter.kind);
  if (filter.resumeId) params.set("resumeId", filter.resumeId);
  if (filter.personaId) params.set("personaId", filter.personaId);
  if (filter.provider) params.set("provider", filter.provider);
  if (filter.promptHash) params.set("promptHash", filter.promptHash);
  if (filter.minScore !== undefined) params.set("minScore", String(filter.minScore));
  if (filter.maxScore !== undefined) params.set("maxScore", String(filter.maxScore));
  const query = params.toString();
  const response = await fetch(query ? `/api/evals?${query}` : "/api/evals");
  const body = await parseJson<{ items: EvalRunSummary[] }>(response);
  return body.items;
}

export async function getEval(id: string): Promise<EvalRun> {
  const response = await fetch(`/api/evals/${id}`);
  return parseJson(response);
}
