# jevsume

ATS-friendly resume review powered by **Jev** (TypeSafe System One). The frontend extracts resume text the way a parser would, then a Cloudflare Worker runs typed JEV questions and composes a **JevScore**.

Two modes:

- **General review** — wording, conciseness, structure, metrics, ATS parseability.
- **Per-job review** — job description + tags become a stored **job persona** (JEV-native state + questions). One resume is scored against one persona.

Jev does not generate prose. Scores, verdicts, and probabilities come from System One; the Worker turns them into UI copy.

## Stack

- React + Vite SPA via [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/)
- Hono API on a Cloudflare Worker (`/api/*`)
- R2 for personas (in-memory fallback when the binding is absent)
- Isolated JEV module: [`packages/jev`](packages/jev) — see [`docs/architecture-jev.md`](docs/architecture-jev.md)

## Setup

```bash
pnpm install
cp .dev.vars.example .dev.vars
# optional live Jev:
# put your key in .dev.vars as TYPESAFE_API_KEY=...
pnpm dev
```

Open the Vite URL (usually `http://localhost:5173`). Without `TYPESAFE_API_KEY`, the Worker uses a **deterministic mock** so the app still runs.

```bash
pnpm test
pnpm typecheck
pnpm cf-typegen   # wrangler types --env-interface CloudflareBindings
```

## Deploy

```bash
pnpm build
npx wrangler r2 bucket create jevsume-personas   # once
npx wrangler secret put TYPESAFE_API_KEY
npx wrangler deploy
```

`wrangler.jsonc` uses Workers static assets + SPA fallback, `run_worker_first: ["/api/*"]`, `compatibility_date: 2026-09-17`, `nodejs_compat`, and observability.

## Secrets

Official TypeSafe env name is `TYPESAFE_API_KEY` ([SDK ENV](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md)). Never commit `.dev.vars`. HTTP API: `POST https://api.typesafe.ai/v1/systemone` ([API](https://docs.typesafe.ai/api.md)).

## Docs

- Research: [`docs/research/2026-09-17-jev-typesafe-resume-review.md`](docs/research/2026-09-17-jev-typesafe-resume-review.md)
- Design: [`docs/superpowers/specs/2026-09-17-jevsume-design.md`](docs/superpowers/specs/2026-09-17-jevsume-design.md)
- Plan: [`docs/superpowers/plans/2026-09-17-jevsume-plan.md`](docs/superpowers/plans/2026-09-17-jevsume-plan.md)
