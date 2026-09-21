# jevsume MCP + Agent Skill

**Date:** 2026-09-21  
**Product:** jevsume — expose Jev resume review to any MCP client and bake in an Agent Skill.

## Intent

Any LLM host (Cursor, Claude, Codex, etc.) should be able to **proctor and improve a resume** using Jev’s typed review, without loading the studio UI or the full review JSON into context.

What the user asked for:

- A **standard MCP server** (tools, Streamable HTTP + stdio).
- A **standard Agent Skill** (SKILL.md).
- **Two ways to connect:** hosted web MCP, and local npx.
- Web MCP on **`/mcp`**, **no auth now** (OAuth later).
- Local npx **requires `TYPESAFE_API_KEY`**.
- Web MCP uses the **same IP rate limits** as `/api/reviews`.
- Review input: **resume text** + optional **job description** or a **baked-in job lens id**.
- **Minimum context:** compact tool I/O, no hierarchy / resume echo.

## How the official docs map here

### MCP ([Build a server](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server), [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports))

| Doc concept | This repo |
| --- | --- |
| Tools (not resources/prompts as the primary surface) | Four tools: `list_job_lenses`, `get_job_lens`, `suggest_job_lens`, `review_resume` |
| stdio transport | `npx jevsume-mcp` — JSON-RPC on stdin/stdout, logs on stderr |
| Streamable HTTP | `POST /mcp` JSON-RPC; GET without SSE is 405 unless a browser asks for HTML |
| Stateless server | No `Mcp-Session-Id`; each POST is a complete initialize / list / call |
| Auth | Hosted: none. Local: API key in the process env, not in MCP. OAuth is out of scope |
| Logging | stdio never writes to stdout except JSON-RPC |

The Worker already has `nodejs_compat`. We implement a **fetch-native** JSON-RPC handler so we do not pull Node `IncomingMessage` transports into workerd. The protocol is still MCP: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`.

### Agent Skills ([agentskills.io](https://agentskills.io/home), [spec](https://agentskills.io/specification))

| Spec rule | This repo |
| --- | --- |
| Directory + `SKILL.md` with YAML `name` + `description` | `skills/jevsume-resume/` |
| Progressive disclosure | Short SKILL.md; connection details in `references/mcp.md` |
| Name = directory, lowercase + hyphens | `jevsume-resume` |
| Body is the procedure | Proctor loop: pick lens → review → rewrite → re-review |

The skill tells the agent **when** to use the MCP tools and **not** to dump full job text or the resume back into the chat.

## Architecture

```
LLM host
  ├─ Agent Skill (SKILL.md)     — procedure, min-context rules
  └─ MCP tools
        │
        ├─ Streamable HTTP POST /mcp     (hosted Worker, shared IP rate limit)
        └─ stdio via npx jevsume-mcp     (local, user's TYPESAFE_API_KEY)
              │
              ▼
        mcp/*  compact tools + JSON-RPC
              │
              ▼
        ReviewEngine (same Jev path as POST /api/reviews)
```

`mcp/` does not import Cloudflare bindings. The Worker wires `ReviewEngine` + `RateLimiter`. The CLI wires `TypeSafeHttpProvider` + memory stores.

## Tools (minimum context)

Descriptions stay one sentence. Return **JSON text**, no resume echo, no hierarchy, no telemetry.

1. **`list_job_lenses`** — baked-in catalog (`default` + `RESUME_PRESETS`). Optional `track` / `query`. Items: `{ id, title, track, level, tags, blurb }`. No job text.
2. **`get_job_lens`** — `{ id }` → includes `jobText`. Call only when the agent must quote the listing.
3. **`suggest_job_lens`** — `{ resumeText }` → one id via `choosePresetForUser`.
4. **`review_resume`** — `{ resumeText, jobLensId?, jobText?, jobTitle?, company?, jobUrl? }`.
   - No lens and no JD → general review (`default`).
   - `jobLensId` (`default`, `swe-staff`, or `preset:swe-staff`) → that persona.
   - Explicit `jobText` / job target wins over lens id.
   - Compact result: `{ score, validity, evidence, mode, lens, findings[], suggestions[], gaps[] }`.
   - Cap findings at 8 (drop `works` unless nothing else), suggestions at 5.

## Rate limits (web only)

`review_resume` consumes the existing **`resumeReview`** checkpoint (10 / 60s / IP), shared with `POST /api/reviews` and `/api/reviews/job`. List/get/suggest are free. Local stdio does not rate-limit (the key holder pays TypeSafe).

Tool-level rate limit returns `isError: true` plus `{ code: "rate_limited", retryAfterSeconds, resetAt }` so MCP clients still see a JSON-RPC 200.

## Transports

**Web:** `wrangler.jsonc` `run_worker_first` includes `/mcp`. No auth. CORS open for MCP headers. OAuth can wrap `/mcp` later without changing tools.

**Local:** `jevsume-mcp --api-key $TYPESAFE_API_KEY` (or env `TYPESAFE_API_KEY`). Missing key → stderr + exit 1. `--mock` only for tests.

## Skill procedure

1. Connect (hosted `/mcp` or local npx).
2. If the user has a JD, pass it as `jobText`. Else `list_job_lenses` / `suggest_job_lens` and pass `jobLensId` — do not `get_job_lens` unless quoting.
3. `review_resume` once.
4. Rewrite specific bullets from findings/suggestions. Do not invent Jev scores.
5. Re-review. Stop when the user is done or remaining gaps are intentional.

## Out of scope

OAuth, PDF extract over MCP, streaming proctor events, listing D1-created personas, SSE GET streams.
