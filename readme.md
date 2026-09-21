# jevsume

ATS-friendly resume review powered by **Jev** (TypeSafe System One). The frontend extracts resume text the way a parser would, then a Cloudflare Worker runs typed JEV questions and composes a **JevScore**.

Two modes:

- **General review** — wording, conciseness, structure, metrics, ATS parseability.
- **Per-job review** — job description + tags become a stored **job persona** (JEV-native state + questions). One resume is scored against one persona.

Jev does not generate prose. Scores, verdicts, and probabilities come from System One; the Worker turns them into UI copy.

## MCP + Agent Skill

Any MCP client can run the same Jev review without the studio UI. Tools return compact JSON (score, findings, suggestions, gaps) — not the full review payload.

### Hosted (no API key)

Streamable HTTP at **`/mcp`** on the Worker. No auth yet (OAuth can wrap this later). `review_resume` shares the platform IP rate limit (10 / minute) with `POST /api/reviews`.

With `pnpm dev`, the endpoint is `http://localhost:5173/mcp`. After deploy, it is `https://<your-worker>/mcp` on the same host as the app.

```json
{
  "mcpServers": {
    "jevsume": {
      "url": "http://localhost:5173/mcp"
    }
  }
}
```

### Local npx (your TypeSafe key)

Runs Jev with **your** key. Does not use the hosted rate limit.

```bash
npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY
```

From a clone: `pnpm mcp -- --api-key $TYPESAFE_API_KEY`. `--mock` uses the deterministic provider (tests/dev only).

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

### Tools

| Tool | Use |
| --- | --- |
| `list_job_lenses` | Baked-in catalog (`default` + presets). Optional `track` / `query`. Ids, titles, tags, blurb — no job text. |
| `get_job_lens` | Full listing by id. Call only when you must quote the JD. |
| `suggest_job_lens` | One lens id from `resumeText`. |
| `review_resume` | `resumeText` plus optional `jobLensId` and/or `jobText` / `jobTitle` / `company` / `jobUrl`. |

`jobLensId` accepts `default`, a preset id (`swe-staff`), or `preset:swe-staff`. Pasted `jobText` wins over a lens id. Never send PDF bytes — extract text first.

### Skill

[`skills/jevsume-resume/SKILL.md`](skills/jevsume-resume/SKILL.md) — pick a lens, review, rewrite the weak bullets, re-review. Do not invent Jev scores.

## Stack

- React + Vite SPA via [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)
- Hono API on a Cloudflare Worker (`/api/*`)
- **D1** for personas, resumes, and evaluation runs (in-memory fallback when the binding is absent)
- **KV** for the unique visitor counter (edge reads + HTTP cache headers on `GET /api/visitors`)
- **Workers Analytics Engine** (`ANALYTICS` → dataset `website_events`) for pageviews and UI clicks
- Isolated JEV module: [`packages/jev`](packages/jev) — see [`docs/architecture-jev.md`](docs/architecture-jev.md)

Every JEV call stores **resume**, **input state**, **prompt/questions**, and **raw + transformed output** so you can look up runs later and score prompt changes.

## Setup

```bash
pnpm install
cp .dev.vars.example .dev.vars
# optional live Jev:
# put your key in .dev.vars as TYPESAFE_API_KEY=...
pnpm dev
```

Open the Vite URL (usually `http://localhost:5173`). Without `TYPESAFE_API_KEY`, the Worker uses a **deterministic mock** so the app still runs. `pnpm dev` applies local D1 migrations first. If D1 is bound but empty (first run or a preview that has not been migrated), the Worker also creates the schema on the first `/api/*` request.

```bash
pnpm test
pnpm typecheck
pnpm cf-typegen   # wrangler types --env-interface CloudflareBindings
pnpm db:migrate:local   # apply D1 migrations to the local SQLite file
```

## Deploy

```bash
pnpm build
npx wrangler d1 migrations apply jevsume --remote   # after first deploy creates the DB
npx wrangler secret put TYPESAFE_API_KEY
npx wrangler deploy
```

Git deploys (Workers Builds) auto-provision the D1 database named `jevsume` because `database_id` is omitted. Apply migrations once after the first successful deploy.

`wrangler.jsonc` uses Workers static assets + SPA fallback, `run_worker_first: ["/api/*", "/mcp"]`, `compatibility_date: 2026-09-17`, `nodejs_compat`, observability, a D1 binding `DB` (`jevsume`), a KV binding `VISITORS` for the visitor counter, and an Analytics Engine dataset `website_events` (`ANALYTICS`). Schema lives in [`migrations/0001_init.sql`](migrations/0001_init.sql).

Website events are fire-and-forget `writeDataPoint()` calls. Each point is `blobs: [event_type, page, country]`, `doubles: [1]`, `indexes: [event_id]`. The Worker records a `pageview` for every `/api/*` request and accepts client events at `POST /api/events` (`pageview` on load, `click` on review / upload / demo / persona). Query with the Analytics Engine SQL API against `website_events`.

`VISITORS` is bound to the existing `jevsume-visitors` KV namespace (id in `wrangler.jsonc`). Omitting `id` makes Workers Builds try to create a second namespace with that title and fail. The unique count is a single KV key (`count`) plus per-visitor keys (`vid:<id>`). `GET /api/visitors` is cacheable (`Cache-Control` + `CDN-Cache-Control`); `POST /api/visitors` is `no-store` so uniqueness writes are not cached.

Lookup APIs (summaries on list, full prompt/input/output on get):

| Method | Path | Use |
| --- | --- | --- |
| GET | `/api/resumes?q=&source=` | Find stored resumes |
| GET | `/api/resumes/:id` | Full resume text |
| GET | `/api/personas?q=&tag=` | Find personas |
| GET | `/api/evals?kind=&resumeId=&personaId=&provider=&promptHash=&minScore=&maxScore=` | Find evaluation runs |
| GET | `/api/evals/:id` | Full input, prompt, output, review |

## Secrets

Official TypeSafe env name is `TYPESAFE_API_KEY` ([SDK ENV](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md)). Never commit `.dev.vars`. HTTP API: `POST https://api.typesafe.ai/v1/systemone` ([API](https://docs.typesafe.ai/api.md)).

## Docs

- Research: [`docs/research/2026-09-17-jev-typesafe-resume-review.md`](docs/research/2026-09-17-jev-typesafe-resume-review.md)
- Design: [`docs/superpowers/specs/2026-09-17-jevsume-design.md`](docs/superpowers/specs/2026-09-17-jevsume-design.md)
- Plan: [`docs/superpowers/plans/2026-09-17-jevsume-plan.md`](docs/superpowers/plans/2026-09-17-jevsume-plan.md)
- MCP skill: [`skills/jevsume-resume/SKILL.md`](skills/jevsume-resume/SKILL.md)
