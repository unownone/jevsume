# Pro-sume brand revamp — implementer report

## Status

Implementation complete on `cursor/prosume-rebrand-47f5`, including release-fix passes and **final review blockers** (hosted MCP per client, studio semantic bridge, deterministic UAT harness).

## Verification (exact commands — final pass)

Run from repo root on `cursor/prosume-rebrand-47f5`:

```bash
pnpm typecheck   # exit 0
pnpm test        # 32 files, 176 tests, exit 0 (excludes test/uat/**)
pnpm uat         # 1 file, 9 tests, exit 0 — jsdom MemoryRouter harness (no Playwright/browser run)
pnpm build       # exit 0
```

**What ran:** Vitest jsdom UAT (`vitest.uat.config.ts`) exercising `SiteAppRoutes` via `RouterProvider` + `createMemoryRouter`. **Not run:** Playwright or headed browser (MCP Playwright namespace available but no `pnpm uat:browser` script; no visual screenshot verification).

## Final review blocker resolutions

### 1. Hosted MCP snippets

- **Generic hosted block** on `/agents`: `HostedMcpPanel` — readme-style JSON `{ "url": "<origin>/mcp" }`.
- **Per-client hosted tab** in `mcpSnippetForClient`:
  - Claude Desktop / Cursor / generic → URL JSON
  - Claude Code → `{ "type": "http", "url": "..." }`
  - Codex CLI → TOML `url = "..."` in `[mcp_servers.jevsume]`
  - Codex Chat → TOML + shared-config notes (web client limitation)
- Tests: `test/mcp-snippets.test.ts`, `test/mcp-clipboard.test.ts`, UAT snippet URL assertion.

### 2. Review surface / token engine

- **`src/studio/semantic-bridge.css`**: maps shadcn semantic tokens → legacy studio chrome vars (`--desk`, `--text-muted`, `--gold`, etc.).
- **Bounded legacy exception**: PDF `--paper*` canvas colors and overlay severity literals remain in `studio.css` (documented in `docs/superpowers/studio-semantic-bridge.md`).
- **Migrated controls**: `DropGate` actions → shadcn `Button`; `StudioSiteNav` → shadcn ghost buttons; drop glyphs use `var(--paper)` / `var(--paper-ink)` / `var(--accent)`.
- **`prefers-reduced-motion`** rules for studio animations in semantic bridge.

### 3. UAT / accessibility harness

- **Script:** `pnpm uat` → `vitest run --config vitest.uat.config.ts`
- **Coverage (`test/uat/site.smoke.test.tsx`):** `/`, `/review?scene=empty`, `/agents`, `/classic`, `?view=classic` redirect, `/mcp` vs `/agents`, landing CTAs, hosted snippet URL in JSON, Copy buttons present, mobile sheet menu + dialog, review demo control, reduced-motion CSS, mobile menu focus.

## Architecture (unchanged core)

- Routes: `SiteApp` + exported `SiteAppRoutes` for tests; lazy-loaded pages; `/mcp` remains Worker-only (no SPA route).
- Theme: Tailwind v4 + `tw-animate-css`; `--muted` surface vs `--text-muted` text.
- Docs link: `DOCS_MCP_LOCAL_URL` on GitHub.

## Remaining concerns

1. **Clipboard in jsdom:** UAT asserts Copy controls + JSON payload unit test; does not assert live `navigator.clipboard.writeText` in jsdom.
2. **Studio canvas tokens:** Full migration of score orb / overlay literals not done (documented exception).
3. **Classic chunk** ~514kB gzip-heavy on first `/classic` visit.
4. **Plan task Markdown** still absent under `docs/superpowers/tasks/`.
5. **No Playwright e2e** — add `uat:browser` later if headed CI is required.

## Commits

See `git log` on branch — latest final-pass commit after `5d64f34`.
