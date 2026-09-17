export type TextSpan = {
  start: number;
  end: number;
  sectionId: string;
  fragmentId: string;
  line: number;
};

export type ReviewResponse = {
  mode: "general" | "job";
  jevScore: {
    value: number;
    breakdown: { key: string; score01: number; weight: number }[];
    confidence: number | null;
  };
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
  suggestions: { id: string; text: string; span?: TextSpan; findingId?: string }[];
  resumeText: string;
  persona: { id: string; title: string; isDefault: boolean };
  telemetry: { serverMs: number; inputTokens: number; costUsd: number };
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

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
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

export async function runReview(
  resumeText: string,
  personaId: string,
): Promise<ReviewResponse> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, personaId }),
  });
  return parseJson(response);
}

export async function recordVisitor(
  visitorId: string,
): Promise<{ uniqueVisitors: number; visitorId: string }> {
  const response = await fetch("/api/visitors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  return parseJson(response);
}
