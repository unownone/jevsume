# jevsume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an ATS-friendly resume reviewer (general + per-job JevScore) on Cloudflare Workers + Vite + Hono, with an isolated JEV prompt module.

**Architecture:** Client extracts resume text; Worker groups it, runs TypeSafe SystemOne (Jev) or a mock adapter, transforms typed answers into DTOs. Job personas are JEV-native state + compiled questions stored in R2.

**Tech Stack:** React 19, Vite, `@cloudflare/vite-plugin`, Hono, Wrangler, Vitest, pdfjs-dist, mammoth, TypeSafe HTTP `POST /v1/systemone`.

**Spec:** [`docs/superpowers/specs/2026-09-17-jevsume-design.md`](../specs/2026-09-17-jevsume-design.md)

## Global Constraints

- Branch: `cursor/jevsume-mvp-ba2f` (already created).
- JEV/TypeSafe only for the agent loop; `JudgmentProvider` seam for future models; do not wire other LLMs.
- Isolated JEV module: `packages/jev` — no UI/API leakage into prompt templates.
- `wrangler.jsonc`, `compatibility_date` `2026-09-17`, `nodejs_compat`, observability, `wrangler types --env-interface CloudflareBindings`.
- Secrets: `.dev.vars.example` placeholders only; never commit keys.
- Imports at file top; exhaustive `never` on union switches.
- Stage named files only (no `git add .`).
- Tests at public seams with Vitest; Hono `app.request`.
- One PR for this greenfield MVP.

---

## File map

| Path | Responsibility |
| --- | --- |
| `packages/jev/*` | Questions, HTTP/mock client, transformers, JevScore, DTOs |
| `worker/ats/group.ts` | Deterministic ATS-like grouping |
| `worker/storage/*` | Persona/resume repository (R2 + memory) |
| `worker/engine.ts` | Review + persona-build orchestration |
| `worker/app.ts` | Hono router |
| `worker/index.ts` | Worker export |
| `src/*` | React UI, client extract, API client |
| `test/*` | Vitest |

---

## Task 1: Scaffold Cloudflare + Vite + Hono

- [ ] Write `package.json` (pnpm scripts: `dev`, `build`, `preview`, `deploy`, `test`, `typecheck`, `cf-typegen`)
- [ ] Write `wrangler.jsonc`, Vite/tsconfig, `.gitignore`, `.dev.vars.example`
- [ ] Write placeholder `worker/index.ts` and `index.html` + `src/main.tsx`
- [ ] `pnpm install`
- [ ] `pnpm cf-typegen` (`wrangler types --env-interface CloudflareBindings`)
- [ ] Commit named files and push (early scaffold PR)

## Task 2: ATS grouping (TDD)

- [ ] Failing tests: headings, bullets, empty, unknown sections
- [ ] Implement `groupResumeText`
- [ ] Green

## Task 3: Isolated JEV module (TDD)

- [ ] Failing tests: general question map has required ids/types; persona builder filters by noul; transformer produces JevScore; mock is deterministic
- [ ] Implement prompts, types, `computeJevScore`, `transformGeneralReview`, `transformJobReview`, HTTP client, mock adapter
- [ ] Green

## Task 4: Storage + engine + Hono routes (TDD)

- [ ] Failing tests: health, create/get persona, general review, job review 404, validation
- [ ] Implement memory + R2 stores, `createApp(env)`, routes
- [ ] Green

## Task 5: Frontend

- [ ] Dark shiny UI: two modes, dropzone, paste, persona form, results
- [ ] Client PDF/DOCX extract + fallback
- [ ] Score display helper unit test

## Task 6: Docs + README

- [ ] Replace `readme.md` with product, run, secrets, deploy
- [ ] `docs/architecture-jev.md` seam note

## Task 7: Verify

- [ ] `pnpm test` and `pnpm typecheck`
- [ ] Curl health if `pnpm dev` can start
- [ ] Browser-verify if Playwright MCP available
- [ ] Commit, push, update PR
