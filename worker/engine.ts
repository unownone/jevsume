import {
  buildGeneralReviewQuestions,
  buildJobReviewQuestions,
  buildPersonaQuestions,
  DEFAULT_PERSONA,
  DEFAULT_PERSONA_ID,
  estimateInputCostUsd,
  MockJudgmentProvider,
  personaBlurb,
  requirementsFromPersonaAnswers,
  transformGeneralReview,
  transformJobReview,
  TypeSafeHttpProvider,
} from "../packages/jev/index.ts";
import type {
  JobPersona,
  JudgmentProvider,
  ReviewResponse,
  SystemOneRequest,
  SystemOneResult,
} from "../packages/jev/types.ts";
import { extractRequirementCandidates, groupResumeText } from "./ats/group.ts";
import type { PersonaStore, ResumeStore, StoredResume } from "./storage/types.ts";

export type JobPersonaCatalogItem = {
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

function catalogFromDefault(includeDescription = false): JobPersonaCatalogItem {
  const item: JobPersonaCatalogItem = {
    id: DEFAULT_PERSONA.id,
    title: DEFAULT_PERSONA.title,
    tags: [...DEFAULT_PERSONA.tags],
    isDefault: true,
    summary: DEFAULT_PERSONA.summary,
    explanation: DEFAULT_PERSONA.explanation,
    requirementCount: 0,
    createdAt: DEFAULT_PERSONA.createdAt,
  };
  if (includeDescription) {
    item.jobDescription = DEFAULT_PERSONA.jobDescription;
  }
  return item;
}

function catalogFromStored(persona: JobPersona, includeDescription = false): JobPersonaCatalogItem {
  const blurb = personaBlurb(persona);
  const item: JobPersonaCatalogItem = {
    id: persona.id,
    title: persona.title,
    tags: persona.tags,
    isDefault: false,
    summary: blurb.summary,
    explanation: blurb.explanation,
    requirementCount: persona.requirements.length,
    createdAt: persona.createdAt,
  };
  if (includeDescription) {
    item.jobDescription = persona.jobDescription;
  }
  return item;
}

function telemetryFrom(result: SystemOneResult, serverMs: number) {
  const inputTokens = result.usage?.input_tokens ?? 0;
  return {
    serverMs,
    inputTokens,
    costUsd: estimateInputCostUsd(inputTokens),
  };
}

export const MAX_RESUME_CHARS = 120_000;

export type EngineBindings = {
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  TYPESAFE_MODEL?: string;
};

export class ReviewEngine {
  constructor(
    private readonly provider: JudgmentProvider,
    private readonly personas: PersonaStore,
    private readonly resumes: ResumeStore,
  ) {}

  providerId(): JudgmentProvider["id"] {
    return this.provider.id;
  }

  async persistResume(input: {
    text: string;
    filename?: string;
    source?: string;
  }): Promise<StoredResume & { sections: ReturnType<typeof groupResumeText>["sections"] }> {
    const grouped = groupResumeText(input.text);
    const stored: StoredResume = {
      id: crypto.randomUUID(),
      text: grouped.text,
      filename: input.filename,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    await this.resumes.put(stored);
    return { ...stored, sections: grouped.sections };
  }

  async createPersona(input: {
    title: string;
    jobDescription: string;
    tags?: string[];
  }): Promise<JobPersona> {
    const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
    const lines = extractRequirementCandidates(input.jobDescription);
    const candidates = lines.map((text, index) => ({ id: `r${index + 1}`, text }));
    const result = await this.provider.evaluate({
      state: {
        job: {
          title: input.title,
          tags,
          description: input.jobDescription,
        },
        candidates,
      },
      questions: buildPersonaQuestions(candidates.length),
    });
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
    return this.personas.put(persona);
  }

  getPersona(id: string): Promise<JobPersona | null> {
    return this.personas.get(id);
  }

  listPersonas(): Promise<JobPersona[]> {
    return this.personas.list();
  }

  async listJobPersonas(): Promise<JobPersonaCatalogItem[]> {
    const stored = await this.personas.list();
    return [catalogFromDefault(), ...stored.map((persona) => catalogFromStored(persona))];
  }

  async getJobPersona(id: string): Promise<JobPersonaCatalogItem | null> {
    if (id === DEFAULT_PERSONA_ID) {
      return catalogFromDefault(true);
    }
    const persona = await this.personas.get(id);
    if (!persona) {
      return null;
    }
    return catalogFromStored(persona, true);
  }

  async review(resumeText: string, personaId?: string): Promise<ReviewResponse | { error: "not_found" }> {
    if (!personaId || personaId === DEFAULT_PERSONA_ID) {
      return this.generalReview(resumeText);
    }
    return this.jobReview(resumeText, personaId);
  }

  private async evaluate(input: SystemOneRequest): Promise<{ result: SystemOneResult; serverMs: number }> {
    const started = Date.now();
    const result = await this.provider.evaluate(input);
    return { result, serverMs: Date.now() - started };
  }

  async generalReview(resumeText: string): Promise<ReviewResponse> {
    const grouped = groupResumeText(resumeText);
    const { result, serverMs } = await this.evaluate({
      state: { resume: grouped },
      questions: buildGeneralReviewQuestions(grouped.sections.map((section) => section.id)),
    });
    return transformGeneralReview({
      result,
      sections: grouped.sections,
      provider: this.provider.id,
      resumeText: grouped.text,
      telemetry: telemetryFrom(result, serverMs),
    });
  }

  async jobReview(resumeText: string, personaId: string): Promise<ReviewResponse | { error: "not_found" }> {
    const persona = await this.personas.get(personaId);
    if (!persona) {
      return { error: "not_found" };
    }
    const grouped = groupResumeText(resumeText);
    const { result, serverMs } = await this.evaluate({
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
    });
    return transformJobReview({
      result,
      persona,
      sections: grouped.sections,
      provider: this.provider.id,
      resumeText: grouped.text,
      telemetry: telemetryFrom(result, serverMs),
    });
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
