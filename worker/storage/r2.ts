import type { JobPersona } from "../../packages/jev/types.ts";
import type { PersonaStore, ResumeStore, StoredResume } from "./types.ts";

function personaKey(id: string): string {
  return `personas/${id}.json`;
}

function resumeKey(id: string): string {
  return `resumes/${id}.json`;
}

export class R2PersonaStore implements PersonaStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(persona: JobPersona): Promise<JobPersona> {
    await this.bucket.put(personaKey(persona.id), JSON.stringify(persona), {
      httpMetadata: { contentType: "application/json" },
    });
    return persona;
  }

  async get(id: string): Promise<JobPersona | null> {
    const object = await this.bucket.get(personaKey(id));
    if (!object) {
      return null;
    }
    return (await object.json()) as JobPersona;
  }

  async list(): Promise<JobPersona[]> {
    const listed = await this.bucket.list({ prefix: "personas/" });
    const personas: JobPersona[] = [];
    for (const object of listed.objects) {
      const got = await this.bucket.get(object.key);
      if (!got) {
        continue;
      }
      personas.push((await got.json()) as JobPersona);
    }
    return personas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class R2ResumeStore implements ResumeStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(resume: StoredResume): Promise<StoredResume> {
    await this.bucket.put(resumeKey(resume.id), JSON.stringify(resume), {
      httpMetadata: { contentType: "application/json" },
    });
    return resume;
  }
}
