import { describe, expect, it } from "vitest";
import {
  claudeCodeCli,
  claudeCodeLocalJson,
  claudeDesktopLocalJson,
  codexChatLocalGuide,
  codexCliLocal,
  codexTomlLocal,
  cursorLocalJson,
  hostedClaudeCodeJson,
  hostedCodexChatGuide,
  hostedCodexToml,
  hostedCursorJson,
  hostedMcpJson,
  hostedMcpUrl,
  mcpSnippetForClient,
} from "../src/lib/mcp-snippets.ts";
import { MCP_PATH } from "../src/lib/site-links.ts";

const ORIGIN = "https://app.example";

describe("MCP setup snippets", () => {
  it("hosts streamable HTTP at /mcp on the current origin", () => {
    expect(hostedMcpUrl(ORIGIN)).toBe(`https://app.example${MCP_PATH}`);
    expect(hostedMcpJson(ORIGIN)).toContain(`"url": "${hostedMcpUrl(ORIGIN)}"`);
  });

  it("matches Claude Desktop JSON from docs/mcp-local.md", () => {
    const json = claudeDesktopLocalJson(false);
    expect(json).toContain('"command": "npx"');
    expect(json).toContain("github:unownone/jevsume");
    expect(json).toContain("YOUR_TYPESAFE_API_KEY");
    const win = claudeDesktopLocalJson(true);
    expect(win).toContain('"command": "cmd"');
    expect(win).toContain("/c");
  });

  it("matches Claude Code CLI and stdio JSON", () => {
    expect(claudeCodeCli(false)).toContain("claude mcp add");
    expect(claudeCodeCli(false)).toContain("npx -y github:unownone/jevsume");
    expect(claudeCodeLocalJson()).toContain('"type": "stdio"');
  });

  it("matches Codex TOML and CLI from docs", () => {
    expect(codexTomlLocal()).toContain("[mcp_servers.jevsume]");
    expect(codexTomlLocal()).toContain("startup_timeout_sec = 60");
    expect(codexCliLocal()).toContain("codex mcp add jevsume");
  });

  it("documents Codex Chat shared config path", () => {
    expect(codexChatLocalGuide()).toContain("~/.codex/config.toml");
    expect(codexChatLocalGuide()).toContain("ChatGPT web does not read");
  });

  it("matches Cursor stdio JSON", () => {
    expect(cursorLocalJson()).toContain('"type": "stdio"');
    expect(cursorLocalJson()).toContain("npx");
  });

  it("returns client-specific local snippets", () => {
    const codex = mcpSnippetForClient("codex", "local", ORIGIN);
    expect(codex.text).toContain("[mcp_servers.jevsume]");
    const chat = mcpSnippetForClient("codex-chat", "local", ORIGIN);
    expect(chat.text).toContain("Settings → MCP servers");
  });
});

describe("hosted MCP snippets by client", () => {
  it("Claude Code hosted uses http transport JSON", () => {
    const json = hostedClaudeCodeJson(ORIGIN);
    expect(json).toContain('"type": "http"');
    expect(json).toContain(hostedMcpUrl(ORIGIN));
  });

  it("Cursor hosted JSON targets url field", () => {
    expect(hostedCursorJson(ORIGIN)).toContain(hostedMcpUrl(ORIGIN));
  });

  it("Codex hosted uses TOML url entry", () => {
    const toml = hostedCodexToml(ORIGIN);
    expect(toml).toContain(`url = "${hostedMcpUrl(ORIGIN)}"`);
  });

  it("Codex Chat hosted documents shared config and web limitation", () => {
    const text = hostedCodexChatGuide(ORIGIN);
    expect(text).toContain(hostedMcpUrl(ORIGIN));
    expect(text).toContain("ChatGPT web does not read");
  });

  it("mcpSnippetForClient hosted differs per client where required", () => {
    expect(mcpSnippetForClient("codex", "hosted", ORIGIN).format).toBe("toml");
    expect(mcpSnippetForClient("claude-code", "hosted", ORIGIN).text).toContain('"type": "http"');
    expect(mcpSnippetForClient("generic", "hosted", ORIGIN).text).toEqual(hostedMcpJson(ORIGIN));
  });
});
