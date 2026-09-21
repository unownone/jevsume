import { LOCAL_MCP_COMMAND, MCP_PATH } from "./site-links.ts";

export type McpClientId =
  | "cursor"
  | "claude"
  | "claude-code"
  | "codex"
  | "codex-chat"
  | "generic";

export type McpSnippetMode = "hosted" | "local";

export type McpSnippetFormat = "json" | "toml" | "shell" | "text";

export type McpSnippet = {
  label: string;
  text: string;
  format: McpSnippetFormat;
};

const PLACEHOLDER_KEY = "YOUR_TYPESAFE_API_KEY";

export function hostedMcpJson(origin: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        jevsume: {
          url: `${origin}${MCP_PATH}`,
        },
      },
    },
    null,
    2,
  );
}

export function claudeDesktopLocalJson(windows = false): string {
  const server = windows
    ? {
        command: "cmd",
        args: ["/c", "npx", "-y", "github:unownone/jevsume"],
        env: { TYPESAFE_API_KEY: PLACEHOLDER_KEY },
      }
    : {
        command: "npx",
        args: ["-y", "github:unownone/jevsume"],
        env: { TYPESAFE_API_KEY: PLACEHOLDER_KEY },
      };
  return JSON.stringify({ mcpServers: { jevsume: server } }, null, 2);
}

export function claudeCodeLocalJson(): string {
  return JSON.stringify(
    {
      mcpServers: {
        jevsume: {
          type: "stdio",
          command: "npx",
          args: ["-y", "github:unownone/jevsume"],
          env: { TYPESAFE_API_KEY: PLACEHOLDER_KEY },
        },
      },
    },
    null,
    2,
  );
}

export function claudeCodeCli(windows = false): string {
  if (windows) {
    return `claude mcp add --scope user --transport stdio \\
  --env TYPESAFE_API_KEY=${PLACEHOLDER_KEY} \\
  jevsume -- cmd /c npx -y github:unownone/jevsume`;
  }
  return `claude mcp add --scope user --transport stdio \\
  --env TYPESAFE_API_KEY=${PLACEHOLDER_KEY} \\
  jevsume -- npx -y github:unownone/jevsume`;
}

export function codexTomlLocal(): string {
  return `[mcp_servers.jevsume]
command = "npx"
args = ["-y", "github:unownone/jevsume"]
startup_timeout_sec = 60

[mcp_servers.jevsume.env]
TYPESAFE_API_KEY = "${PLACEHOLDER_KEY}"
`;
}

export function codexCliLocal(): string {
  return `codex mcp add jevsume --env TYPESAFE_API_KEY=${PLACEHOLDER_KEY} -- npx -y github:unownone/jevsume
codex mcp list`;
}

export function codexChatLocalGuide(): string {
  return `ChatGPT desktop, Codex CLI, and the Codex IDE extension share ~/.codex/config.toml.

1. Add the Codex TOML block (see TOML tab) to ~/.codex/config.toml once.
2. ChatGPT desktop: Settings → MCP servers → Add server
   - Name: jevsume
   - Transport: STDIO
   - Command: npx
   - Args: -y and github:unownone/jevsume (separate arguments)
   - Environment: TYPESAFE_API_KEY = your key
3. Save, then Restart. In the composer, /mcp lists connected servers.

IDE extension: Gear → MCP servers → Add server (same STDIO fields) → Restart extension.

ChatGPT web does not read ~/.codex/config.toml.`;
}

export function cursorLocalJson(): string {
  return JSON.stringify(
    {
      mcpServers: {
        jevsume: {
          type: "stdio",
          command: "npx",
          args: ["-y", "github:unownone/jevsume"],
          env: { TYPESAFE_API_KEY: PLACEHOLDER_KEY },
        },
      },
    },
    null,
    2,
  );
}

export function genericLocalJson(): string {
  return claudeDesktopLocalJson(false);
}

export function mcpSnippetForClient(
  client: McpClientId,
  mode: McpSnippetMode,
  origin: string,
  options?: { windowsClaudeDesktop?: boolean },
): McpSnippet {
  if (mode === "hosted") {
    return {
      label: `Hosted streamable HTTP · ${MCP_PATH}`,
      text: hostedMcpJson(origin),
      format: "json",
    };
  }

  switch (client) {
    case "claude":
      return {
        label: `Claude Desktop · ${LOCAL_MCP_COMMAND}`,
        text: claudeDesktopLocalJson(options?.windowsClaudeDesktop ?? false),
        format: "json",
      };
    case "claude-code":
      return {
        label: "Claude Code · CLI (user scope)",
        text: `${claudeCodeCli(options?.windowsClaudeDesktop ?? false)}

# Equivalent JSON (~/.claude.json or project .mcp.json):
${claudeCodeLocalJson()}`,
        format: "text",
      };
    case "codex":
      return {
        label: "Codex CLI · ~/.codex/config.toml",
        text: `${codexTomlLocal()}
# CLI equivalent:
${codexCliLocal()}`,
        format: "text",
      };
    case "codex-chat":
      return {
        label: "Codex Chat · shared ~/.codex/config.toml",
        text: `${codexTomlLocal()}
---
${codexChatLocalGuide()}`,
        format: "text",
      };
    case "cursor":
      return {
        label: "Cursor · .cursor/mcp.json or ~/.cursor/mcp.json",
        text: cursorLocalJson(),
        format: "json",
      };
    default:
      return {
        label: `Generic stdio · ${LOCAL_MCP_COMMAND}`,
        text: genericLocalJson(),
        format: "json",
      };
  }
}
