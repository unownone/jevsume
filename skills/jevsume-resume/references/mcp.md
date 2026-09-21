# jevsume MCP

- **Hosted (no key):** `POST /mcp` on the Worker. Streamable HTTP. No auth yet.
- **Local npx (your TypeSafe key):** copy-paste configs for Claude, Claude Code, Codex, Codex Chat, and Cursor — [`docs/mcp-local.md`](../../docs/mcp-local.md).

```bash
npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY
```

Hosted reviews share the platform `resumeReview` limit (10 / minute / IP) with `POST /api/reviews`.
