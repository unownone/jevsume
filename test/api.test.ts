import { describe, expect, it } from "vitest";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
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
});
