# jevsume MCP

Streamable HTTP (MCP 2025-03-26): `POST /mcp` on the Worker. No auth. OAuth later.

Local stdio (requires TypeSafe key). Copy-paste configs for Claude, Claude Code, Codex, Codex Chat, and Cursor: [docs/mcp-local.md](../../docs/mcp-local.md).

```bash
npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY
```

Cursor / Claude Desktop:

```json
{
  "mcpServers": {
    "jevsume": {
      "url": "https://<jevsume-host>/mcp"
    }
  }
}
```

```json
{
  "mcpServers": {
    "jevsume": {
      "command": "npx",
      "args": ["-y", "github:unownone/jevsume", "--api-key", "<TYPESAFE_API_KEY>"]
    }
  }
}
```

Hosted reviews share the platform `resumeReview` limit (10 / minute / IP) with `POST /api/reviews`.
