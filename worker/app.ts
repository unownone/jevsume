import { Hono } from "hono";
import { cors } from "hono/cors";
import { createProvider, MAX_RESUME_CHARS, ReviewEngine } from "./engine.ts";
import { MemoryPersonaStore, MemoryResumeStore } from "./storage/memory.ts";
import { R2PersonaStore, R2ResumeStore } from "./storage/r2.ts";
import type { PersonaStore, ResumeStore } from "./storage/types.ts";

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    engine: ReviewEngine;
  };
};

export type CreateAppOptions = {
  engine?: ReviewEngine;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function tooLarge(text: string): boolean {
  return text.length > MAX_RESUME_CHARS;
}

export function createStores(env: CloudflareBindings): {
  personas: PersonaStore;
  resumes: ResumeStore;
} {
  if (env.PERSONAS) {
    return {
      personas: new R2PersonaStore(env.PERSONAS),
      resumes: new R2ResumeStore(env.PERSONAS),
    };
  }
  return {
    personas: new MemoryPersonaStore(),
    resumes: new MemoryResumeStore(),
  };
}

export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("/api/*", cors());

  app.use("/api/*", async (c, next) => {
    if (!options.engine) {
      const stores = createStores(c.env);
      const engine = new ReviewEngine(createProvider(c.env), stores.personas, stores.resumes);
      c.set("engine", engine);
    } else {
      c.set("engine", options.engine);
    }
    await next();
  });

  app.get("/api/health", (c) => {
    const engine = c.get("engine");
    return c.json({
      ok: true,
      provider: engine.providerId(),
      time: new Date().toISOString(),
    });
  });

  app.post("/api/personas", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isRecord(body)) {
      return c.json({ error: "Expected JSON body" }, 400);
    }
    const title = readString(body.title)?.trim();
    const jobDescription = readString(body.jobDescription)?.trim();
    if (!title || !jobDescription) {
      return c.json({ error: "title and jobDescription are required" }, 400);
    }
    if (tooLarge(jobDescription)) {
      return c.json({ error: "jobDescription exceeds size limit" }, 413);
    }
    const engine = c.get("engine");
    const persona = await engine.createPersona({
      title,
      jobDescription,
      tags: readTags(body.tags),
    });
    return c.json(persona, 201);
  });

  app.get("/api/personas", async (c) => {
    const engine = c.get("engine");
    const items = await engine.listPersonas();
    return c.json({
      items: items.map((persona) => ({
        id: persona.id,
        title: persona.title,
        tags: persona.tags,
        requirementCount: persona.requirements.length,
        createdAt: persona.createdAt,
      })),
    });
  });

  app.get("/api/personas/:id", async (c) => {
    const engine = c.get("engine");
    const persona = await engine.getPersona(c.req.param("id"));
    if (!persona) {
      return c.json({ error: "Persona not found" }, 404);
    }
    return c.json(persona);
  });

  app.post("/api/resumes", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isRecord(body)) {
      return c.json({ error: "Expected JSON body" }, 400);
    }
    const text = readString(body.text)?.trim();
    if (!text) {
      return c.json({ error: "text is required" }, 400);
    }
    if (tooLarge(text)) {
      return c.json({ error: "resume text exceeds size limit" }, 413);
    }
    const engine = c.get("engine");
    const stored = await engine.persistResume({
      text,
      filename: readString(body.filename),
      source: readString(body.source),
    });
    return c.json(stored, 201);
  });

  app.post("/api/reviews", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isRecord(body)) {
      return c.json({ error: "Expected JSON body" }, 400);
    }
    const resumeText = readString(body.resumeText)?.trim();
    if (!resumeText) {
      return c.json({ error: "resumeText is required" }, 400);
    }
    if (tooLarge(resumeText)) {
      return c.json({ error: "resume text exceeds size limit" }, 413);
    }
    const engine = c.get("engine");
    const review = await engine.generalReview(resumeText);
    return c.json(review);
  });

  app.post("/api/reviews/job", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isRecord(body)) {
      return c.json({ error: "Expected JSON body" }, 400);
    }
    const resumeText = readString(body.resumeText)?.trim();
    const personaId = readString(body.personaId)?.trim();
    if (!resumeText || !personaId) {
      return c.json({ error: "resumeText and personaId are required" }, 400);
    }
    if (tooLarge(resumeText)) {
      return c.json({ error: "resume text exceeds size limit" }, 413);
    }
    const engine = c.get("engine");
    const review = await engine.jobReview(resumeText, personaId);
    if ("error" in review) {
      return c.json({ error: "Persona not found" }, 404);
    }
    return c.json(review);
  });

  return app;
}
