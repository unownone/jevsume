# jevsume MCP setup

Two ways to connect. Both expose the same four tools: `list_job_lenses`, `get_job_lens`, `suggest_job_lens`, `review_resume`.

| Mode | Endpoint | Key | Limit |
| --- | --- | --- | --- |
| Hosted | `https://resume.ikr.one/mcp` (Streamable HTTP) | none | 10 reviews / minute / IP |
| Local | `npx -y github:unownone/jevsume` (stdio) | `TYPESAFE_API_KEY` | your TypeSafe quota |

Local mode needs Node.js 20+. Put the key in `env`, not `args`, and never commit it. The first `npx` run clones and builds the server, so allow about a minute.

## Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (all projects):

```json
{
  "mcpServers": {
    "jevsume": { "url": "https://resume.ikr.one/mcp" }
  }
}
```

Local:

```json
{
  "mcpServers": {
    "jevsume": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume"],
      "env": { "TYPESAFE_API_KEY": "${env:TYPESAFE_API_KEY}" }
    }
  }
}
```

## Claude Code

```bash
claude mcp add --scope user --transport http jevsume https://resume.ikr.one/mcp
```

Local:

```bash
claude mcp add --scope user --transport stdio \
  --env TYPESAFE_API_KEY=YOUR_TYPESAFE_API_KEY \
  jevsume -- npx -y github:unownone/jevsume
```

## Claude Desktop

Merge into `mcpServers` in `claude_desktop_config.json`, then fully quit and reopen:

```json
{
  "mcpServers": {
    "jevsume": {
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume"],
      "env": { "TYPESAFE_API_KEY": "YOUR_TYPESAFE_API_KEY" }
    }
  }
}
```

On native Windows use `"command": "cmd"` and `"args": ["/c", "npx", "-y", "github:unownone/jevsume"]`.

## Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.jevsume]
url = "https://resume.ikr.one/mcp"
```

Local:

```toml
[mcp_servers.jevsume]
command = "npx"
args = ["-y", "github:unownone/jevsume"]
startup_timeout_sec = 60

[mcp_servers.jevsume.env]
TYPESAFE_API_KEY = "YOUR_TYPESAFE_API_KEY"
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `TypeSafe API key required` | The host is not passing `TYPESAFE_API_KEY`. Set it in `env`. |
| `npx` not found | Use the full path from `which npx` as `command`. |
| First connect times out | Raise the startup timeout and retry; the first build is slow. |
| `code: "rate_limited"` | Hosted limit hit. Wait `retryAfterSeconds`, or switch to local mode. |
