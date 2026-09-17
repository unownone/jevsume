import { describe, expect, it } from "vitest";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { clientIp, createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { MemoryPersonaStore, MemoryResumeStore } from "../worker/storage/memory.ts";

function testApp() {
  const engine = new ReviewEngine(
    new MockJudgmentProvider(),
    new MemoryPersonaStore(),
    new MemoryResumeStore(),
  );
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
  it("reports health with the mock provider", async () => {
    const app = testApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; provider: string };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("mock");
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

    const fetched = await app.request(`/api/personas/${persona.id}`);
    expect(fetched.status).toBe(200);

    const review = await app.request("/api/reviews/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME, personaId: persona.id }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      mode: string;
      jevScore: { value: number };
      provider: string;
    };
    expect(body.mode).toBe("job");
    expect(body.provider).toBe("mock");
    expect(body.jevScore.value).toBeGreaterThanOrEqual(0);
    expect(body.jevScore.value).toBeLessThanOrEqual(100);
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
    const resume = (await stored.json()) as { id: string; sections: unknown[] };
    expect(resume.sections.length).toBeGreaterThan(0);

    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(review.status).toBe(200);
    const body = (await review.json()) as {
      mode: string;
      dimensions: { id: string }[];
      jevScore: { value: number };
    };
    expect(body.mode).toBe("general");
    expect(body.dimensions.some((item) => item.id === "wording")).toBe(true);
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
      new MemoryPersonaStore(),
      new MemoryResumeStore(),
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
