# Pro-sume brand revamp — implementer report

## Status

Implementation complete on `cursor/prosume-rebrand-47f5`, including a **release-fix pass** for review blockers (token collision, MCP snippets, routing, viewport, lazy routes, animation utilities, dependency cleanup, and expanded tests).

## Plan vs repository rulings

| Plan expectation | Ruling |
| --- | --- |
| Isolated task Markdown under `docs/superpowers/tasks/` before code | **Not present in repo** at implementation time (only the approved artifact plan). Proceeded using the artifact plan + Stitch zip + existing `PRODUCT.md` / `.impeccable/surfaces/resume-studio.md`. |
| Stitch project ID reconciliation via Stitch MCP | **Blocked** — live Stitch MCP unavailable; used `/home/ubuntu/.cursor/projects/workspace/uploads/stitch_resume_doctor_9bba.zip` as visual source. Reference PNGs copied to `docs/design/prosume-stitch/`. |
| Superdesign CLI bare preflight | **Unavailable** in this environment (`superdesign` not on PATH). |
| Impeccable `context` launcher | **Unavailable** (binary not executable). Read `PRODUCT.md`, incumbent CSS/studio, and Impeccable surface brief directly per skill fallback. |
| Brand mark spelling | **Pro-sume** in UI; **jevsume** retained for repo/package/MCP command identifiers. |
| MCP setup page route vs HTTP endpoint | UI page at **`/agents`**; hosted HTTP MCP remains **`/mcp`** (Worker only — not a SPA route). |
| Classic text review | **`/classic`** plus legacy **`?view=classic`** redirect (preserves other query params). |
| PDF studio behavior | **Unchanged** functionally; `/review?scene=` fixtures retained. |

## Architecture delivered

- **Router**: `src/SiteApp.tsx` — lazy-loaded routes, `LegacyViewRedirect`, metadata + analytics.
- **Theme**: Tailwind v4 + `@import "tw-animate-css"` for shadcn motion utilities; shadcn `--muted` surface vs legacy **`--text-muted`** text (no collision).
- **MCP snippets**: `src/lib/mcp-snippets.ts` — client-accurate hosted/local blocks from `docs/mcp-local.md` (Claude Desktop, Claude Code CLI/JSON, Codex TOML/CLI, Codex Chat guide, Cursor JSON).
- **Docs link**: `DOCS_MCP_LOCAL_URL` → GitHub blob (not `/docs/mcp-local.md` in-app).
- **Review viewport**: `/review` renders `StudioApp` alone at `100dvh`; compact **`StudioSiteNav`** in studio chrome (no stacked marketing header).
- **Code splitting**: separate chunks for `ReviewStudioPage`, `ClassicReviewPage`, landing/agents (PDF worker chunk isolated).

## Release-fix pass (commands & results)

Run from repo root on `cursor/prosume-rebrand-47f5`:

```bash
pnpm typecheck   # exit 0
pnpm test        # 31 files, 170 tests, exit 0
pnpm build       # exit 0; split chunks e.g. ReviewStudioPage ~54kB, ClassicReviewPage ~514kB, pdf.worker ~467kB
```

### Fixes applied

| Issue | Resolution |
| --- | --- |
| `--muted` token collision | Renamed legacy text token to `--text-muted`; updated `index.css` + `studio.css`; kept shadcn `--muted` surface. |
| Broken docs href | `DOCS_MCP_LOCAL_URL` → `https://github.com/unownone/jevsume/blob/main/docs/mcp-local.md` |
| Generic MCP snippets | `mcp-snippets.ts` + per-client tabs (incl. Codex Chat) |
| Unsupported speed/cost copy | Landing proof copy references telemetry only; no sub-second or \$0.042/Mtok total claims |
| `?view=classic` | `LegacyViewRedirect` → `/classic` |
| `/review` overflow | Removed `SiteHeader` wrapper; studio full viewport + in-chrome nav |
| Lazy loading | `React.lazy` + `Suspense` in `SiteApp.tsx` |
| shadcn animations | Added `tw-animate-css`; removed redundant `cn` and `@radix-ui/react-slot` packages |
| `/mcp` UI route | Confirmed no SPA route; `resolveSiteRoute("/mcp")` → landing fallback |

## Verification (latest)

- `pnpm typecheck` — **pass**
- `pnpm test` — **170/170** pass
- `pnpm build` — **pass** (route-level code splitting active)

## Remaining concerns

1. **ClassicReviewPage chunk** still ~514kB (mammoth + review UI) — acceptable split but heavy first visit to `/classic`.
2. **Studio Tailwind migration** incomplete — studio remains on `studio.css`.
3. **Task doc debt** — plan-listed `docs/superpowers/tasks/*.md` not in repo.
4. **DESIGN.md** not regenerated for Pro-sume Persuade surfaces.

## Design references

- Stitch archive screens: `docs/design/prosume-stitch/{landing,review,agents}-desktop.png`
- Voice/claims grounded in `readme.md`, `docs/mcp-local.md`, `PRODUCT.md`

## Commits

Initial revamp: `97df2df`, `b9d4921`, `0b5be23`. Release-fix commit: see latest on branch (`git log -1`).
