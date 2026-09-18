import { describe, expect, it } from "vitest";
import { MockJudgmentProvider, TypeSafeHttpError } from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { clientIp, createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { createSqliteD1, emptyD1Env } from "./sqlite-d1.ts";

const SAMPLE_RESUME = `Summary
Staff engineer focused on distributed systems.
Experience
- Built a Go event pipeline handling 2M events/day
Skills
Go, Kafka, TypeScript
`;

function testApp() {
  const stores = createMemoryStores();
  const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
  return { app: createApp({ engine, visitors: stores.visitors }), stores };
}

describe("public API hardening", () => {
  it("does not expose resume or eval lookup routes", async () => {
    const { app } = testApp();
    const stored = await app.request("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: SAMPLE_RESUME, source: "paste" }),
    });
    expect(stored.status).toBe(201);
    const resume = (await stored.json()) as { id: string };

    const review = await app.request("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    const reviewed = (await review.json()) as { id: string };

    expect((await app.request("/api/resumes")).status).toBe(404);
    expect((await app.request(`/api/resumes/${resume.id}`)).status).toBe(404);
    expect((await app.request("/api/resumes?q=Kafka")).status).toBe(404);
    expect((await app.request("/api/evals")).status).toBe(404);
    expect((await app.request(`/api/evals/${reviewed.id}`)).status).toBe(404);
    expect((await app.request("/api/evals?kind=nope")).status).toBe(404);
  });

  it("ignores client-supplied visitor ids and sets an HttpOnly cookie", async () => {
    const { app } = testApp();
    const first = await app.request("/api/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "attacker-chosen-id" }),
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { visitorId: string; uniqueVisitors: number };
    expect(firstBody.visitorId).not.toBe("attacker-chosen-id");
    expect(firstBody.visitorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(firstBody.uniqueVisitors).toBe(1);
    const cookie = first.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain(`jevsume_vid=${firstBody.visitorId}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");

    const again = await app.request("/api/visitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `jevsume_vid=${firstBody.visitorId}`,
      },
      body: JSON.stringify({ visitorId: "another-attacker-id" }),
    });
    const againBody = (await again.json()) as { visitorId: string; uniqueVisitors: number };
    expect(againBody.visitorId).toBe(firstBody.visitorId);
    expect(againBody.uniqueVisitors).toBe(1);
  });

  it("returns a generic 502 when TypeSafe HTTP fails", async () => {
    const engine = new ReviewEngine(
      {
        id: "jev",
        evaluate: async () => {
          throw new TypeSafeHttpError(422, "TypeSafe SystemOne failed (422): secret-adjacent detail");
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
    expect(await res.json()).toEqual({ error: "Review service failed" });
  });

  it("does not trust X-Forwarded-For or X-Real-IP for rate-limit identity", () => {
    const spoofed = new Request("https://example.test/api/reviews", {
      headers: {
        "X-Real-IP": "192.0.2.1",
        "X-Forwarded-For": "198.51.100.1, 10.0.0.1",
      },
    });
    expect(clientIp(spoofed)).toBe("unknown");

    const cloudflare = new Request("https://example.test/api/reviews", {
      headers: {
        "CF-Connecting-IP": "203.0.113.9",
        "X-Forwarded-For": "198.51.100.1",
      },
    });
    expect(clientIp(cloudflare)).toBe("203.0.113.9");
  });

  it("rate limits resume uploads per IP", async () => {
    let now = 1_700_000_000_000;
    const stores = createMemoryStores();
    const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
    const app = createApp({ engine, rateLimiter: new MemoryRateLimiter(() => now) });
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.80",
    };
    const body = JSON.stringify({ text: SAMPLE_RESUME, source: "paste" });

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeStore.limit; i += 1) {
      const res = await app.request("/api/resumes", { method: "POST", headers, body });
      expect(res.status).toBe(201);
    }

    const limited = await app.request("/api/resumes", { method: "POST", headers, body });
    expect(limited.status).toBe(429);
    const payload = (await limited.json()) as RateLimitErrorBody;
    expect(payload.checkpoint).toBe("resumeStore");
  });

  it("rate limits visitor pings per IP", async () => {
    let now = 1_700_000_000_000;
    const stores = createMemoryStores();
    const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
    const app = createApp({
      engine,
      visitors: stores.visitors,
      rateLimiter: new MemoryRateLimiter(() => now),
    });
    const headers = { "CF-Connecting-IP": "203.0.113.81" };

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.visitorRecord.limit; i += 1) {
      const res = await app.request("/api/visitors", { method: "POST", headers });
      expect(res.status).toBe(200);
    }

    const limited = await app.request("/api/visitors", { method: "POST", headers });
    expect(limited.status).toBe(429);
    const payload = (await limited.json()) as RateLimitErrorBody;
    expect(payload.checkpoint).toBe("visitorRecord");
  });

  it("uses the Cloudflare Rate Limit binding when it is present on env", async () => {
    let hits = 0;
    const binding: RateLimit = {
      async limit() {
        hits += 1;
        return { success: hits <= 1 };
      },
    };
    const stores = createMemoryStores();
    const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
    const app = createApp({ engine, visitors: stores.visitors });
    const env = {
      ...emptyD1Env(createSqliteD1()),
      RATE_LIMIT_RESUME_REVIEW: binding,
    } as CloudflareBindings;
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.90",
    };
    const body = JSON.stringify({ resumeText: SAMPLE_RESUME });

    const first = await app.request("/api/reviews", { method: "POST", headers, body }, env);
    expect(first.status).toBe(200);
    const second = await app.request("/api/reviews", { method: "POST", headers, body }, env);
    expect(second.status).toBe(429);
    expect(hits).toBe(2);
  });
});
