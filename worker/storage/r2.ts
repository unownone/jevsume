import type { JobPersona } from "../../packages/jev/types.ts";
import type { PersonaStore, ResumeStore, StoredResume, VisitorStore } from "./types.ts";

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

function visitorKey(id: string): string {
  return `visitors/${id}`;
}

const VISITOR_COUNT_KEY = "meta/visitor-count.json";

export class R2VisitorStore implements VisitorStore {
  constructor(private readonly bucket: R2Bucket) {}

  async record(visitorId: string): Promise<{ uniqueVisitors: number; created: boolean }> {
    const existing = await this.bucket.head(visitorKey(visitorId));
    if (existing) {
      return { uniqueVisitors: await this.count(), created: false };
    }
    const current = await this.count();
    await this.bucket.put(
      visitorKey(visitorId),
      JSON.stringify({ id: visitorId, at: new Date().toISOString() }),
      { httpMetadata: { contentType: "application/json" } },
    );
    const next = current + 1;
    await this.bucket.put(VISITOR_COUNT_KEY, JSON.stringify({ count: next }), {
      httpMetadata: { contentType: "application/json" },
    });
    return { uniqueVisitors: next, created: true };
  }

  async count(): Promise<number> {
    const object = await this.bucket.get(VISITOR_COUNT_KEY);
    if (object) {
      const data = (await object.json()) as { count?: number };
      if (typeof data.count === "number") {
        return data.count;
      }
    }
    const listed = await this.bucket.list({ prefix: "visitors/" });
    return listed.objects.length;
  }
}
