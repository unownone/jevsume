import { describe, expect, it } from "vitest";
import {
  claudeCodeCli,
  claudeCodeLocalJson,
  claudeDesktopLocalJson,
  codexChatLocalGuide,
  codexCliLocal,
  codexTomlLocal,
  cursorLocalJson,
  hostedMcpJson,
  mcpSnippetForClient,
} from "../src/lib/mcp-snippets.ts";
import { MCP_PATH } from "../src/lib/site-links.ts";

describe("MCP setup snippets", () => {
  it("hosts streamable HTTP at /mcp on the current origin", () => {
    const json = hostedMcpJson("https://app.example");
    expect(json).toContain(`"url": "https://app.example${MCP_PATH}"`);
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
    const codex = mcpSnippetForClient("codex", "local", "https://x");
    expect(codex.text).toContain("[mcp_servers.jevsume]");
    const chat = mcpSnippetForClient("codex-chat", "local", "https://x");
    expect(chat.text).toContain("Settings → MCP servers");
  });
});
