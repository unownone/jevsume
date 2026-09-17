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
  JudgmentProvider,
  ReviewResponse,
} from "../packages/jev/types.ts";
import { extractRequirementCandidates, groupResumeText } from "./ats/group.ts";
import type { PersonaStore, ResumeStore, StoredResume } from "./storage/types.ts";

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

  async generalReview(resumeText: string): Promise<ReviewResponse> {
    const grouped = groupResumeText(resumeText);
    const result = await this.provider.evaluate({
      state: { resume: grouped },
      questions: buildGeneralReviewQuestions(grouped.sections.map((section) => section.id)),
    });
    return transformGeneralReview({
      result,
      sections: grouped.sections,
      provider: this.provider.id,
    });
  }

  async jobReview(resumeText: string, personaId: string): Promise<ReviewResponse | { error: "not_found" }> {
    const persona = await this.personas.get(personaId);
    if (!persona) {
      return { error: "not_found" };
    }
    const grouped = groupResumeText(resumeText);
    const result = await this.provider.evaluate({
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
