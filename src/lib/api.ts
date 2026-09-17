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
    fragments: { id: string; text: string; kind: string }[];
  }[];
  findings: {
    id: string;
    severity: "works" | "partial" | "missing" | "risk";
    title: string;
    detail: string;
  }[];
  requirements?: {
    id: string;
    text: string;
    category: string;
    noul: number;
    verdict: string;
  }[];
  suggestions: { id: string; text: string }[];
  provider: "jev" | "mock";
  model?: string;
};

export type Persona = {
  id: string;
  title: string;
  tags: string[];
  jobDescription: string;
  requirements: {
    id: string;
    text: string;
    category: string;
    noul: number;
  }[];
  createdAt: string;
};

export type PersonaListItem = {
  id: string;
  title: string;
  tags: string[];
  requirementCount: number;
  createdAt: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

export async function fetchHealth(): Promise<{ ok: boolean; provider: string }> {
  const response = await fetch("/api/health");
  return parseJson(response);
}

export async function listPersonas(): Promise<PersonaListItem[]> {
  const response = await fetch("/api/personas");
  const body = await parseJson<{ items: PersonaListItem[] }>(response);
  return body.items;
}

export async function createPersona(input: {
  title: string;
  tags: string[];
  jobDescription: string;
}): Promise<Persona> {
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

export async function generalReview(resumeText: string): Promise<ReviewResponse> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText }),
  });
  return parseJson(response);
}

export async function jobReview(
  resumeText: string,
  personaId: string,
): Promise<ReviewResponse> {
  const response = await fetch("/api/reviews/job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, personaId }),
  });
  return parseJson(response);
}
