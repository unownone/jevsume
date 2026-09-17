import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { TypeSafeHttpError } from "../packages/jev/http.ts";
import { createProvider, MAX_RESUME_CHARS, ReviewEngine } from "./engine.ts";
import { createD1Stores } from "./storage/d1.ts";
import { createMemoryStores } from "./storage/memory.ts";
import type { EvalListFilter, ReviewStores } from "./storage/types.ts";
import { isEvalKind } from "./storage/types.ts";

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

function queryString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function queryNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function queryLimit(value: string | undefined): number | undefined {
  return queryNumber(value);
}

function workerFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis);
}

export function createStores(env: CloudflareBindings): ReviewStores {
  if (env.DB) {
    return createD1Stores(env.DB);
  }
  return createMemoryStores();
}

function engineForEnv(env: CloudflareBindings): ReviewEngine {
  const cached = enginesByEnv.get(env);
  if (cached) {
    return cached;
  }
  const engine = new ReviewEngine(createProvider(env, workerFetch()), createStores(env));
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
    if (err instanceof TypeSafeHttpError) {
      return c.json({ error: err.message }, 502);
    }
    console.error(err);
    return c.json({ error: "Internal error" }, 500);
  });

  app.get("/api/health", (c) => {
    const engine = c.get("engine");
    return c.json({
      ok: true,
      provider: engine.providerId(),
      storage: engine.storageKind(),
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
    const items = await c.get("engine").listPersonas({
      q: queryString(c.req.query("q")),
      tag: queryString(c.req.query("tag")),
      limit: queryLimit(c.req.query("limit")),
    });
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

  app.get("/api/resumes", async (c) => {
    const items = await c.get("engine").listResumes({
      q: queryString(c.req.query("q")),
      source: queryString(c.req.query("source")),
      limit: queryLimit(c.req.query("limit")),
    });
    return c.json({
      items: items.map((resume) => ({
        id: resume.id,
        filename: resume.filename,
        source: resume.source,
        contentHash: resume.contentHash,
        charCount: resume.charCount,
        createdAt: resume.createdAt,
      })),
    });
  });

  app.get("/api/resumes/:id", async (c) => {
    const resume = await c.get("engine").getResume(c.req.param("id"));
    if (!resume) {
      throw new HTTPException(404, { message: "Resume not found" });
    }
    return c.json(resume);
  });

  app.post("/api/reviews", async (c) => {
    const body = await jsonObject(c);
    const resumeText = requiredString(body, "resumeText");
    assertResumeSize(resumeText, "resume text");
    const review = await c.get("engine").generalReview(resumeText, {
      filename: readString(body.filename),
      source: readString(body.source),
    });
    return c.json(review);
  });

  app.post("/api/reviews/job", async (c) => {
    const body = await jsonObject(c);
    const resumeText = requiredString(body, "resumeText");
    const personaId = requiredString(body, "personaId");
    assertResumeSize(resumeText, "resume text");
    const review = await c.get("engine").jobReview(resumeText, personaId, {
      filename: readString(body.filename),
      source: readString(body.source),
    });
    if ("error" in review) {
      throw new HTTPException(404, { message: "Persona not found" });
    }
    return c.json(review);
  });

  app.get("/api/evals", async (c) => {
    const kindParam = queryString(c.req.query("kind"));
    if (kindParam !== undefined && !isEvalKind(kindParam)) {
      throw new HTTPException(400, {
        message: "kind must be general_review, job_review, or persona_build",
      });
    }
    const providerParam = queryString(c.req.query("provider"));
    if (providerParam !== undefined && providerParam !== "jev" && providerParam !== "mock") {
      throw new HTTPException(400, { message: "provider must be jev or mock" });
    }
    const filter: EvalListFilter = {
      kind: kindParam,
      resumeId: queryString(c.req.query("resumeId")),
      personaId: queryString(c.req.query("personaId")),
      provider: providerParam,
      promptHash: queryString(c.req.query("promptHash")),
      minScore: queryNumber(c.req.query("minScore")),
      maxScore: queryNumber(c.req.query("maxScore")),
      limit: queryLimit(c.req.query("limit")),
    };
    const items = await c.get("engine").listEvals(filter);
    return c.json({ items });
  });

  app.get("/api/evals/:id", async (c) => {
    const run = await c.get("engine").getEval(c.req.param("id"));
    if (!run) {
      throw new HTTPException(404, { message: "Eval run not found" });
    }
    return c.json(run);
  });

  return app;
}
