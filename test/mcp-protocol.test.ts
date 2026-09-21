import { describe, expect, it } from "vitest";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { RATE_LIMIT_CHECKPOINTS, type RateLimitErrorBody } from "../shared/rate-limit.ts";
import { handleJsonRpcMessages } from "../mcp/protocol.ts";
import { callMcpTool, listMcpTools, type McpToolRuntime } from "../mcp/tools.ts";
import { localMcpRuntime } from "../mcp/local.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";
import { formatRateLimitCopy } from "../shared/rate-limit.ts";

const SAMPLE_RESUME = `Jane Doe
Staff Backend Engineer

Summary
Distributed systems engineer who ships event-driven platforms.

Experience
- Built a Go + Kafka pipeline handling 2M events/day and cut p99 latency 40%
- Led 6 engineers on a TypeScript control plane used by 30 product teams

Skills
Go, Kafka, TypeScript, PostgreSQL, Terraform
`;

function mockRuntime(): McpToolRuntime {
  return localMcpRuntime({ mock: true });
}

describe("MCP tools", () => {
  it("exposes four compact tools", () => {
    const names = listMcpTools().map((tool) => tool.name);
    expect(names).toEqual(["list_job_lenses", "get_job_lens", "suggest_job_lens", "review_resume"]);
    for (const tool of listMcpTools()) {
      expect(tool.description.length).toBeLessThan(180);
    }
  });

  it("reviews against a baked-in lens id without echoing the resume", async () => {
    const result = await callMcpTool(
      "review_resume",
      { resumeText: SAMPLE_RESUME, jobLensId: "swe-staff" },
      mockRuntime(),
    );
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0]?.text ?? "{}") as {
      score: number;
      mode: string;
      lens: { id: string };
      findings: unknown[];
      resumeText?: string;
    };
    expect(body.mode).toBe("job");
    expect(body.lens.id).toBe("preset:swe-staff");
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.resumeText).toBeUndefined();
    expect(result.content[0]?.text).not.toContain("hierarchy");
    expect(result.content[0]?.text).not.toContain("telemetry");
  });

  it("reviews pasted job text without a lens id", async () => {
    const result = await callMcpTool(
      "review_resume",
      {
        resumeText: SAMPLE_RESUME,
        jobTitle: "Staff Backend Engineer",
        jobText: "- 5+ years building event-driven services in Go\n- Production Kafka",
      },
      mockRuntime(),
    );
    const body = JSON.parse(result.content[0]?.text ?? "{}") as { mode: string };
    expect(body.mode).toBe("job");
  });

  it("rejects an unknown lens", async () => {
    const result = await callMcpTool(
      "review_resume",
      { resumeText: SAMPLE_RESUME, jobLensId: "preset:not-real" },
      mockRuntime(),
    );
    expect(result.isError).toBe(true);
  });
});

describe("MCP JSON-RPC", () => {
  it("initializes, lists tools, and calls review_resume", async () => {
    const runtime = mockRuntime();
    const [init] = await handleJsonRpcMessages(
      [{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {} } }],
      runtime,
    );
    expect(init?.result).toEqual(
      expect.objectContaining({
        protocolVersion: "2025-03-26",
        serverInfo: expect.objectContaining({ name: "jevsume" }),
      }),
    );

    const [listed] = await handleJsonRpcMessages([{ jsonrpc: "2.0", id: 2, method: "tools/list" }], runtime);
    const tools = (listed?.result as { tools: { name: string }[] }).tools;
    expect(tools.map((tool) => tool.name)).toContain("review_resume");

    const [called] = await handleJsonRpcMessages(
      [
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "list_job_lenses", arguments: { query: "staff" } },
        },
      ],
      runtime,
    );
    const payload = JSON.parse(
      (called?.result as { content: { text: string }[] }).content[0]?.text ?? "{}",
    ) as { items: { id: string }[] };
    expect(payload.items.some((item) => item.id === "preset:swe-staff")).toBe(true);
  });

  it("returns null for notifications", async () => {
    const responses = await handleJsonRpcMessages(
      [{ jsonrpc: "2.0", method: "notifications/initialized" }],
      mockRuntime(),
    );
    expect(responses).toEqual([]);
  });
});

describe("MCP rate limits", () => {
  it("surfaces the shared resumeReview checkpoint as a tool error", async () => {
    let now = 1_700_000_000_000;
    const limiter = new MemoryRateLimiter(() => now);
    const engine = new ReviewEngine(new MockJudgmentProvider(), createMemoryStores());
    const runtime: McpToolRuntime = {
      review: async (input) => {
        const decision = limiter.consume("resumeReview", "203.0.113.10");
        if (!decision.ok) {
          const rateLimit: RateLimitErrorBody = {
            error: formatRateLimitCopy({
              checkpoint: decision.checkpoint,
              limit: decision.limit,
              resetAt: decision.resetAt,
              nowMs: now,
            }),
            code: "rate_limited",
            checkpoint: decision.checkpoint,
            limit: decision.limit,
            windowSeconds: RATE_LIMIT_CHECKPOINTS.resumeReview.windowMs / 1000,
            retryAfterSeconds: decision.retryAfterSeconds,
            resetAt: decision.resetAt,
          };
          return { ok: false, error: rateLimit.error, status: 429, rateLimit };
        }
        const review = await engine.review(input.resumeText, input.jobLensId, {
          source: "mcp",
          jobTarget: input.jobTarget,
        });
        if ("error" in review) {
          return { ok: false, error: "Unknown job lens" };
        }
        return { ok: true, review };
      },
    };

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit; i += 1) {
      const allowed = await callMcpTool("review_resume", { resumeText: SAMPLE_RESUME }, runtime);
      expect(allowed.isError).toBeUndefined();
    }
    const limited = await callMcpTool("review_resume", { resumeText: SAMPLE_RESUME }, runtime);
    expect(limited.isError).toBe(true);
    const body = JSON.parse(limited.content[0]?.text ?? "{}") as RateLimitErrorBody;
    expect(body.code).toBe("rate_limited");
    expect(body.checkpoint).toBe("resumeReview");
    expect(body.limit).toBe(10);
  });
});
