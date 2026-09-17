import { Hono } from "hono";
import { cors } from "hono/cors";
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

export function createStores(env: CloudflareBindings): ReviewStores {
  if (env.DB) {
    return createD1Stores(env.DB);
  }
  return createMemoryStores();
}

export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("/api/*", cors());

  app.use("/api/*", async (c, next) => {
    if (!options.engine) {
      const stores = createStores(c.env);
      const engine = new ReviewEngine(createProvider(c.env), stores);
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
      storage: engine.storageKind(),
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
    const items = await engine.listPersonas({
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

  app.get("/api/resumes", async (c) => {
    const engine = c.get("engine");
    const items = await engine.listResumes({
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
    const engine = c.get("engine");
    const resume = await engine.getResume(c.req.param("id"));
    if (!resume) {
      return c.json({ error: "Resume not found" }, 404);
    }
    return c.json(resume);
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
    const review = await engine.generalReview(resumeText, {
      filename: readString(body.filename),
      source: readString(body.source),
    });
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
    const review = await engine.jobReview(resumeText, personaId, {
      filename: readString(body.filename),
      source: readString(body.source),
    });
    if ("error" in review) {
      return c.json({ error: "Persona not found" }, 404);
    }
    return c.json(review);
  });

  app.get("/api/evals", async (c) => {
    const kindParam = queryString(c.req.query("kind"));
    if (kindParam !== undefined && !isEvalKind(kindParam)) {
      return c.json({ error: "kind must be general_review, job_review, or persona_build" }, 400);
    }
    const providerParam = queryString(c.req.query("provider"));
    if (providerParam !== undefined && providerParam !== "jev" && providerParam !== "mock") {
      return c.json({ error: "provider must be jev or mock" }, 400);
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
    const engine = c.get("engine");
    const items = await engine.listEvals(filter);
    return c.json({ items });
  });

  app.get("/api/evals/:id", async (c) => {
    const engine = c.get("engine");
    const run = await engine.getEval(c.req.param("id"));
    if (!run) {
      return c.json({ error: "Eval run not found" }, 404);
    }
    return c.json(run);
  });

  return app;
}
