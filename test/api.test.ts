import { describe, expect, it } from "vitest";
import { INPUT_TOKEN_USD_PER_MILLION, MockJudgmentProvider } from "../packages/jev/index.ts";
import { createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";

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
});
