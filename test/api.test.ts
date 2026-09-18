import { describe, expect, it } from "vitest";
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
    expect((await app.request(`/api/evals/${body.id}`)).status).toBe(404);
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
      dimensions: { id: string }[];
      jevScore: { value: number };
    };
    expect(body.mode).toBe("general");
    expect(body.resumeId).toBe(resume.id);
    expect(body.dimensions.some((item) => item.id === "wording")).toBe(true);
    expect((await app.request(`/api/resumes/${resume.id}`)).status).toBe(404);
    expect((await app.request("/api/resumes?q=Kafka")).status).toBe(404);
  });

  it("dedupes stored resumes across reviews without exposing eval dumps", async () => {
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
    expect((await app.request(`/api/evals?kind=general_review&resumeId=${a.resumeId}`)).status).toBe(
      404,
    );
    expect((await app.request(`/api/evals/${a.id}`)).status).toBe(404);
  });

  it("does not expose persona-build eval payloads", async () => {
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
    expect(created.status).toBe(201);
    const persona = (await created.json()) as { id: string };
    expect((await app.request(`/api/evals?kind=persona_build&personaId=${persona.id}`)).status).toBe(
      404,
    );
  });

  it("does not expose eval list filters", async () => {
    const app = testApp();
    const res = await app.request("/api/evals?kind=nope");
    expect(res.status).toBe(404);
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
      telemetry: { serverMs: number; inputTokens: number; costUsd: number };
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
    expect(body.telemetry.costUsd).toBeCloseTo(
      (body.telemetry.inputTokens / 1_000_000) * INPUT_TOKEN_USD_PER_MILLION,
      10,
    );
  });

  it("counts unique visitors once per cookie", async () => {
    const app = testApp();
    const first = await app.request("/api/visitors", { method: "POST" });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { uniqueVisitors: number; visitorId: string };
    expect(firstBody.visitorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(firstBody.uniqueVisitors).toBe(1);

    const again = await app.request("/api/visitors", {
      method: "POST",
      headers: { Cookie: `jevsume_vid=${firstBody.visitorId}` },
    });
    expect((await again.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(1);

    const second = await app.request("/api/visitors", { method: "POST" });
    const secondBody = (await second.json()) as { uniqueVisitors: number };
    expect(secondBody.uniqueVisitors).toBe(2);

    const counted = await app.request("/api/visitors");
    expect((await counted.json() as { uniqueVisitors: number }).uniqueVisitors).toBe(2);
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
      error: "Review service failed",
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

    const recorded = await app.request(
      "/api/visitors",
      {
        method: "POST",
      },
      env,
    );
    expect(recorded.status).toBe(200);
    const body = (await recorded.json()) as { uniqueVisitors: number; visitorId: string };
    expect(body.visitorId).toMatch(/^[0-9a-f-]{36}$/i);
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
});
