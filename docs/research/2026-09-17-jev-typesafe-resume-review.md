# Research: JEV / TypeSafe for ATS-friendly resume review

**Date:** 2026-09-17  
**Product:** jevsume  
**Method:** Primary sources only (official TypeSafe docs, TypeSafe agent skill, Cloudflare docs, Hono docs, Mozilla PDF.js, mammoth.js). Exa MCP (`web_search_exa` / `web_fetch_exa`) was attempted and **rate-limited** (HTTP `-32000`, Exa free MCP quota). Fallback: Cursor `WebFetch` and Cloudflare Docs MCP, which retrieved the same first-party URLs.

---

## 1. Workspace and local TypeSafe skill

### Workspace (`/workspace`)

Inspected 2026-09-17:

- Git repo `https://github.com/unownone/jevsume`, default branch `main`.
- Single committed file: `readme.md` (`# Jevsume`).
- No `CODEOWNERS`, no package manager lockfile, no existing app code.
- No nested TypeSafe/JEV skill files in the repo.

### TypeSafe skill files found

| Path | Role |
| --- | --- |
| `/home/ubuntu/.cursor/projects/workspace/uploads/SKILL_662e.md` | Attached TypeSafe agent skill (MIT), name `typesafe-ai` |
| Live skill (docs) | [Agent skill](https://docs.typesafe.ai/agent-skill.md) and GitHub [typesafe-ai/skills](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md) |

No other TypeSafe/JEV skill files were found under `/workspace`. A filename search under `/home/ubuntu/.cursor` for `*typesafe*` only returned the uploaded skill.

The attached skill matches the live TypeSafe skill: Jev is the flagship System One model; live docs at `https://docs.typesafe.ai` are the source of truth; Mintlify pages are available as `.md` ([skill](https://docs.typesafe.ai/agent-skill.md), [index](https://docs.typesafe.ai/llms.txt)).

---

## 2. TypeSafe / JEV programming model

### What Jev is (and is not)

From [Introduction](https://docs.typesafe.ai/introduction.md) and [System One](https://docs.typesafe.ai/concepts/system-one.md):

- Jev is TypeSafe’s flagship and **first System One model**.
- System One models make **fast, structured decisions** for software: typed answers and probability distributions, **not generated text**.
- Jev currently accepts **text only** (strings, JSON objects, arrays of text). Images, audio, and video are not supported.
- System One does **not** write replies, produce code, or generate explanations of reasoning.
- The name follows Kahneman’s System 1 (fast/intuitive) vs System 2 (slow/deliberate).

**Product implication:** a “JEV-native prompt” is **not** a free-form LLM prompt that emits a review essay. It is a **state object + typed questions** (`choice` / `score` / `noul`). Narrative suggestions shown in the UI must be **assembled in code** from those typed answers (labels, level legends, requirement ids), not parsed from model prose.

From [How to build with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md):

- System One is for **AI-powered software**, not agents. Code owns control flow; the model supplies narrow judgments.
- Keep deterministic work in code. Decompose broad judgments into atomic questions. Combine answers in code.
- Ask independent questions together; a second request is only warranted when an earlier answer is needed to fetch evidence, construct new state, or pick the next options.

### Primitives

From [Primitives](https://docs.typesafe.ai/primitives.md) and [API](https://docs.typesafe.ai/api.md):

| Type | Question | Returns |
| --- | --- | --- |
| **Choice** | One of a defined set | `choice`, `probabilities`, `confidence` |
| **Score** | Degree on ordered levels | `score`, `legend`, `probabilities`, `confidence` |
| **Noul** | Probability the statement is true | `noul` (0–1); **no** separate confidence |

Rules that matter for jevsume:

- Question **IDs are for code** and are **not sent to the model**. Put complete meaning in `instructions`.
- Reference nested state with backticked paths, e.g. `` `resume.fragments[0].text` `` ([State](https://docs.typesafe.ai/concepts/state.md), [Primitives](https://docs.typesafe.ai/primitives.md)).
- Prefer named JSON fields when context has several parts ([State](https://docs.typesafe.ai/concepts/state.md)).
- Mix types in one call. Questions run **in parallel and in isolation** against the same state ([Introduction](https://docs.typesafe.ai/introduction.md)).
- Token budget ~32,000 tokens / ~150,000 characters of English for state + questions ([Primitives](https://docs.typesafe.ai/primitives.md)).
- Score criteria: **at least 2, at most 10** ordered levels. `score` is a probability-weighted position and **can land between levels**. Levels are judged independently; the model sees descriptions, not the numbers ([Score](https://docs.typesafe.ai/primitives/score.md)).
- Noul ~0.5 means similar yes/no probability, **not** medium intensity ([skill](https://docs.typesafe.ai/agent-skill.md), [Primitives](https://docs.typesafe.ai/primitives.md)). Use Score for skill/quality spectra.
- Include a no-match/`none` Choice option when nothing may fit ([skill](https://docs.typesafe.ai/agent-skill.md)).

### Resume-relevant official pattern: composite scoring

TypeSafe’s own [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md) example **is resume screening**:

1. Score independent dimensions (Python depth, leadership, system design, generalist) with Score questions.
2. Normalize each score to 0–1 in **code**.
3. Apply **role-specific weights** in code (e.g. senior IC vs engineering manager).

That is the canonical JevScore design: **Jev supplies calibrated dimension scores; code owns JevScore.**

### Structure recovery (grouping text)

The [structure recovery cookbook](https://docs.typesafe.ai/cookbooks/autoformat.md) reconstructs Markdown from flattened text in **two requests**: stitch hard-wrapped lines, then classify blocks (heading, list, code, callout) with companion questions read only when relevant.

For ATS grouping, **deterministic heading/bullet heuristics in code** are cheaper and more stable than a Jev round-trip. Jev should **judge** grouped fragments, not invent section names. A second Jev call for grouping is optional, not required for MVP.

---

## 3. Official HTTP API and JS SDK

### HTTP

From [API reference](https://docs.typesafe.ai/api.md) and [Quick start](https://docs.typesafe.ai/introduction/quickstart.md):

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

Request:

```json
{
  "state": { "...": "string | object | array" },
  "model": "jev-latest",
  "questions": {
    "qid": {
      "type": "noul | choice | score",
      "instructions": "...",
      "criteria": {}
    }
  }
}
```

Errors: `401` invalid key, `422` validation, `429` rate limit, `529` overloaded. Retry `429`/`529` with exponential backoff.

### Models

From [Models](https://docs.typesafe.ai/models.md):

- Current: `jev-1.13.0` (alias `jev-latest` and currently `jev-preview`).
- SDK default model: `jev-latest`.
- Response `model` field reports the **versioned** ID that answered.
- Price (as of this fetch): $0.042 / MTok input; output tokens free. Limits can change.

### JavaScript SDK

From [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript.md) and [TypeSafeClient](https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient.md):

- Package: `@typesafe-ai/sdk` (Node.js 20+).
- Env: `TYPESAFE_API_KEY` (required), `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`), `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`) ([ENV](https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md)).
- `client.systemOne({ state, questions, model? })`.
- Helpers: `choice()`, `score()`, `noul()`.
- Config supports custom `fetch` ([TypeSafeClientConfig](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md)) — important for Workers and tests.
- `dangerouslyAllowBrowser` defaults false; **keep the key on the Worker**.

**Workers note:** the official HTTP API is the contract. A thin `fetch` client that matches `POST /v1/systemone` is equivalent to the SDK and avoids unknown Node-only SDK assumptions. Custom `fetch` on the SDK is also documented.

---

## 4. Cloudflare + Hono + Vite (2026)

Canonical full-stack pattern (not stale Pages Functions):

- [React + Vite on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/): React SPA + Worker API + `@cloudflare/vite-plugin`.
- Tree: `src/` (React), `worker/index.ts` (API), `wrangler.jsonc`, `vite.config.ts` with `react()` then `cloudflare()`.
- `wrangler.jsonc` `main` → Worker entry; `assets.not_found_handling` → `"single-page-application"`.
- For APIs: `assets.run_worker_first: ["/api/*"]` so `/api` is not swallowed by SPA fallback ([same guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)).
- Deploy: `vite build` then `wrangler deploy` (plugin writes an output `wrangler.json` snapshot).
- [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/): Worker runs in `workerd` during `vite` / `vite preview`.

### Workers best practices (fetched 2026-09-17)

Source: [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)

| Rule | jevsume application |
| --- | --- |
| `compatibility_date` = today | `2026-09-17` |
| `nodejs_compat` | enable |
| `wrangler.jsonc` not toml | yes |
| `wrangler types` for Env | `--env-interface CloudflareBindings` so it does not collide with Hono’s `Env` ([Hono Workers](https://hono.dev/docs/getting-started/cloudflare-workers)) |
| Secrets via `wrangler secret` / `.dev.vars` | `TYPESAFE_API_KEY` |
| Bindings over REST | R2 `PERSONAS` binding, not Cloudflare REST |
| Observability | `observability.enabled` + log/trace sampling |
| No global request state | factory `createApp(deps)` |
| No floating promises | await JEV; optional `ctx.waitUntil` without destructuring `ctx` |
| Stream unbounded payloads | JSON resume text with a size cap; do not `await response.text()` on unbounded upstream |
| Web Crypto for IDs | `crypto.randomUUID()` |

### R2

[Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/): bind `r2_buckets`, `env.BUCKET.put/get/delete`. Local `wrangler dev` uses **local disk simulation** unless `"remote": true`.

### Hono

[Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers): `export default app` or `{ fetch: app.fetch }`. Bindings via `c.env`. Tests via `app.request(path, init, env)` ([Hono testing](https://hono.dev/docs/guides/testing)).

---

## 5. ATS-like resume parsing

**Constraint:** PDF/DOCX parsing inside Workers is heavy and a poor fit for Jev (text-only). Extract on the **client**, send **plain text** to the Worker.

### PDF

Mozilla [PDF.js](https://mozilla.github.io/pdf.js/getting_started/) is a client-side PDF parser/renderer. The **core** layer parses the binary PDF; the **display** API is the supported surface. Text can be read via the display API (`getTextContent` on page proxies — documented in PDF.js examples/wiki). Official package: `pdfjs-dist` ([jsDelivr listing in the same getting-started page](https://mozilla.github.io/pdf.js/getting_started/)). Source: [github.com/mozilla/pdf.js](https://github.com/mozilla/pdf.js).

ATS systems that ingest PDFs typically read the **text layer**, not pixels. Image-only PDFs yield empty extraction — paste-text fallback is required.

### DOCX

[mammoth.js](https://github.com/mwilliamson/mammoth.js) converts `.docx` to HTML (and thus text) in the browser. It is the standard client-side DOCX-to-semantic-HTML library.

### Grouping (ATS-like)

Applicant-tracking parsers generally:

1. Extract a linear text stream from PDF/DOCX.
2. Detect **canonical headings** (Experience, Education, Skills, Summary, Projects).
3. Split **bullets** and leftover paragraphs.

No first-party ATS parser API is being integrated. jevsume should **imitate that pipeline in code** (heading regex + bullet split) so Jev sees the same fragments an ATS would. Optional Jev Choice can label ambiguous sections using a closed set (`summary`, `experience`, `education`, `skills`, `projects`, `other`).

Jobscan’s public ATS-resume article timed out / 404 on fetch during this research pass; do not cite it. Grouping rules below are derived from the extraction libraries above plus TypeSafe’s “keep deterministic work in code” guidance.

---

## 6. Prompt-design decisions (research conclusions)

These are design choices justified by the sources above; the spec expands them.

1. **Do not ask Jev to “write a review.”** Ask Scores for wording / conciseness / structure / metrics; Nouls for presence of claims; Choices for section type and work/partial/fail per requirement ([Introduction](https://docs.typesafe.ai/introduction.md), [How to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md)).
2. **Job persona = JEV-native artifact:** stored `{ jobDescription, tags, requirements[] }` plus a **compiled question map**. The resume is injected into that state; the frontend sends **persona id**, never the question blob ([product brief] + [State](https://docs.typesafe.ai/concepts/state.md)).
3. **Persona creation from JD:** code splits JD into candidate requirement lines; one SystemOne call scores/classifies each candidate (Noul “is this a hiring requirement?”, Choice category). Store survivors. Do not generate requirement text with Jev.
4. **JevScore in code** using [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md): normalize 0–4 Scores, weight, scale to 0–100.
5. **One SystemOne call per review** (speculative fan-out of all dimension + requirement questions). Second call only if persona build must complete before job review (it does: create persona first, then review).
6. **LLM seam:** `JudgmentProvider.evaluate(state, questions)`. Adapters: live TypeSafe HTTP, deterministic mock. No other models wired now.
7. **Secrets:** `TYPESAFE_API_KEY` via Wrangler secrets / `.dev.vars`. Never in git.

---

## 7. Source index

| Topic | URL |
| --- | --- |
| Docs index | https://docs.typesafe.ai/llms.txt |
| Introduction | https://docs.typesafe.ai/introduction.md |
| Quick start | https://docs.typesafe.ai/introduction/quickstart.md |
| System One | https://docs.typesafe.ai/concepts/system-one.md |
| How to build | https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md |
| State | https://docs.typesafe.ai/concepts/state.md |
| Primitives | https://docs.typesafe.ai/primitives.md |
| Score | https://docs.typesafe.ai/primitives/score.md |
| HTTP API | https://docs.typesafe.ai/api.md |
| JS SDK | https://docs.typesafe.ai/sdk/javascript.md |
| TypeSafeClient | https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient.md |
| ENV vars | https://docs.typesafe.ai/sdk/javascript/api/variables/ENV.md |
| Client config | https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md |
| Models | https://docs.typesafe.ai/models.md |
| Composite scoring | https://docs.typesafe.ai/patterns/composite-scoring.md |
| Structure recovery | https://docs.typesafe.ai/cookbooks/autoformat.md |
| Agent skill | https://docs.typesafe.ai/agent-skill.md |
| Workers best practices | https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ |
| React + Vite Workers | https://developers.cloudflare.com/workers/framework-guides/web-apps/react/ |
| Vite plugin | https://developers.cloudflare.com/workers/vite-plugin/ |
| R2 from Workers | https://developers.cloudflare.com/r2/api/workers/workers-api-usage/ |
| Hono Workers | https://hono.dev/docs/getting-started/cloudflare-workers |
| Hono testing | https://hono.dev/docs/guides/testing |
| PDF.js getting started | https://mozilla.github.io/pdf.js/getting_started/ |
| PDF.js source | https://github.com/mozilla/pdf.js |
| mammoth.js | https://github.com/mwilliamson/mammoth.js |

### Failed / incomplete fetches (do not treat as facts)

- Exa MCP: free rate limit, no results.
- `https://www.jobscan.co/blog/resume-parsing/` → 404.
- `https://www.jobscan.co/blog/ats-resume/` → timeout.
- MDN PDF.js page → 500.
