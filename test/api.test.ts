import { describe, expect, it } from "vitest";
import { MockJudgmentProvider, TypeSafeHttpError } from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { clientIp, createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";

function testApp() {
  const engine = new ReviewEngine(new MockJudgmentProvider(), createMemoryStores());
  return createApp({ engine });
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

    const full = await app.request(`/api/evals/${a.id}`);
    const run = (await full.json()) as {
      kind: string;
      prompt: Record<string, { type: string; instructions: string }>;
      input: { resume: { text: string } };
      output: { answers: Record<string, { type: string }> };
      review: { mode: string };
    };
    expect(run.kind).toBe("general_review");
    expect(run.prompt.wording?.type).toBe("score");
    expect(run.prompt.wording?.instructions.length).toBeGreaterThan(10);
    expect(run.input.resume.text).toContain("Staff engineer");
    expect(run.output.answers.wording?.type).toBe("score");
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
