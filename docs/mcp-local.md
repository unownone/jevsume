# Local jevsume MCP (npx)

Run Jev resume review on **your machine** with **your** TypeSafe API key. The host starts a stdio MCP server via `npx`. Reviews go to `https://api.typesafe.ai` — they do not use the hosted Worker rate limit.

Need the public Worker instead? See [readme.md](../readme.md#hosted-no-api-key) (`/mcp`, no key).

## Before you start

1. **Node.js 20+** with `npx` on your `PATH`.
2. A TypeSafe key as `TYPESAFE_API_KEY` ([SDK ENV](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md)).
3. Smoke-test in a terminal (first run clones the repo and can take a minute):

```bash
npx -y github:unownone/jevsume -- --help
```

You should see `jevsume-mcp — local MCP server`. Missing key is expected until the host injects `TYPESAFE_API_KEY`.

Put the key in `env`, not in `args`, so it is not visible in process listings. Never commit a real key.

Shared command the hosts launch:

```text
npx -y github:unownone/jevsume
```

with environment `TYPESAFE_API_KEY=<your key>`.

From a git clone instead of GitHub: `pnpm mcp` (same env).

---

## Claude (Desktop)

Config file:

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Merge this into the existing `mcpServers` object (do not delete other servers):

```json
{
  "mcpServers": {
    "jevsume": {
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume"],
      "env": {
        "TYPESAFE_API_KEY": "YOUR_TYPESAFE_API_KEY"
      }
    }
  }
}
```

**Windows (native, not WSL):** `npx` is a `.cmd` script. Wrap it:

```json
{
  "mcpServers": {
    "jevsume": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "github:unownone/jevsume"],
      "env": {
        "TYPESAFE_API_KEY": "YOUR_TYPESAFE_API_KEY"
      }
    }
  }
}
```

Fully quit and reopen Claude Desktop. Look for tools `list_job_lenses`, `get_job_lens`, `suggest_job_lens`, `review_resume`.

Official connect guide: [MCP local servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers).

---

## Claude Code

User scope (all projects on this machine):

```bash
claude mcp add --scope user --transport stdio \
  --env TYPESAFE_API_KEY=YOUR_TYPESAFE_API_KEY \
  jevsume -- npx -y github:unownone/jevsume
```

Windows (native):

```bash
claude mcp add --scope user --transport stdio \
  --env TYPESAFE_API_KEY=YOUR_TYPESAFE_API_KEY \
  jevsume -- cmd /c npx -y github:unownone/jevsume
```

Check:

```bash
claude mcp list
```

Equivalent JSON (user/local lives in `~/.claude.json`; project-shared is `.mcp.json` in the repo root):

```json
{
  "mcpServers": {
    "jevsume": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume"],
      "env": {
        "TYPESAFE_API_KEY": "YOUR_TYPESAFE_API_KEY"
      }
    }
  }
}
```

`--` is required so Claude Code does not steal flags meant for `npx`. Project `.mcp.json` servers need one interactive approval the first time you open the folder.

Official docs: [Claude Code MCP](https://code.claude.com/docs/en/mcp).

---

## Codex (CLI)

Codex stores MCP in TOML. User-wide:

`~/.codex/config.toml`

Project (trusted repos only): `.codex/config.toml`

```toml
[mcp_servers.jevsume]
command = "npx"
args = ["-y", "github:unownone/jevsume"]
startup_timeout_sec = 60

[mcp_servers.jevsume.env]
TYPESAFE_API_KEY = "YOUR_TYPESAFE_API_KEY"
```

First `npx` from GitHub can exceed the 10s default startup timeout — keep `startup_timeout_sec = 60`.

CLI equivalent:

```bash
codex mcp add jevsume --env TYPESAFE_API_KEY=YOUR_TYPESAFE_API_KEY -- npx -y github:unownone/jevsume
codex mcp list
```

In the Codex TUI, `/mcp` lists connected servers.

Official docs: [Codex MCP](https://developers.openai.com/codex/config-reference) · [ChatGPT MCP](https://learn.chatgpt.com/docs/extend/mcp).

---

## Codex Chat (ChatGPT desktop + IDE)

The ChatGPT desktop app, Codex CLI, and the Codex IDE extension **share** `~/.codex/config.toml` on the same machine. Add the Codex CLI block above once, then restart the client you actually use.

**ChatGPT desktop (Codex Chat)**

1. Settings → **MCP servers** → **Add server**.
2. Name: `jevsume`.
3. Transport: **STDIO**.
4. Command: `npx`
5. Args: `-y` and `github:unownone/jevsume` (separate arguments).
6. Environment: `TYPESAFE_API_KEY` = your key.
7. Save, then **Restart**.

In the composer, `/mcp` shows connected servers.

**IDE extension**

Gear menu → **MCP servers** → **Add server** — same STDIO fields — then **Restart extension**.

ChatGPT **web** does not read `~/.codex/config.toml`. Local npx is desktop / CLI / IDE only.

---

## Cursor

Files ([Cursor MCP](https://cursor.com/docs/mcp)):

| Scope | Path |
| --- | --- |
| This project | `.cursor/mcp.json` |
| Every project | `~/.cursor/mcp.json` |

```json
{
  "mcpServers": {
    "jevsume": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume"],
      "env": {
        "TYPESAFE_API_KEY": "YOUR_TYPESAFE_API_KEY"
      }
    }
  }
}
```

Prefer `${env:TYPESAFE_API_KEY}` if the key is already in your shell environment:

```json
"env": {
  "TYPESAFE_API_KEY": "${env:TYPESAFE_API_KEY}"
}
```

Then: **Settings → Tools & MCP** and confirm `jevsume` is on. If it stays disconnected, reload the window. Logs: Output panel → **MCP Logs**.

Do not omit `-y`. Without it, `npx` prompts and Cursor cannot answer.

---

## After it connects

Ask the agent to review a resume. It should call `review_resume` with `resumeText` and optional `jobLensId` or `jobText`. Lens ids: `default`, `swe-staff`, or `preset:swe-staff`. List them with `list_job_lenses`.

Agent procedure: [`skills/jevsume-resume/SKILL.md`](../skills/jevsume-resume/SKILL.md).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `TypeSafe API key required` | Host is not passing `TYPESAFE_API_KEY`. Use `env`, not only a login-shell export. |
| Spawn `ENOENT` / `npx` not found | Put the full path to `npx` in `command` (`which npx`). On native Windows, use `cmd` `/c` as in Claude Desktop above. |
| First connect times out | GitHub npx runs `prepare` (bundle). Raise startup timeout (Codex: `startup_timeout_sec = 60`) and retry. |
| Server hangs | Confirm `npx -y github:unownone/jevsume -- --help` works in the same environment the host uses (Cursor’s PATH can differ from your terminal). |
| Tools missing | Restart the app. Claude Desktop must fully quit, not only close the window. |
