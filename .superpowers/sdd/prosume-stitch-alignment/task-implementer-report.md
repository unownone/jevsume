# Pro-sume Stitch alignment — implementer report

## Status

**Complete** on branch `cursor/prosume-stitch-alignment-47f5`. Routed Pro-sume revamp (landing `/`, review `/review`, agents `/agents`, classic `/classic`, legacy `?view=classic`) is implemented from `origin/main`, visually grounded in the supplied Stitch archive `stitch_resume_doctor_9bba.zip`, with shadcn/Tailwind v4 semantic tokens and preserved review/studio behavior.

## Ground truth sources

| Source | Use |
| --- | --- |
| `/opt/cursor/artifacts/plans/jevsume_brand_revamp_5eee7c62.plan.md` | Scope, routes, claims policy, verification gates |
| `/home/ubuntu/.cursor/projects/workspace/uploads/stitch_resume_doctor_9bba.zip` | Visual source of truth: `obsidian_precision` / `technical_precision` DESIGN.md, HTML, screenshots |
| `docs/mcp-local.md` | Per-client MCP setup snippets on `/agents` |
| `PRODUCT.md` | Product facts; no invented capabilities |

## Superdesign / tooling

- Bare preflight: `npx --yes @superdesign/cli@latest` — **CLI v0.14.0 runs**; **auth not configured** (`not authenticated`). Continued per skill fallback using Stitch archive + repo context (no invented visuals).
- Impeccable launcher not used; read `PRODUCT.md` and existing studio surfaces directly.

## Stitch handoff reconciliation

| Archive screen | App surface | Notes |
| --- | --- | --- |
| `prosume_pro_resume_feedback_landing_amber_carbon` | `LandingPage` | Syne/Instrument Sans, amber stage gradient, pipeline + proof + CTAs |
| `prosume_desktop_resume_review_studio_amber_carbon` | `ReviewStudioPage` / `StudioApp` | Full-viewport studio; `StudioSiteNav` in chrome; drop/review/score preserved |
| `prosume_desktop_mcp_setup_amber_carbon` | `AgentsPage` | Hosted vs local cards, client tabs, copy-paste snippets |
| `prosume_logo` | `public/prosume-mark.svg`, `favicon.svg` | Stitch SVG mark adopted for header/brand |
| Favicon / apple-touch PNGs | `public/favicon-32.png`, `apple-touch-icon.png` | Resized from archive renders (ffmpeg) |

Reference PNGs: `docs/design/prosume-stitch/{landing,review,agents}-desktop.png`.

## Architecture

- **Router**: `src/SiteApp.tsx` — lazy routes, `LegacyViewRedirect`, metadata + analytics.
- **Shell**: `SiteShell` / `SiteHeader` / `SiteFooter` on marketing surfaces; review uses in-studio nav only.
- **Theme**: `src/index.css` — semantic tokens (`--background`, `--primary` gold, `--accent` cyan, legacy studio aliases `--text-muted`, overlay marks).
- **Primitives**: `src/components/ui/*` (shadcn-style, source-owned).
- **Compositions**: `src/components/prosume/*` (BrandMark, McpSetupSnippet, etc.).
- **MCP**: UI at `/agents`; Worker endpoint `/mcp` unchanged (no SPA route).
- **Identifiers**: Package/repo/MCP remain `jevsume`; public UI brand **Pro-sume**.

## Verification

```bash
pnpm typecheck   # exit 0
pnpm test        # 32 files, 171 tests, exit 0
pnpm build       # exit 0 (lazy chunks: ReviewStudio ~54kB, ClassicReview ~514kB)
```

### Test coverage added/retained

- Route map + legacy `?view=classic` redirect
- Landing/agents UAT (CTA hrefs, metadata, no unsupported speed/cost claims)
- MCP snippet accuracy vs `docs/mcp-local.md`
- Design token collision guard (`--muted` vs `--text-muted`)
- GitHub stars fallback
- shadcn `Button` variants
- **New**: `test/brand-mark.test.tsx` — Stitch logo asset path

### Browser smoke (Playwright MCP on `pnpm preview`)

- `http://127.0.0.1:4173/` — title “Pro-sume — resume review with Jev”
- `/review` — “Review studio — Pro-sume”
- `/agents` — “MCP & agents — Pro-sume”

## Commits on this branch

1. Cherry-picked rebrand stack from `origin/cursor/prosume-rebrand-47f5` (tokens, routes, pages, tests, release fixes).
2. Stitch logo/favicon alignment + brand mark test (this pass).

## Remaining concerns

- Superdesign canvas not used for pixel diff (auth unavailable); visual QA relies on Stitch PNGs + manual preview.
- `ClassicReviewPage` chunk remains large (~514kB) due to PDF/text review bundle.
- Hosted GitHub star count still depends on API availability (fallback copy in place).
- Stitch HTML uses Material Symbols; app uses Lucide equivalents (semantic match, not glyph-for-glyph).
- Live Stitch project ID `16559754436933381694` not reconciled via Stitch MCP (blocked).

## Claims policy (verified)

- No fake privacy/customer counts, ATS certification, automatic rewriting, or unverified sub-second / fixed-cost totals on landing.
- Review copy describes typed Jev judgments and UI-rendered findings; PDF overlay behavior unchanged from shipped studio.
