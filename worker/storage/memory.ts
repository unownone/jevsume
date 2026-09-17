import type { JobPersona, ProviderId } from "../../packages/jev/types.ts";
import { clampLimit } from "./limits.ts";
import type {
  EvalKind,
  EvalListFilter,
  EvalRunSummary,
  EvalStore,
  PersonaListFilter,
  PersonaStore,
  ResumeListFilter,
  ResumeStore,
  StoredEvalRun,
  StoredResume,
} from "./types.ts";
import { parseEvalKind } from "./types.ts";

function textMatches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export class MemoryPersonaStore implements PersonaStore {
  private readonly items = new Map<string, JobPersona>();

  async put(persona: JobPersona): Promise<JobPersona> {
    this.items.set(persona.id, persona);
    return persona;
  }

  async get(id: string): Promise<JobPersona | null> {
    return this.items.get(id) ?? null;
  }

  async list(filter: PersonaListFilter = {}): Promise<JobPersona[]> {
    const query = filter.q?.trim();
    const tag = filter.tag?.trim().toLowerCase();
    const limit = clampLimit(filter.limit);
    return [...this.items.values()]
      .filter((persona) => {
        if (query && !textMatches(persona.title, query) && !textMatches(persona.jobDescription, query)) {
          return false;
        }
        if (tag && !persona.tags.some((item) => item.toLowerCase() === tag)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

export class MemoryResumeStore implements ResumeStore {
  private readonly items = new Map<string, StoredResume>();

  async put(resume: StoredResume): Promise<StoredResume> {
    this.items.set(resume.id, resume);
    return resume;
  }

  async get(id: string): Promise<StoredResume | null> {
    return this.items.get(id) ?? null;
  }

  async getByHash(contentHash: string): Promise<StoredResume | null> {
    for (const resume of this.items.values()) {
      if (resume.contentHash === contentHash) {
        return resume;
      }
    }
    return null;
  }

  async list(filter: ResumeListFilter = {}): Promise<StoredResume[]> {
    const query = filter.q?.trim();
    const source = filter.source?.trim();
    const limit = clampLimit(filter.limit);
    return [...this.items.values()]
      .filter((resume) => {
        if (source && resume.source !== source) {
          return false;
        }
        if (
          query &&
          !textMatches(resume.text, query) &&
          !textMatches(resume.filename ?? "", query)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

export class MemoryEvalStore implements EvalStore {
  private readonly items = new Map<string, StoredEvalRun>();

  async put(run: StoredEvalRun): Promise<StoredEvalRun> {
    this.items.set(run.id, run);
    return run;
  }

  async get(id: string): Promise<StoredEvalRun | null> {
    return this.items.get(id) ?? null;
  }

  async list(filter: EvalListFilter = {}): Promise<EvalRunSummary[]> {
    const limit = clampLimit(filter.limit);
    return [...this.items.values()]
      .filter((run) => matchesEvalFilter(run, filter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toEvalSummary);
  }
}

function matchesEvalFilter(run: StoredEvalRun, filter: EvalListFilter): boolean {
  if (filter.kind && run.kind !== filter.kind) {
    return false;
  }
  if (filter.resumeId && run.resumeId !== filter.resumeId) {
    return false;
  }
  if (filter.personaId && run.personaId !== filter.personaId) {
    return false;
  }
  if (filter.provider && run.provider !== filter.provider) {
    return false;
  }
  if (filter.promptHash && run.promptHash !== filter.promptHash) {
    return false;
  }
  if (filter.minScore !== undefined && (run.jevScore === null || run.jevScore < filter.minScore)) {
    return false;
  }
  if (filter.maxScore !== undefined && (run.jevScore === null || run.jevScore > filter.maxScore)) {
    return false;
  }
  return true;
}

function toEvalSummary(run: StoredEvalRun): EvalRunSummary {
  const kind: EvalKind = parseEvalKind(run.kind);
  const provider: ProviderId = run.provider;
  return {
    id: run.id,
    kind,
    resumeId: run.resumeId,
    personaId: run.personaId,
    provider,
    model: run.model,
    jevScore: run.jevScore,
    promptHash: run.promptHash,
    createdAt: run.createdAt,
  };
}

export function createMemoryStores() {
  return {
    kind: "memory" as const,
    personas: new MemoryPersonaStore(),
    resumes: new MemoryResumeStore(),
    evals: new MemoryEvalStore(),
  };
}
