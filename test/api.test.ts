import { describe, expect, it, vi } from "vitest";
import {
  INPUT_TOKEN_USD_PER_MILLION,
  MockJudgmentProvider,
  TypeSafeHttpError,
} from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { clientIp, createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { D1_SCHEMA_STATEMENTS, ensureD1Schema } from "../worker/storage/schema.ts";
import { VISITOR_COUNT_KEY } from "../worker/storage/kv.ts";
import { createMemoryKv } from "./memory-kv.ts";
import { createSqliteD1, emptyD1Env } from "./sqlite-d1.ts";

function testApp() {
  const stores = createMemoryStores();
  const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
  return createApp({ engine, visitors: stores.visitors });
}

const SAMPLE_RESUME = `Summary
Staff engineer focused on distributed systems.
Experience
- Built a Go event pipeline handling 2M events/day
Skills
Go, Kafka, TypeScript
`;

describe("Hono API", () => {
  it("reports health with the mock provider and memory storage", async () => {
    const app = testApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; provider: string; storage: string };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("mock");
    expect(body.storage).toBe("memory");
  });

  it("rejects a general review without resume text", async () => {
    const app = testApp();
    const res = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("creates a persona and runs a per-job review", async () => {
    const app = testApp();
    const created = await app.request("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Staff Backend Engineer",
        tags: ["golang", "kafka"],
        jobDescription:
          "- 5+ years building event-driven services in Go\n- Production Kafka experience\n- Unlimited PTO and snacks",
      }),
    });
    expect(created.status).toBe(201);
    const persona = (await created.json()) as { id: string; requirements: unknown[] };
    expect(persona.id).toMatch(/[0-9a-f-]{36}/i);

    const listed = await app.request("/api/personas");
    const listBody = (await listed.json()) as { items: { id: string }[] };
    expect(listBody.items.some((item) => item.id === persona.id)).toBe(true);

    const byTag = await app.request("/api/personas?tag=golang");
    const tagBody = (await byTag.json()) as { items: { id: string }[] };
    expect(tagBody.items.some((item) => item.id === persona.id)).toBe(true);

    const fetched = await app.request(`/api/personas/${persona.id}`);
    expect(fetched.status).toBe(200);

    const review = await app.request("/api/reviews/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, personaId: persona.id }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      id: string;
      resumeId: string;
      personaId: string;
      mode: string;
      jevScore: { value: number };
      provider: string;
    };
    expect(body.mode).toBe("job");
    expect(body.provider).toBe("mock");
    expect(body.personaId).toBe(persona.id);
    expect(body.id).toMatch(/[0-9a-f-]{36}/i);
    expect(body.jevScore.value).toBeGreaterThanOrEqual(0);
    expect(body.jevScore.value).toBeLessThanOrEqual(100);

    const evalRes = await app.request(`/api/evals/${body.id}`);
    expect(evalRes.status).toBe(200);
    const evalRun = (await evalRes.json()) as {
      kind: string;
      prompt: Record<string, { type: string }>;
      input: { resume?: { text: string }; persona?: { title: string } };
      output: { answers: Record<string, unknown> };
      review: { jevScore: { value: number } };
    };
    expect(evalRun.kind).toBe("job_review");
    expect(evalRun.input.persona?.title).toBe("Staff Backend Engineer");
    expect(evalRun.input.resume?.text).toContain("Kafka");
    expect(evalRun.prompt.fit_overall?.type).toBe("score");
    expect(Object.keys(evalRun.output.answers).length).toBeGreaterThan(0);
    expect(evalRun.review.jevScore.value).toBe(body.jevScore.value);
  });

  it("reviews against pasted job text without saving a persona", async () => {
    const app = testApp();
    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: SAMPLE_RESUME,
        jobTitle: "Staff Backend Engineer",
        company: "Acme",
        jobUrl: "https://jobs.example.com/staff-backend",
        jobText: "- 5+ years building event-driven services in Go\n- Production Kafka experience",
      }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      mode: string;
      persona: { id: string; title: string; isDefault: boolean };
      jobTarget: { jobTitle?: string; company?: string; jobUrl?: string; jobText?: string };
    };
    expect(body.mode).toBe("job");
    expect(body.persona.isDefault).toBe(false);
    expect(body.persona.title).toBe("Staff Backend Engineer");
    expect(body.jobTarget.jobTitle).toBe("Staff Backend Engineer");
    expect(body.jobTarget.company).toBe("Acme");
    expect(body.jobTarget.jobUrl).toContain("jobs.example.com");
    expect(body.jobTarget.jobText).toContain("Kafka");
  });

  it("returns 404 for an unknown persona", async () => {
    const app = testApp();
    const res = await app.request("/api/reviews/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: SAMPLE_RESUME,
        personaId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("stores extracted resume text and runs a general review", async () => {
    const app = testApp();
    const stored = await app.request("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: SAMPLE_RESUME, source: "paste" }),
    });
    expect(stored.status).toBe(201);
    const resume = (await stored.json()) as {
      id: string;
      contentHash: string;
      sections: unknown[];
    };
    expect(resume.sections.length).toBeGreaterThan(0);
    expect(resume.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      id: string;
      resumeId: string;
      mode: string;
      dimensions: { id: string; score: number; max: number }[];
      jevScore: { value: number };
      validity: number;
      evidence: number;
      hierarchy: { id: string; weight: number | null }[];
      telemetry: { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; requestCount: number };
    };
    expect(body.mode).toBe("general");
    expect(body.resumeId).toBe(resume.id);
    expect(body.hierarchy.length).toBeGreaterThan(0);
    expect(body.hierarchy.reduce((sum, item) => sum + (item.weight ?? 0), 0)).toBe(100);
    expect(body.jevScore.value).toBeGreaterThanOrEqual(0);
    expect(body.jevScore.value).toBeLessThanOrEqual(100);
    expect(body.validity).toBeGreaterThan(0);
    expect(body.evidence).toBeGreaterThan(0);
    expect(body.telemetry.requestCount).toBeGreaterThan(1);
    expect(body.telemetry.totalTokens).toBe(body.telemetry.inputTokens + body.telemetry.outputTokens);

    const lookedUp = await app.request(`/api/resumes/${resume.id}`);
    expect(lookedUp.status).toBe(200);

    const search = await app.request("/api/resumes?q=Kafka");
    const searchBody = (await search.json()) as { items: { id: string }[] };
    expect(searchBody.items.some((item) => item.id === resume.id)).toBe(true);
  });

  it("keeps resume, prompt, input, and output on eval runs for later scoring", async () => {
    const app = testApp();
    const first = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, source: "paste" }),
    });
    const second = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, source: "paste" }),
    });
    const a = (await first.json()) as { id: string; resumeId: string };
    const b = (await second.json()) as { id: string; resumeId: string };
    expect(a.resumeId).toBe(b.resumeId);
    expect(a.id).not.toBe(b.id);

    const listed = await app.request(`/api/evals?kind=general_review&resumeId=${a.resumeId}`);
    const listBody = (await listed.json()) as {
      items: {
        id: string;
        kind: string;
        promptHash: string;
        jevScore: number;
        prompt?: unknown;
      }[];
    };
    expect(listBody.items).toHaveLength(2);
    expect(listBody.items[0]?.prompt).toBeUndefined();
    expect(listBody.items[0]?.promptHash).toBe(listBody.items[1]?.promptHash);
    expect(listBody.items.every((item) => item.kind === "general_review")).toBe(true);

    const full = await app.request(`/api/evals/${a.id}`);
    const run = (await full.json()) as {
      kind: string;
      prompt: Record<string, { type: string; instructions?: string }>;
      input: { resume: { text: string } };
      output: { answers: Record<string, { type: string }> };
      review: { mode: string };
    };
    expect(run.kind).toBe("general_review");
    expect(Object.keys(run.prompt).length).toBeGreaterThan(0);
    expect(Object.values(run.prompt).some((question) => question.type === "score" || question.type === "choice")).toBe(
      true,
    );
    expect(run.input.resume.text).toContain("Staff engineer");
    expect(Object.keys(run.output.answers).length).toBeGreaterThan(0);
    expect(run.review.mode).toBe("general");
  });

  it("records persona-build evals with the compiled questions", async () => {
    const app = testApp();
    const created = await app.request("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Staff Backend Engineer",
        tags: ["golang"],
        jobDescription: "- 5+ years building event-driven services in Go\n- Production Kafka experience",
      }),
    });
    const persona = (await created.json()) as { id: string };
    const listed = await app.request(`/api/evals?kind=persona_build&personaId=${persona.id}`);
    const listBody = (await listed.json()) as { items: { id: string }[] };
    expect(listBody.items).toHaveLength(1);

    const full = await app.request(`/api/evals/${listBody.items[0]?.id}`);
    const run = (await full.json()) as {
      prompt: Record<string, { type: string }>;
      input: { candidates: unknown[] };
      output: { answers: Record<string, unknown> };
      review: null;
    };
    expect(run.review).toBeNull();
    expect(run.input.candidates.length).toBeGreaterThan(0);
    expect(Object.keys(run.prompt).some((key) => key.startsWith("req_"))).toBe(true);
    expect(Object.keys(run.output.answers).length).toBeGreaterThan(0);
  });

  it("rejects an unknown eval kind filter", async () => {
    const app = testApp();
    const res = await app.request("/api/evals?kind=nope");
    expect(res.status).toBe(400);
  });

  it("lists the default job persona and any stored job personas", async () => {
    const app = testApp();
    const empty = await app.request("/api/job-personas");
    expect(empty.status).toBe(200);
    const emptyBody = (await empty.json()) as {
      defaultId: string;
      items: {
        id: string;
        title: string;
        isDefault: boolean;
        summary: string;
        explanation: string;
      }[];
    };
    expect(emptyBody.defaultId).toBe("default");
    expect(emptyBody.items.some((item) => item.isDefault && item.id === "default")).toBe(true);
    expect(emptyBody.items.some((item) => item.id === "preset:swe-staff")).toBe(true);
    expect(emptyBody.items.some((item) => item.id === "preset:pm-mid")).toBe(true);
    expect(emptyBody.items.some((item) => item.id === "preset:sre-senior")).toBe(true);
    expect(emptyBody.items[0]?.explanation.length).toBeGreaterThan(20);

    const created = await app.request("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Staff Backend Engineer",
        tags: ["golang"],
        jobDescription: "- 5+ years building event-driven services in Go",
      }),
    });
    const persona = (await created.json()) as { id: string };
    const listed = await app.request("/api/job-personas");
    const listedBody = (await listed.json()) as { items: { id: string; isDefault: boolean }[] };
    expect(listedBody.items.some((item) => item.id === persona.id && !item.isDefault)).toBe(true);

    const fetched = await app.request(`/api/job-personas/${persona.id}`);
    expect(fetched.status).toBe(200);

    const preset = await app.request("/api/job-personas/preset:swe-staff");
    expect(preset.status).toBe(200);
    const presetBody = (await preset.json()) as { id: string; title: string; isPreset?: boolean; jobDescription?: string };
    expect(presetBody.title).toBe("Staff Backend Engineer");
    expect(presetBody.isPreset).toBe(true);
    expect(presetBody.jobDescription).toContain("Kafka");
  });

  it("reviews a resume against a built-in role preset", async () => {
    const app = testApp();
    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, personaId: "preset:swe-staff" }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      mode: string;
      persona: { id: string; title: string; isDefault: boolean };
      jobTarget?: { jobTitle?: string };
    };
    expect(body.mode).toBe("job");
    expect(body.persona.title).toBe("Staff Backend Engineer");
    expect(body.jobTarget?.jobTitle).toBe("Staff Backend Engineer");
  });

  it("reviews against the default persona without a job-specific posting", async () => {
    const app = testApp();
    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, personaId: "default" }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      mode: string;
      persona: { id: string; title: string; isDefault: boolean };
      resumeText: string;
      findings: { id: string; span: { start: number; end: number; fragmentId: string } }[];
      suggestions: { id: string; span?: { start: number; end: number } }[];
      telemetry: { serverMs: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; requestCount: number };
    };
    expect(body.mode).toBe("general");
    expect(body.persona.isDefault).toBe(true);
    expect(body.resumeText).toContain("Staff engineer");
    expect(body.findings.length).toBeGreaterThan(0);
    for (const finding of body.findings) {
      expect(finding.span.end).toBeGreaterThan(finding.span.start);
      expect(body.resumeText.slice(finding.span.start, finding.span.end).length).toBeGreaterThan(0);
    }
    expect(body.telemetry.serverMs).toBeGreaterThanOrEqual(0);
    expect(body.telemetry.inputTokens).toBeGreaterThan(0);
    expect(body.telemetry.totalTokens).toBe(body.telemetry.inputTokens + body.telemetry.outputTokens);
    expect(body.telemetry.requestCount).toBeGreaterThan(1);
    expect(body.telemetry.costUsd).toBeCloseTo(
      (body.telemetry.inputTokens / 1_000_000) * INPUT_TOKEN_USD_PER_MILLION,
      10,
    );
  });

  it("streams hierarchy then climbing section scores with accumulated token cost", async () => {
    const app = testApp();
    const res = await app.request("/api/reviews/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const events = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; overall?: number; validity?: number; evidence?: number; telemetry?: { totalTokens: number; requestCount: number }; review?: { hierarchy: unknown[]; validity?: number; evidence?: number; telemetry: { requestCount: number } } });
    expect(events.map((event) => event.type)[0]).toBe("hierarchy");
    expect(events.some((event) => event.type === "weights")).toBe(true);
    expect(events.some((event) => event.type === "section" && Array.isArray((event as { roots?: unknown[] }).roots))).toBe(
      true,
    );
    expect(events.at(-1)?.type).toBe("complete");
    const sections = events.filter((event) => event.type === "section");
    const overalls = sections.map((event) => event.overall ?? 0);
    for (let index = 1; index < overalls.length; index += 1) {
      expect(overalls[index] ?? 0).toBeGreaterThanOrEqual(overalls[index - 1] ?? 0);
    }
    const complete = events.at(-1) as {
      type: string;
      review?: {
        hierarchy: unknown[];
        validity?: number;
        evidence?: number;
        telemetry: { requestCount: number; totalTokens: number; costUsd: number };
        suggestions: { recoverPoints?: number }[];
      };
    };
    expect(complete?.review?.hierarchy.length).toBeGreaterThan(0);
    expect(complete?.review?.telemetry.requestCount).toBeGreaterThan(1);
    expect(complete?.review?.suggestions.some((item) => (item.recoverPoints ?? 0) > 0)).toBe(true);
    expect(complete?.review?.validity).toBeGreaterThan(0);
    expect(complete?.review?.evidence).toBeGreaterThan(0);
    expect(sections.some((event) => (event.validity ?? 0) > 0 || (event.evidence ?? 0) > 0)).toBe(true);
  });

  it("counts unique visitors once per visitor id", async () => {
    const app = testApp();
    const first = await app.request("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "visitor-one" }),
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { uniqueVisitors: number; visitorId: string };
    expect(firstBody.visitorId).toBe("visitor-one");
    expect(firstBody.uniqueVisitors).toBe(1);

    const again = await app.request("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "visitor-one" }),
    });
    expect((await again.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);

    const second = await app.request("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "visitor-two" }),
    });
    const secondBody = (await second.json()) as { uniqueVisitors: number };
    expect(secondBody.uniqueVisitors).toBe(2);

    const counted = await app.request("/api/visitors");
    expect((await counted.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(2);
  });

  it("serves visitor counts with shared cache headers and no cookies", async () => {
    const app = testApp();
    const res = await app.request("/api/visitors");
    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control") ?? "";
    expect(cacheControl).toMatch(/public/i);
    expect(cacheControl).toMatch(/max-age=/i);
    expect(cacheControl).toMatch(/s-maxage=/i);
    expect(res.headers.get("CDN-Cache-Control") ?? "").toMatch(/max-age=/i);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("does not let unique visitor writes sit in HTTP caches", async () => {
    const app = testApp();
    const res = await app.request("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "no-cache-visitor" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control") ?? "").toMatch(/no-store/i);
  });

  it("invalidates the cached visitor count after a unique write", async () => {
    const entries = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        async match(request: Request) {
          const hit = entries.get(new URL(request.url).pathname);
          return hit?.clone();
        },
        async put(request: Request, response: Response) {
          entries.set(new URL(request.url).pathname, response);
        },
        async delete(request: Request) {
          return entries.delete(new URL(request.url).pathname);
        },
      },
    });
    try {
      const app = testApp();
      const firstGet = await app.request("http://example.com/api/visitors");
      expect(await firstGet.json()).toEqual({ uniqueVisitors: 0 });

      const posted = await app.request("http://example.com/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "cache-bust-visitor" }),
      });
      expect((await posted.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);

      const secondGet = await app.request("http://example.com/api/visitors");
      expect(await secondGet.json()).toEqual({ uniqueVisitors: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("records unique visitors in KV when the binding is present", async () => {
    const app = createApp();
    const kv = createMemoryKv();
    const db = createSqliteD1();
    const env = { ...emptyD1Env(db), VISITORS: kv };

    const first = await app.request(
      "/api/visitors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "kv-visitor-one" }),
      },
      env,
    );
    expect(first.status).toBe(200);
    expect((await first.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);

    const again = await app.request(
      "/api/visitors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "kv-visitor-one" }),
      },
      env,
    );
    expect((await again.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);

    const second = await app.request(
      "/api/visitors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "kv-visitor-two" }),
      },
      env,
    );
    expect((await second.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(2);

    const counted = await app.request("/api/visitors", {}, env);
    expect((await counted.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(2);

    const d1Row = await db.prepare("SELECT COUNT(*) AS count FROM visitors").first<{ count: number }>();
    expect(d1Row?.count ?? 0).toBe(0);
  });

  it("seeds the KV count from existing D1 visitors once", async () => {
    const app = createApp();
    const kv = createMemoryKv();
    const db = createSqliteD1();
    await ensureD1Schema(db);
    await db
      .prepare(`INSERT INTO visitors (id, created_at) VALUES (?, ?)`)
      .bind("legacy-visitor", "2026-01-01T00:00:00.000Z")
      .run();
    const env = { ...emptyD1Env(db), VISITORS: kv };

    const counted = await app.request("/api/visitors", {}, env);
    expect((await counted.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);
    expect(await kv.get(VISITOR_COUNT_KEY)).toBe("1");
  });

  it("returns JSON 502 when TypeSafe HTTP fails", async () => {
    const engine = new ReviewEngine(
      {
        id: "jev",
        evaluate: async () => {
          throw new TypeSafeHttpError(422, "TypeSafe SystemOne failed (422): bad questions");
        },
      },
      createMemoryStores(),
    );
    const app = createApp({ engine });
    const res = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "TypeSafe SystemOne failed (422): bad questions",
    });
  });

  it("bootstraps an unmigrated D1 so first-run job personas and visitors work", async () => {
    const app = createApp();
    const env = emptyD1Env(createSqliteD1());

    const listed = await app.request("/api/job-personas", {}, env);
    expect(listed.status).toBe(200);
    const catalog = (await listed.json()) as {
      defaultId: string;
      items: { id: string; isDefault: boolean }[];
    };
    expect(catalog.defaultId).toBe("default");
    expect(catalog.items.some((item) => item.isDefault && item.id === "default")).toBe(true);
    expect(catalog.items.some((item) => item.id === "preset:pm-mid")).toBe(true);

    const recorded = await app.request(
      "/api/visitors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: "first-run-visitor" }),
      },
      env,
    );
    expect(recorded.status).toBe(200);
    const body = (await recorded.json()) as { uniqueVisitors: number; visitorId: string };
    expect(body.visitorId).toBe("first-run-visitor");
    expect(body.uniqueVisitors).toBe(1);

    const review = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: SAMPLE_RESUME, personaId: "default" }),
      },
      env,
    );
    expect(review.status).toBe(200);
    const reviewed = (await review.json()) as { mode: string; findings: unknown[] };
    expect(reviewed.mode).toBe("general");
    expect(reviewed.findings.length).toBeGreaterThan(0);
  });

  it("applies D1 schema as separate prepare/run statements, not exec", async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          async run() {
            return { success: true as const, results: [], meta: { changes: 0 } };
          },
        };
      },
      async exec() {
        throw new Error("D1.exec splits multi-line CREATE TABLE and must not be used");
      },
    } as unknown as D1Database;

    await ensureD1Schema(db);
    expect(statements).toEqual([...D1_SCHEMA_STATEMENTS]);
    await ensureD1Schema(db);
    expect(statements).toHaveLength(D1_SCHEMA_STATEMENTS.length);
  });

  it("returns JSON when the judgment provider throws instead of Hono plaintext 500", async () => {
    const engine = new ReviewEngine(
      {
        id: "jev",
        evaluate: async () => {
          throw new TypeError(
            "Illegal invocation: function called with incorrect this reference",
          );
        },
      },
      createMemoryStores(),
    );
    const app = createApp({ engine });
    const res = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type") ?? "").toMatch(/json/i);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("rate limits resume reviews per IP and tells the client when the window restores", async () => {
    const app = testApp();
    const ip = "203.0.113.44";
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    };
    const body = JSON.stringify({ resumeText: SAMPLE_RESUME });

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit; i += 1) {
      const res = await app.request("/api/reviews", { method: "POST", headers, body });
      expect(res.status).toBe(200);
    }

    const limited = await app.request("/api/reviews", { method: "POST", headers, body });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    const payload = (await limited.json()) as RateLimitErrorBody;
    expect(payload.code).toBe("rate_limited");
    expect(payload.checkpoint).toBe("resumeReview");
    expect(payload.limit).toBe(10);
    expect(payload.retryAfterSeconds).toBeGreaterThan(0);
    expect(Date.parse(payload.resetAt)).toBeGreaterThan(Date.now());

    const otherIp = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.9" },
      body,
    });
    expect(otherIp.status).toBe(200);

    const jobLimited = await app.request("/api/reviews/job", {
      method: "POST",
      headers,
      body: JSON.stringify({
        resumeText: SAMPLE_RESUME,
        personaId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    expect(jobLimited.status).toBe(429);
  });

  it("rate limits persona creation per IP independently of reviews", async () => {
    let now = 1_700_000_000_000;
    const engine = new ReviewEngine(
      new MockJudgmentProvider(),
      createMemoryStores(),
    );
    const app = createApp({ engine, rateLimiter: new MemoryRateLimiter(() => now) });
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.55",
    };
    const personaBody = JSON.stringify({
      title: "Staff Backend Engineer",
      tags: ["golang"],
      jobDescription: "- 5+ years building event-driven services in Go",
    });

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.personaCreation.limit; i += 1) {
      const res = await app.request("/api/personas", {
        method: "POST",
        headers,
        body: personaBody,
      });
      expect(res.status).toBe(201);
    }

    const limited = await app.request("/api/personas", {
      method: "POST",
      headers,
      body: personaBody,
    });
    expect(limited.status).toBe(429);
    const payload = (await limited.json()) as RateLimitErrorBody;
    expect(payload.checkpoint).toBe("personaCreation");
    expect(payload.limit).toBe(5);
    expect(payload.retryAfterSeconds).toBe(60);

    const review = await app.request("/api/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(review.status).toBe(200);

    now += 60_001;
    const restored = await app.request("/api/personas", {
      method: "POST",
      headers,
      body: personaBody,
    });
    expect(restored.status).toBe(201);
  });

  it("prefers Cloudflare connecting IP over forwarded headers", () => {
    const request = new Request("https://example.test/api/reviews", {
      headers: {
        "CF-Connecting-IP": "203.0.113.9",
        "X-Real-IP": "192.0.2.1",
        "X-Forwarded-For": "198.51.100.1, 10.0.0.1",
      },
    });
    expect(clientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to the first X-Forwarded-For hop", () => {
    const request = new Request("https://example.test/api/reviews", {
      headers: { "X-Forwarded-For": "198.51.100.1, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("198.51.100.1");
  });
});
