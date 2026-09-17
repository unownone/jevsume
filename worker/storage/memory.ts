import type { JobPersona } from "../../packages/jev/types.ts";
import type { PersonaStore, ResumeStore, StoredResume } from "./types.ts";

export class MemoryPersonaStore implements PersonaStore {
  private readonly items = new Map<string, JobPersona>();

  async put(persona: JobPersona): Promise<JobPersona> {
    this.items.set(persona.id, persona);
    return persona;
  }

  async get(id: string): Promise<JobPersona | null> {
    return this.items.get(id) ?? null;
  }

  async list(): Promise<JobPersona[]> {
    return [...this.items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class MemoryResumeStore implements ResumeStore {
  private readonly items = new Map<string, StoredResume>();

  async put(resume: StoredResume): Promise<StoredResume> {
    this.items.set(resume.id, resume);
    return resume;
  }
}
