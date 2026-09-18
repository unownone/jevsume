import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { TypeSafeHttpError } from "../packages/jev/http.ts";
import { DEFAULT_PERSONA_ID } from "../packages/jev/index.ts";
import {
  RATE_LIMIT_CHECKPOINTS,
  type RateLimitCheckpoint,
  type RateLimitErrorBody,
} from "../shared/rate-limit.ts";
import { createProvider, MAX_RESUME_CHARS, ReviewEngine } from "./engine.ts";
import { MemoryRateLimiter, RateLimitedError, type RateLimiter } from "./rate-limit.ts";
import { createD1Stores } from "./storage/d1.ts";
import { createMemoryStores, MemoryVisitorStore } from "./storage/memory.ts";
import { ensureD1Schema } from "./storage/schema.ts";
import type { EvalListFilter, ReviewStores, VisitorStore } from "./storage/types.ts";
import { isEvalKind } from "./storage/types.ts";

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    engine: ReviewEngine;
    visitors: VisitorStore;
    rateLimiter: RateLimiter;
  };
};

export type CreateAppOptions = {
  engine?: ReviewEngine;
  visitors?: VisitorStore;
  rateLimiter?: RateLimiter;
};

type EnvRuntime = {
  engine: ReviewEngine;
  visitors: VisitorStore;
};

const runtimeByEnv = new WeakMap<object, Promise<EnvRuntime>>();

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

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

function isVisitorId(value: string): boolean {
  return /^[A-Za-z0-9._-]{8,128}$/.test(value);
}

export function createStores(env: CloudflareBindings): ReviewStores {
  if (env.DB) {
    return createD1Stores(env.DB);
  }
  return createMemoryStores();
}

function runtimeForEnv(env: CloudflareBindings): Promise<EnvRuntime> {
  const cached = runtimeByEnv.get(env);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    try {
      if (env.DB) {
        await ensureD1Schema(env.DB);
      }
      const stores = createStores(env);
      return {
        engine: new ReviewEngine(createProvider(env), stores),
        visitors: stores.visitors,
      };
    } catch (error) {
      runtimeByEnv.delete(env);
      throw error;
    }
  })();
  runtimeByEnv.set(env, pending);
  return pending;
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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwarded ??
    "unknown"
  );
}

function assertRateLimit(c: Context<AppEnv>, checkpoint: RateLimitCheckpoint): void {
  const decision = c.get("rateLimiter").consume(checkpoint, clientIp(c.req.raw));
  if (!decision.ok) {
    throw new RateLimitedError(decision);
  }
}

function rateLimitBody(err: RateLimitedError): RateLimitErrorBody {
  const config = RATE_LIMIT_CHECKPOINTS[err.decision.checkpoint];
  return {
    error: err.message,
    code: "rate_limited",
    checkpoint: err.decision.checkpoint,
    limit: err.decision.limit,
    windowSeconds: config.windowMs / 1000,
    retryAfterSeconds: err.decision.retryAfterSeconds,
    resetAt: err.decision.resetAt,
  };
}

export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const rateLimiter = options.rateLimiter ?? new MemoryRateLimiter();
  app.use("/api/*", cors());
  let memoryVisitors: MemoryVisitorStore | undefined;

  app.use("/api/*", async (c, next) => {
    if (options.engine) {
      c.set("engine", options.engine);
      if (options.visitors) {
        c.set("visitors", options.visitors);
      } else {
        memoryVisitors ??= new MemoryVisitorStore();
        c.set("visitors", memoryVisitors);
      }
    } else {
      const runtime = await runtimeForEnv(c.env);
      c.set("engine", runtime.engine);
      c.set("visitors", options.visitors ?? runtime.visitors);
    }
    c.set("rateLimiter", rateLimiter);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof RateLimitedError) {
      const body = rateLimitBody(err);
      return c.json(body, 429, {
        "Retry-After": String(body.retryAfterSeconds),
        "X-RateLimit-Limit": String(body.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(Date.parse(body.resetAt) / 1000)),
      });
    }
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
      storage: engine.storageKind(),
      time: new Date().toISOString(),
    });
  });

  app.get("/api/visitors", async (c) => {
    return c.json({ uniqueVisitors: await c.get("visitors").count() });
  });

  app.post("/api/visitors", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const fromBody = isRecord(body) ? readString(body.visitorId)?.trim() : undefined;
    const fromCookie = readCookie(c.req.header("Cookie"), "jevsume_vid");
    const visitorId =
      (fromBody && isVisitorId(fromBody) ? fromBody : undefined) ??
      (fromCookie && isVisitorId(fromCookie) ? fromCookie : undefined) ??
      crypto.randomUUID();
    const recorded = await c.get("visitors").record(visitorId);
    c.header("Set-Cookie", `jevsume_vid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`);
    return c.json({ uniqueVisitors: recorded.uniqueVisitors, visitorId });
  });

  app.get("/api/job-personas", async (c) => {
    const items = await c.get("engine").listJobPersonas();
    return c.json({ defaultId: DEFAULT_PERSONA_ID, items });
  });

  app.get("/api/job-personas/:id", async (c) => {
    const persona = await c.get("engine").getJobPersona(c.req.param("id"));
    if (!persona) {
      throw new HTTPException(404, { message: "Persona not found" });
    }
    return c.json(persona);
  });

  app.post("/api/personas", async (c) => {
    assertRateLimit(c, "personaCreation");
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
    assertRateLimit(c, "resumeReview");
    const body = await jsonObject(c);
    const resumeText = requiredString(body, "resumeText");
    assertResumeSize(resumeText, "resume text");
    const personaId = readString(body.personaId)?.trim();
    const review = await c.get("engine").review(resumeText, personaId, {
      filename: readString(body.filename),
      source: readString(body.source),
    });
    if ("error" in review) {
      throw new HTTPException(404, { message: "Persona not found" });
    }
    return c.json(review);
  });

  app.post("/api/reviews/job", async (c) => {
    assertRateLimit(c, "resumeReview");
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
