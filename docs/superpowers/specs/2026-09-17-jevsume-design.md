# jevsume design spec

**Date:** 2026-09-17  
**Product:** jevsume — ATS-friendly smart resume review using JEV (TypeSafe SystemOne)  
**Research:** [`docs/research/2026-09-17-jev-typesafe-resume-review.md`](../../research/2026-09-17-jev-typesafe-resume-review.md)

Primary sources for every JEV/Cloudflare claim are cited in the research file. This spec does not re-litigate them.

---

## 1. Problem

Hiring systems (ATS) flatten resumes into text, then match fragments against a job. Candidates need the same view: **how an ATS sees their resume**, and **how that text scores against a specific job persona**.

jevsume is not an LLM essay generator. Jev returns typed judgments. The app composes those into scores, grouped findings, and a **JevScore**.

---

## 2. Users and modes

Two first-class modes:

1. **General review** — resume only. Group text the way an ATS would; score wording, conciseness, structure, metrics, ATS parseability.
2. **Per-job review** — resume + **persona id**. Map fragments onto persona requirements; label what works / does not; emit JevScore.

One resume is evaluated against **one** job persona per request.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ React SPA (Vite)                                            │
│  • client ATS extract (pdf.js / mammoth / paste)            │
│  • group preview                                             │
│  • sends resumeText + personaId (never prompt blobs)        │
└───────────────────────────────┬─────────────────────────────┘
                                │ POST /api/*
┌───────────────────────────────▼─────────────────────────────┐
│ Cloudflare Worker + Hono                                    │
│  routes → review engine → storage repo → JEV provider       │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
        D1 DB                        JudgmentProvider
        (memory fallback)           ├─ TypeSafeHttpAdapter (Jev)
                                    └─ MockJudgmentAdapter
```

### Deep modules (seams)

| Module | Interface callers see | Hidden implementation |
| --- | --- | --- |
| `packages/jev` | `evaluate(state, questions)`, transformers, DTOs, prompt builders | HTTP, mock heuristics, question JSON |
| `PersonaStore` / `ResumeStore` / `EvalStore` | `create` / `get` / `list` (plus eval get by id) | D1 SQL or in-memory maps |
| `ReviewEngine` | `generalReview(text)` / `jobReview(text, persona)` | grouping, JEV calls, JevScore weights |
| Hono app | HTTP | wiring only |

**Isolation rule:** prompt templates, Score criteria, and SystemOne question maps live **only** in `packages/jev`. UI and Hono routes never concatenate review prompts.

### LLM seam (now: Jev only)

```ts
interface JudgmentProvider {
  readonly id: "jev" | "mock";
  evaluate(input: SystemOneRequest): Promise<SystemOneResult>;
}
```

Future models implement the same interface. **Do not wire other LLMs in this MVP.**

If `TYPESAFE_API_KEY` is missing/blank, the Worker uses `mock`.

---

## 4. JEV prompt design (thorough)

Jev does not generate a “job persona prompt” as prose ([System One](https://docs.typesafe.ai/concepts/system-one.md)). A **JEV-native persona** is:

1. **State schema** the resume is dropped into.
2. **Compiled questions** whose `instructions` reference that state with backticked paths ([Primitives](https://docs.typesafe.ai/primitives.md)).

### 4.1 Shared Score rubric (0–4)

Used for quality dimensions. Levels must stand alone ([Score](https://docs.typesafe.ai/primitives/score.md)):

| Level | Meaning |
| --- | --- |
| 0 | Fails the dimension: empty, generic, or unusable for an ATS. |
| 1 | Weak: vague language, missing evidence, or hard for a parser to use. |
| 2 | Adequate: understandable but not calibrated; some ATS friction. |
| 3 | Strong: specific, scannable, mostly ATS-safe. |
| 4 | Excellent: concrete, concise, metric-backed, parser-friendly. |

Each Score’s `instructions` name **one** dimension. Weights live in code ([composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md)).

### 4.2 Stage A — ATS grouping (code, not Jev)

Input: extracted plain text.  
Output: `{ sections: [{ id, heading, kind, text, fragments: [{ id, text, kind: "heading"|"bullet"|"paragraph" }] }] }`.

Heading dictionary (case-insensitive, start-of-line):  
`summary|profile|objective|experience|work experience|employment|education|skills|technical skills|projects|certifications|awards|publications|volunteer|contact`.

Unknown blocks → `other`. Bullets: lines starting with `-`, `•`, `*`, `–`, or `·`.

This imitates ATS linearization using Mozilla PDF.js text extraction ([PDF.js](https://mozilla.github.io/pdf.js/getting_started/)) + heading heuristics. Optional later: Jev Choice to relabel `other` sections. Not in MVP critical path.

### 4.3 Stage B — Job persona from JD + tags

**API:** `POST /api/personas` `{ title, jobDescription, tags: string[] }`.

**Code:** split JD on newlines / sentence-ish bullets into candidate lines (trim, drop empty, drop lines < 12 chars). Cap at 24 candidates (token budget).

**State:**

```json
{
  "job": {
    "title": "Staff Backend Engineer",
    "tags": ["distributed-systems", "golang", "staff"],
    "description": "<full JD text>"
  },
  "candidates": [
    { "id": "c0", "text": "5+ years building event-driven services" }
  ]
}
```

**Questions (one SystemOne call, speculative fan-out):**

For each candidate `cN`:

- `req_cN` **Noul**  
  instructions: ``Is `candidates[N].text` a concrete hiring requirement or qualification for `job.title`, given `job.description` and `job.tags`?``  
  criteria: `{ true: "A skill, experience bar, duty, or qualification a hiring manager would screen for.", false: "Boilerplate, benefits, company marketing, or empty phrasing." }`

- `cat_cN` **Choice**  
  instructions: ``Which requirement category best fits `candidates[N].text` for this role?``  
  criteria:  
  - `must_have` — non-negotiable skill or years bar  
  - `nice_to_have` — preferred but not blocking  
  - `responsibility` — day-to-day work  
  - `culture` — working style, not a hard skill  
  - `not_a_requirement` — not a screenable requirement  

**Code after answers:** keep candidates with `noul >= 0.55` and category ≠ `not_a_requirement`. Persist:

```ts
type JobPersona = {
  id: string;
  title: string;
  tags: string[];
  jobDescription: string;
  requirements: { id: string; text: string; category: string; noul: number }[];
  createdAt: string;
};
```

The **persona prompt** stored is this object. Review questions are **rebuilt** from it in `packages/jev` so templates stay in one module.

### 4.4 Stage C — General resume review

**State:**

```json
{
  "resume": {
    "text": "<full extracted text>",
    "sections": [ { "id": "s1", "heading": "Experience", "kind": "experience", "text": "..." } ]
  }
}
```

**Questions (single call):**

| id | type | instructions (intent) |
| --- | --- | --- |
| `wording` | Score 0–4 | How specific and professional is diction in `resume.text` for an ATS-facing resume? |
| `conciseness` | Score 0–4 | How concise is `resume.text` without losing evidence? |
| `structure` | Score 0–4 | How well do `resume.sections` use canonical headings and scannable bullets? |
| `metrics` | Score 0–4 | How well does `resume.text` quantify impact (numbers, scope, outcomes)? |
| `ats_parse` | Score 0–4 | How safely would a text-layer ATS parse this content (plain headings, no tables/columns implied)? |
| `has_summary` | Noul | Does the resume include a professional summary or profile section? |
| `has_experience` | Noul | Does the resume include work experience with roles and dates or scope? |
| `has_skills` | Noul | Does the resume list skills a parser could extract as tokens? |
| `weakest_dimension` | Choice | Which dimension is the biggest ATS risk? `wording` / `conciseness` / `structure` / `metrics` / `ats_parse` / `none` |

Per **section** (cap 8):

- `sec_{id}_kind` Choice: `summary|experience|education|skills|projects|other`
- `sec_{id}_quality` Score 0–4: quality of that section’s text for ATS screening

**UI copy from answers:** map `weakest_dimension` + low scores to canned suggestion strings in the transformer (not model-generated prose). Example: if `metrics.score < 2`, suggestion = “Add quantified outcomes (%, $, time, scale) to bullets.”

### 4.5 Stage D — Per-job review (resume into persona)

**State:**

```json
{
  "persona": {
    "title": "...",
    "tags": ["..."],
    "jobDescription": "...",
    "requirements": [ { "id": "r1", "text": "...", "category": "must_have" } ]
  },
  "resume": { "text": "...", "sections": [ ... ] }
}
```

**Questions (single call):**

Global Scores (same 0–4 rubric, instructions bound to the job):

- `fit_overall` — overall match of `resume.text` to `persona.title` and `persona.jobDescription`
- `keyword_alignment` — overlap of resume tokens with `persona.tags` and requirement language
- `evidence_strength` — how well bullets prove the requirements rather than restating titles
- `wording`, `conciseness`, `structure`, `metrics` — as in general review, still about `resume.text`

Per requirement `r` (cap 16):

- `req_{id}_covered` **Noul** — ``Does `resume.text` provide evidence for persona requirement `persona.requirements[i].text`?``
- `req_{id}_verdict` **Choice** — `works` / `partial` / `missing` / `contradicts`  
  instructions: ``How does the resume stand against `persona.requirements[i].text`?``  
  Include `contradicts` for conflicting claims.

Optional per high-signal section (cap 6): `frag_{id}_helps` Noul — does this section help the persona?

### 4.6 JevScore (code)

Normalize Score `s` on 0–4: `s / 4`.

**General JevScore**

```
0.22 * wording
+ 0.18 * conciseness
+ 0.22 * structure
+ 0.20 * metrics
+ 0.18 * ats_parse
```

**Job JevScore**

```
0.28 * fit_overall
+ 0.18 * keyword_alignment
+ 0.18 * evidence_strength
+ 0.10 * wording
+ 0.08 * conciseness
+ 0.08 * structure
+ 0.10 * metrics
```

Then mix in requirement coverage:

```
coverage = mean(noul for must_have, nice_to_have, responsibility)
jobJev = 0.75 * weightedScores + 0.25 * coverage
```

Scale to 0–100, round. Attach `confidence` as the **min** of Score confidences used (conservative gate, not a claim of workflow correctness — [skill confidence notes](https://docs.typesafe.ai/agent-skill.md)).

### 4.7 Transformers (Jev → API DTO)

`packages/jev` maps answers →:

```ts
type ReviewResponse = {
  mode: "general" | "job";
  jevScore: { value: number; breakdown: { key: string; score01: number; weight: number }[]; confidence: number | null };
  dimensions: { id: string; label: string; score: number; max: number; confidence?: number }[];
  sections: { id: string; heading: string; kind: string; text: string; quality?: number }[];
  findings: { id: string; severity: "works" | "partial" | "missing" | "risk"; title: string; detail: string }[];
  requirements?: { id: string; text: string; category: string; noul: number; verdict: string }[];
  suggestions: { id: string; text: string }[];
  provider: "jev" | "mock";
  model?: string;
};
```

Suggestion catalog is **deterministic** from thresholds (e.g. `metrics < 2`, `verdict === missing`). Jev never writes the sentence.

---

## 5. HTTP API

All JSON. Size cap: 120_000 characters of resume text (under TypeSafe ~150k char budget with questions).

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ ok, provider, time }` |
| POST | `/api/personas` | `{ title, jobDescription, tags? }` | persona |
| GET | `/api/personas` | `?q=&tag=` | `{ items }` (ids, titles, tags) |
| GET | `/api/personas/:id` | — | persona (no internal question JSON required) |
| POST | `/api/resumes` | `{ text, filename?, source? }` | `{ id, chars, sections, contentHash }` |
| GET | `/api/resumes` | `?q=&source=` | resume summaries |
| GET | `/api/resumes/:id` | — | stored resume including text |
| POST | `/api/reviews` | `{ resumeText }` | `ReviewResponse` general (also persisted as eval) |
| POST | `/api/reviews/job` | `{ resumeText, personaId }` | `ReviewResponse` job (also persisted as eval) |
| GET | `/api/evals` | `kind`, `resumeId`, `personaId`, `provider`, `promptHash`, `minScore`, `maxScore` | eval summaries |
| GET | `/api/evals/:id` | — | full eval: input, prompt, output, review |

Errors: `400` validation, `404` persona missing, `413` payload too large, `502` JEV upstream.

---

## 6. Storage

- **D1** binding `DB`, database name `jevsume`, schema in `migrations/`.
- **Resumes:** `resumes` table keyed by `id`, unique `content_hash` for upsert, list/search by text/source.
- **Personas:** `personas` plus `persona_tags` for tag lookups. Full object remains JSON-compatible (`tags_json`, `requirements_json`).
- **Eval runs:** every JEV/mock call (`general_review`, `job_review`, `persona_build`) stores:
  - `input_json` — SystemOne state (resume + persona)
  - `prompt_json` — compiled questions
  - `output_json` — raw SystemOne answers
  - `review_json` — transformed `ReviewResponse` (null for persona build)
  - `prompt_hash`, `jev_score`, `provider`, `model` for later comparisons
- **Repository seam:** `PersonaStore` / `ResumeStore` / `EvalStore` with `D1*` implementations and in-memory fallback when `DB` is absent.

IDs: `crypto.randomUUID()`.

---

## 7. Frontend UX

Dark, high-contrast, subtle motion (not a form dump):

- Hero with mode switch: **General** | **Per-job**.
- Dropzone for PDF/DOCX + paste fallback.
- Per-job: create persona (title, tags, JD) or pick existing.
- After review: large JevScore orb, dimension bars, grouped sections, work/don’t-work chips, suggestion list.
- Badge when provider is `mock`.

Client extract:

- PDF → `pdfjs-dist` `getDocument` + page `getTextContent`.
- DOCX → `mammoth.extractRawText`.
- Always allow paste.

---

## 8. Cloudflare project shape

- `pnpm`
- `wrangler.jsonc`: name `jevsume`, `compatibility_date` `2026-09-17`, `nodejs_compat`, observability, D1 `DB`, `main: worker/index.ts`, SPA assets, `run_worker_first: ["/api/*"]`
- `.dev.vars.example` with `TYPESAFE_API_KEY=`
- `wrangler types --env-interface CloudflareBindings`
- Scripts: `dev`, `build`, `preview`, `deploy`, `test`, `typecheck`

---

## 9. Testing

Vitest. Public seams only:

- Grouping helper
- JevScore + transformers
- Prompt builders emit expected question ids/types
- Hono routes with mock provider + memory store
- Frontend: JevScore formatting helper

---

## 10. Non-goals (MVP)

- Other LLM providers
- Generating rewritten resume text with Jev (Jev cannot generate text)
- Server-side PDF parse
- Auth / multi-user accounts
- realmente deploying from this agent (no Wrangler Cloudflare auth assumed)
