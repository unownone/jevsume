# Pro-sume Stitch alignment — implementer report

## Status

**Landing motion fix** on branch `cursor/prosume-stitch-alignment-47f5`.

## Landing motion (2026-09-21)

- Section reveals use Framer `whileInView` (`once`, tuned `amount` / margin) via `MotionReveal`; `data-landing-reveal="pending|shown"` for CSS fallback without default-visible class.
- Hero alone uses mount entrance (`data-landing-reveal="shown"`); below-fold sections stay pending until intersection.
- Interactive hero lens toggle + telemetry preset/dimension controls use spring/eased motion (`LandingSegmentedControl`, `AnimatedScoreBar`, score dial spring).
- `prefers-reduced-motion`: immediate visible state, no transform animation; `useInViewOnce` does not auto-reveal all sections in Vitest (no `IntersectionObserver`).
- Tests: `test/landing-motion.test.tsx`, updated landing/UAT CSS assertions; `test/setup-dom.ts` mocks `IntersectionObserver` + `matchMedia` listeners.

## Verification

Run: `pnpm typecheck`, `pnpm test`, `pnpm uat`, `pnpm build`.

## Remaining concerns

- Classic review chunk size unchanged.
- Superdesign pixel diff without auth.
