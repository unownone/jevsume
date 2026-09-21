import { describe, expect, it } from "vitest";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { MCP_PROTOCOL_VERSION } from "../mcp/compact.ts";

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
  return createApp({ engine, visitors: stores.visitors });
}

function rpc(method: string, params?: unknown, id: number | string = 1) {
  return {
    method: "POST" as const,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  };
}

describe("HTTP MCP /mcp", () => {
  it("initializes over Streamable HTTP and lists compact tools", async () => {
    const app = testApp();
    const init = await app.request("/mcp", rpc("initialize", { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {} }));
    expect(init.status).toBe(200);
    const initBody = (await init.json()) as { result: { serverInfo: { name: string }; protocolVersion: string } };
    expect(initBody.result.serverInfo.name).toBe("jevsume");
    expect(initBody.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);

    const listed = await app.request("/mcp", rpc("tools/list", undefined, 2));
    const listedBody = (await listed.json()) as { result: { tools: { name: string }[] } };
    expect(listedBody.result.tools.map((tool) => tool.name)).toEqual([
      "list_job_lenses",
      "get_job_lens",
      "suggest_job_lens",
      "review_resume",
    ]);
  });

  it("reviews a resume against a preset id", async () => {
    const app = testApp();
    const res = await app.request(
      "/mcp",
      rpc("tools/call", {
        name: "review_resume",
        arguments: { resumeText: SAMPLE_RESUME, jobLensId: "preset:swe-staff" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
    expect(body.result.isError).toBeUndefined();
    const compact = JSON.parse(body.result.content[0]?.text ?? "{}") as { mode: string; lens: { id: string } };
    expect(compact.mode).toBe("job");
    expect(compact.lens.id).toBe("preset:swe-staff");
  });

  it("returns 202 for initialized notifications", async () => {
    const app = testApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(res.status).toBe(202);
  });

  it("serves a short install page to browsers and 405 for SSE GET", async () => {
    const app = testApp();
    const html = await app.request("/mcp", { headers: { Accept: "text/html" } });
    expect(html.status).toBe(200);
    expect(await html.text()).toContain("jevsume MCP");

    const sse = await app.request("/mcp", { headers: { Accept: "text/event-stream" } });
    expect(sse.status).toBe(405);
  });

  it("shares the resume review rate limit with /api/reviews", async () => {
    const stores = createMemoryStores();
    const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
    const app = createApp({ engine, visitors: stores.visitors, rateLimiter: new MemoryRateLimiter() });
    const ip = "203.0.113.77";
    const apiHeaders = { "Content-Type": "application/json", "CF-Connecting-IP": ip };
    const mcpHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "CF-Connecting-IP": ip,
    };

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit - 1; i += 1) {
      const res = await app.request("/api/reviews", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
      });
      expect(res.status).toBe(200);
    }

    const mcpOk = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "review_resume", arguments: { resumeText: SAMPLE_RESUME } },
      }),
    });
    expect(mcpOk.status).toBe(200);
    const okBody = (await mcpOk.json()) as { result: { isError?: boolean } };
    expect(okBody.result.isError).toBeUndefined();

    const mcpLimited = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "review_resume", arguments: { resumeText: SAMPLE_RESUME } },
      }),
    });
    expect(mcpLimited.status).toBe(200);
    const limitedBody = (await mcpLimited.json()) as { result: { isError?: boolean; content: { text: string }[] } };
    expect(limitedBody.result.isError).toBe(true);
    const payload = JSON.parse(limitedBody.result.content[0]?.text ?? "{}") as RateLimitErrorBody;
    expect(payload.code).toBe("rate_limited");
    expect(payload.checkpoint).toBe("resumeReview");

    const apiLimited = await app.request("/api/reviews", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ resumeText: SAMPLE_RESUME }),
    });
    expect(apiLimited.status).toBe(429);
  });
});
