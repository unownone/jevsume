# jevsume

ATS-friendly resume review powered by **Jev** (TypeSafe System One). The frontend extracts resume text the way a parser would, then a Cloudflare Worker runs typed JEV questions and composes a **JevScore**.

Two modes:

- **General review** — wording, conciseness, structure, metrics, ATS parseability.
- **Per-job review** — job description + tags become a stored **job persona** (JEV-native state + questions). One resume is scored against one persona.

Jev does not generate prose. Scores, verdicts, and probabilities come from System One; the Worker turns them into UI copy.

## Stack

- React + Vite SPA via [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)
- Hono API on a Cloudflare Worker (`/api/*`)
- **D1** for personas, resumes, and evaluation runs (in-memory fallback when the binding is absent)
- **KV** for the unique visitor counter (edge reads + HTTP cache headers on `GET /api/visitors`)
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

`wrangler.jsonc` uses Workers static assets + SPA fallback, `run_worker_first: ["/api/*"]`, `compatibility_date: 2026-09-17`, `nodejs_compat`, observability, a D1 binding `DB` (`jevsume`), and a KV binding `VISITORS` for the visitor counter. Schema lives in [`migrations/0001_init.sql`](migrations/0001_init.sql).

Git deploys auto-provision the KV namespace for `VISITORS` because `id` is omitted, the same way D1 is provisioned. The unique count is a single KV key (`count`) plus per-visitor keys (`vid:<id>`). `GET /api/visitors` is cacheable (`Cache-Control` + `CDN-Cache-Control`); `POST /api/visitors` is `no-store` so uniqueness writes are not cached.

Lookup APIs that used to dump stored resumes and eval runs are not public. The Worker still persists reviews internally; the UI talks to:

| Method | Path | Use |
| --- | --- | --- |
| GET | `/api/health` | Provider/storage heartbeat |
| GET/POST | `/api/visitors` | Unique visitor count (HttpOnly cookie) |
| GET | `/api/job-personas` | Default + stored job personas |
| GET | `/api/job-personas/:id` | Persona detail |
| POST | `/api/personas` | Create a job persona |
| GET | `/api/personas` | Persona summaries |
| GET | `/api/personas/:id` | Stored persona |
| POST | `/api/resumes` | Store extracted resume text |
| POST | `/api/reviews` | General or per-job review |
| POST | `/api/reviews/job` | Per-job review |

Rate limits (per Cloudflare location, by `CF-Connecting-IP`): 10 reviews/min, 5 persona creates/min, 20 resume uploads/min, 30 visitor pings/min. CORS is same-origin only.

## Secrets

Official TypeSafe env name is `TYPESAFE_API_KEY` ([SDK ENV](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md)). Never commit `.dev.vars`. HTTP API: `POST https://api.typesafe.ai/v1/systemone` ([API](https://docs.typesafe.ai/api.md)).

## Docs

- Research: [`docs/research/2026-09-17-jev-typesafe-resume-review.md`](docs/research/2026-09-17-jev-typesafe-resume-review.md)
- Design: [`docs/superpowers/specs/2026-09-17-jevsume-design.md`](docs/superpowers/specs/2026-09-17-jevsume-design.md)
- Plan: [`docs/superpowers/plans/2026-09-17-jevsume-plan.md`](docs/superpowers/plans/2026-09-17-jevsume-plan.md)
