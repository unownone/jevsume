import {
  buildGeneralReviewQuestions,
  buildJobReviewQuestions,
  buildPersonaQuestions,
  MockJudgmentProvider,
  requirementsFromPersonaAnswers,
  transformGeneralReview,
  transformJobReview,
  TypeSafeHttpProvider,
} from "../packages/jev/index.ts";
import type {
  JobPersona,
  JsonValue,
  JudgmentProvider,
  Questions,
  ReviewResponse,
  SystemOneRequest,
  SystemOneResult,
} from "../packages/jev/types.ts";
import { extractRequirementCandidates, groupResumeText } from "./ats/group.ts";
import { hashJson, sha256Hex } from "./storage/hash.ts";
import type {
  EvalKind,
  PersonaListFilter,
  ReviewStores,
  StoredEvalRun,
  StoredResume,
  StorageKind,
} from "./storage/types.ts";

export const MAX_RESUME_CHARS = 120_000;

export type EngineBindings = {
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  TYPESAFE_MODEL?: string;
};

export type PersistedReview = ReviewResponse & {
  id: string;
  resumeId: string;
  personaId?: string;
};

export class ReviewEngine {
  constructor(
    private readonly provider: JudgmentProvider,
    private readonly stores: ReviewStores,
  ) {}

  providerId(): JudgmentProvider["id"] {
    return this.provider.id;
  }

  storageKind(): StorageKind {
    return this.stores.kind;
  }

  async persistResume(input: {
    text: string;
    filename?: string;
    source?: string;
  }): Promise<StoredResume & { sections: ReturnType<typeof groupResumeText>["sections"] }> {
    const grouped = groupResumeText(input.text);
    const contentHash = await sha256Hex(grouped.text);
    const existing = await this.stores.resumes.getByHash(contentHash);
    if (existing) {
      return { ...existing, sections: grouped.sections };
    }
    const stored: StoredResume = {
      id: crypto.randomUUID(),
      text: grouped.text,
      filename: input.filename,
      source: input.source,
      contentHash,
      charCount: grouped.text.length,
      createdAt: new Date().toISOString(),
    };
    await this.stores.resumes.put(stored);
    return { ...stored, sections: grouped.sections };
  }

  getResume(id: string): Promise<StoredResume | null> {
    return this.stores.resumes.get(id);
  }

  listResumes(filter?: { q?: string; source?: string; limit?: number }): Promise<StoredResume[]> {
    return this.stores.resumes.list(filter);
  }

  async createPersona(input: {
    title: string;
    jobDescription: string;
    tags?: string[];
  }): Promise<JobPersona> {
    const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
    const lines = extractRequirementCandidates(input.jobDescription);
    const candidates = lines.map((text, index) => ({ id: `r${index + 1}`, text }));
    const request: SystemOneRequest = {
      state: {
        job: {
          title: input.title,
          tags,
          description: input.jobDescription,
        },
        candidates,
      },
      questions: buildPersonaQuestions(candidates.length),
    };
    const result = await this.provider.evaluate(request);
    const requirements = requirementsFromPersonaAnswers({
      candidates,
      answers: result.answers,
    });
    const persona: JobPersona = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      tags,
      jobDescription: input.jobDescription,
      requirements,
      createdAt: new Date().toISOString(),
    };
    await this.stores.personas.put(persona);
    await this.persistEval({
      kind: "persona_build",
      resumeId: null,
      personaId: persona.id,
      request,
      result,
      review: null,
      jevScore: null,
    });
    return persona;
  }

  getPersona(id: string): Promise<JobPersona | null> {
    return this.stores.personas.get(id);
  }

  listPersonas(filter?: PersonaListFilter): Promise<JobPersona[]> {
    return this.stores.personas.list(filter);
  }

  getEval(id: string): ReturnType<ReviewStores["evals"]["get"]> {
    return this.stores.evals.get(id);
  }

  listEvals(filter?: Parameters<ReviewStores["evals"]["list"]>[0]): ReturnType<ReviewStores["evals"]["list"]> {
    return this.stores.evals.list(filter);
  }

  async generalReview(
    resumeText: string,
    meta?: { filename?: string; source?: string },
  ): Promise<PersistedReview> {
    const stored = await this.persistResume({
      text: resumeText,
      filename: meta?.filename,
      source: meta?.source ?? "review",
    });
    const grouped = groupResumeText(resumeText);
    const request: SystemOneRequest = {
      state: { resume: grouped },
      questions: buildGeneralReviewQuestions(grouped.sections.map((section) => section.id)),
    };
    const result = await this.provider.evaluate(request);
    const review = transformGeneralReview({
      result,
      sections: grouped.sections,
      provider: this.provider.id,
    });
    const evalRun = await this.persistEval({
      kind: "general_review",
      resumeId: stored.id,
      personaId: null,
      request,
      result,
      review,
      jevScore: review.jevScore.value,
    });
    return { ...review, id: evalRun.id, resumeId: stored.id };
  }

  async jobReview(
    resumeText: string,
    personaId: string,
    meta?: { filename?: string; source?: string },
  ): Promise<PersistedReview | { error: "not_found" }> {
    const persona = await this.stores.personas.get(personaId);
    if (!persona) {
      return { error: "not_found" };
    }
    const stored = await this.persistResume({
      text: resumeText,
      filename: meta?.filename,
      source: meta?.source ?? "review",
    });
    const grouped = groupResumeText(resumeText);
    const request: SystemOneRequest = {
      state: {
        persona: {
          title: persona.title,
          tags: persona.tags,
          jobDescription: persona.jobDescription,
          requirements: persona.requirements,
        },
        resume: grouped,
      },
      questions: buildJobReviewQuestions(
        persona.requirements.map((requirement) => requirement.id),
        grouped.sections.map((section) => section.id),
      ),
    };
    const result = await this.provider.evaluate(request);
    const review = transformJobReview({
      result,
      persona,
      sections: grouped.sections,
      provider: this.provider.id,
    });
    const evalRun = await this.persistEval({
      kind: "job_review",
      resumeId: stored.id,
      personaId: persona.id,
      request,
      result,
      review,
      jevScore: review.jevScore.value,
    });
    return { ...review, id: evalRun.id, resumeId: stored.id, personaId: persona.id };
  }

  private async persistEval(input: {
    kind: EvalKind;
    resumeId: string | null;
    personaId: string | null;
    request: { state: JsonValue; questions: Questions };
    result: SystemOneResult;
    review: ReviewResponse | null;
    jevScore: number | null;
  }): Promise<StoredEvalRun> {
    const run: StoredEvalRun = {
      id: crypto.randomUUID(),
      kind: input.kind,
      resumeId: input.resumeId,
      personaId: input.personaId,
      provider: this.provider.id,
      model: input.result.model,
      jevScore: input.jevScore,
      promptHash: await hashJson(input.request.questions),
      input: input.request.state,
      prompt: input.request.questions,
      output: input.result,
      review: input.review,
      usageInputTokens: input.result.usage?.input_tokens ?? null,
      usageOutputTokens: input.result.usage?.output_tokens ?? null,
      createdAt: new Date().toISOString(),
    };
    return this.stores.evals.put(run);
  }
}

export function createProvider(env: EngineBindings, fetchImpl?: typeof fetch): JudgmentProvider {
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    return new MockJudgmentProvider();
  }
  return new TypeSafeHttpProvider({
    apiKey,
    baseURL: env.TYPESAFE_BASE_URL,
    model: env.TYPESAFE_MODEL,
    fetch: fetchImpl,
  });
}
