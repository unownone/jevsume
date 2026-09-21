# Pro-sume Stitch alignment — implementer report

## Status

Branch `cursor/prosume-stitch-alignment-47f5` (PR #17) — **Review studio consolidation**: one Stitch-aligned `ReviewStudio` shell for desktop (1024+) and mobile (≤1023px). `StudioApp` keeps review engine/controller behavior; duplicate compact/mobile presentation paths removed.

## Review studio consolidation (2026-09-21)

| Area | Change |
| --- | --- |
| Shell | `src/studio/ReviewStudio.tsx` — single responsive layout (chrome, score rail, paper, diagnostics, dock, footer) |
| Controller | `src/studio/StudioApp.tsx` — stream/upload/review state only; renders `ReviewStudio` |
| Viewport | `src/studio/useStudioViewport.ts` — 1024px Stitch breakpoint (`data-studio-viewport`) |
| Mobile | shadcn bottom `Sheet` for actionable diagnostics; header score chip; no inline score rail; natural vertical scroll (`overflow-y: auto` on `.studio.is-narrow`) |
| Desktop | Three-region grid unchanged (score panel + paper + diagnostics rail); leader lines when wide |
| Cleanup | Removed parallel `compact` UI branch (separate mobile `OverlayNote` fixed sheet + hidden diagnostics rail) |
| CSS | `studio.css` media query 820px → 1023px; 44px dock targets; paper zoom stays on `.paper` width only |

## Tests added/extended

- `test/review-studio.test.tsx` — empty/loaded/reviewed routes, mobile diagnostics drawer, Escape, zoom `--zoom` on paper only
- `test/review-studio-shell.test.tsx` — `ReviewStudio` wide vs narrow regions
- `test/review-studio-viewport.test.ts` — breakpoint hook
- `test/review-studio-copy.test.ts` — forbidden-claim guardrails + controller wiring
- `tsconfig.vitest.json` — include `test/**/*.test.ts` for `tsc -b` parity with Vitest

## Verification (2026-09-21)

```text
pnpm typecheck          → exit 0 (app + vitest projects; worker refs may need Cloudflare types in some envs)
pnpm test               → exit 0 (43 files, 221 tests)
pnpm uat                → exit 0 (12 tests)
pnpm exec vite build    → exit 0 (client bundle)
```

**Preview:** `pnpm preview --host 0.0.0.0 --port 4173` after `vite build`. Kill stale preview tmux sessions before smoke (stale hashes → 500 on `/assets/*`).

**Playwright smoke** (`http://127.0.0.1:4173`, post-restart preview):

| Viewport | Route | Checks |
| --- | --- | --- |
| 1024×560 | `/review?scene=empty` | Single studio chrome, drop gate, no duplicate marketing header |
| 1024×560 | `/review?scene=loaded` | Paper + dock |
| 1024×560 | `/review?scene=reviewed` | Score rail + diagnostics rail + dock |
| 390×844 | `/review?scene=reviewed` | `data-studio-viewport=narrow`, score chip, diagnostics toggle, no horizontal overflow |

Screenshots (runtime captures, not pixel baselines): `.superpowers/sdd/prosume-stitch-alignment/artifacts/review-*-{desktop-1024,mobile-390}.png`

**Stitch reference comparison (advisory):** Supplied Stitch PNGs differ in data (mock scores/copy) and layout chrome (marketing nav). Measured visually: aligned on charcoal/amber/ivory language, three-region desktop IA, compact mobile header + bottom diagnostics pattern. Not claimed pixel-perfect.

## Remaining concerns

- `pnpm build` (`tsc -b` all project refs) may fail in environments missing generated Cloudflare worker types; client `vite build` succeeds
- `/classic` legacy route retained for `?view=classic` adapter only — not linked from studio shell
- Classic review chunk ~514 kB (informational Vite warning)
- Superdesign CLI unauthenticated — Stitch PNGs used as visual truth

## Claims policy

No unsupported marketing claims on landing, agents, or studio.
