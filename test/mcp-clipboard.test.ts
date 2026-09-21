import { describe, expect, it, vi } from "vitest";
import { hostedMcpUrl, hostedMcpJson } from "../src/lib/mcp-snippets.ts";

describe("MCP snippet clipboard payload", () => {
  it("writes hosted JSON including the Worker URL", async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    const origin = "https://app.example";
    const payload = hostedMcpJson(origin);
    await writeText(payload);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(hostedMcpUrl(origin)));
  });
});
