# Studio semantic bridge

Global shadcn/Tailwind tokens in `src/index.css` (`--background`, `--foreground`, `--primary`, …) are mapped onto legacy studio chrome variables in `src/studio/semantic-bridge.css`.

## Bounded legacy exception

PDF canvas presentation keeps local `--paper`, `--paper-ink`, and `--paper-mute` in `studio.css` because the review surface models printed resume paper separately from app chrome. Overlay severity colors inside the canvas also retain calibrated literals for pin/region contrast.

## Migrated controls (this pass)

- `DropGate` primary/outline actions → shadcn `Button`
- `StudioSiteNav` → shadcn `Button` ghost links
- Drop plate SVG fills → `var(--paper)` / semantic accent (no ad-hoc hex in JSX)

## Not migrated (risk)

Score orb gradients, overlay pins, PDF stage layout, and persona popover animations remain on `studio.css` until a dedicated canvas token pass lands.
