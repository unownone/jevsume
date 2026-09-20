# Plan: PDF canvas studio research (pre-implementation)

**Date:** 2026-09-20  
**Status:** research only — visual mock lands in parallel; production wiring waits on design lock.

This is not an implementation plan. Subagent-driven development runs **research tasks** so we can lock the annotation + overlay architecture after the mock.

## Goal

Answer, from primary sources, how jevsume should:

1. Render a resume PDF on a canvas (desktop + mobile).
2. Host a **manual** annotation layer (boxes, pins) that is not an in-place PDF editor.
3. Link Jev findings (text spans) to regions on that page.
4. Overlay review, chat, and triggers **on the preview**, not in a sibling text column.

## Global constraints

- Jev is text-only. Extraction stays; it must not become the human canvas.
- Keep `pdfjs-dist` in play unless a primary-source gap forces a second library.
- No commercial PDF SDK unless open/free options fail a named requirement.
- Mobile and desktop share one coordinate model (page-space boxes, not CSS pixels).
- Do not implement production features in these research tasks.

## Tasks

### Task 1 — PDF.js preview + annotation layer (desktop)

Primary sources: Mozilla PDF.js docs and source, pdfjs-dist 6.x API used in this repo.

Deliverable: `docs/research/2026-09-20-pdfjs-preview-annotation.md`

### Task 2 — Mobile preview, hit-testing, overlay chrome

Primary sources: PDF.js examples, MDN pointer/touch, existing overlay patterns in first-party design tools docs where available.

Deliverable: `docs/research/2026-09-20-mobile-overlay-preview.md`

### Task 3 — Span-to-glyph mapping + overlay comment model

How to project Jev `start/end` (or fragment text) onto PDF.js `getTextContent` boxes; data model for pins, threads, triggers.

Deliverable: `docs/research/2026-09-20-span-to-region-and-overlay-model.md`

### Task 4 — Structured library survey (research-deep)

Fill JSON per `docs/research/pdf-studio/fields.yaml` for each item in `outline.yaml`.

## Out of scope

Shipping the studio as the default product UI. The mock is the design argument; this plan only informs the lock-in.
