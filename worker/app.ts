import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { TypeSafeHttpError } from "../packages/jev/http.ts";
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

const enginesByEnv = new WeakMap<object, ReviewEngine>();

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

function isTypeSafeHttpError(err: unknown): err is TypeSafeHttpError {
  return (
    err instanceof TypeSafeHttpError ||
    (err instanceof Error && err.name === "TypeSafeHttpError")
  );
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

function engineForEnv(env: CloudflareBindings): ReviewEngine {
  const cached = enginesByEnv.get(env);
  if (cached) {
    return cached;
  }
  const stores = createStores(env);
  const engine = new ReviewEngine(
    createProvider(env),
    stores.personas,
    stores.resumes,
  );
  enginesByEnv.set(env, engine);
  return engine;
}

async function jsonObject(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null);
  if (!isRecord(body)) {
    throw new HTTPException(400, { message: "Expected JSON body" });
  }
  return body;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = readString(body[field])?.trim();
  if (!value) {
    throw new HTTPException(400, { message: `${field} is required` });
  }
  return value;
}

function assertResumeSize(text: string, label: string): void {
  if (tooLarge(text)) {
    throw new HTTPException(413, { message: `${label} exceeds size limit` });
  }
}

export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("/api/*", cors());

  app.use("/api/*", async (c, next) => {
    c.set("engine", options.engine ?? engineForEnv(c.env));
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    if (isTypeSafeHttpError(err)) {
      return c.json({ error: err.message }, 502);
    }
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(message, err instanceof Error ? err.stack : err);
    return c.json({ error: "Internal error" }, 500);
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
    const body = await jsonObject(c);
    const title = requiredString(body, "title");
    const jobDescription = requiredString(body, "jobDescription");
    assertResumeSize(jobDescription, "jobDescription");
    const persona = await c.get("engine").createPersona({
      title,
      jobDescription,
      tags: readTags(body.tags),
    });
    return c.json(persona, 201);
  });

  app.get("/api/personas", async (c) => {
    const items = await c.get("engine").listPersonas();
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
    const persona = await c.get("engine").getPersona(c.req.param("id"));
    if (!persona) {
      throw new HTTPException(404, { message: "Persona not found" });
    }
    return c.json(persona);
  });

  app.post("/api/resumes", async (c) => {
    const body = await jsonObject(c);
    const text = requiredString(body, "text");
    assertResumeSize(text, "resume text");
    const stored = await c.get("engine").persistResume({
      text,
      filename: readString(body.filename),
      source: readString(body.source),
    });
    return c.json(stored, 201);
  });

  app.post("/api/reviews", async (c) => {
    const body = await jsonObject(c);
    const resumeText = requiredString(body, "resumeText");
    assertResumeSize(resumeText, "resume text");
    const review = await c.get("engine").generalReview(resumeText);
    return c.json(review);
  });

  app.post("/api/reviews/job", async (c) => {
    const body = await jsonObject(c);
    const resumeText = requiredString(body, "resumeText");
    const personaId = requiredString(body, "personaId");
    assertResumeSize(resumeText, "resume text");
    const review = await c.get("engine").jobReview(resumeText, personaId);
    if ("error" in review) {
      throw new HTTPException(404, { message: "Persona not found" });
    }
    return c.json(review);
  });

  return app;
}
