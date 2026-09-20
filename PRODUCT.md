# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

<!-- inferred from repo + this request; not a live interview -->

People rewriting a resume for a job, usually at a desk or on a phone, who need to see **where** the document fails a parser or a hiring lens — not a wall of extracted text.

## Product Purpose

jevsume is ATS-aware resume review powered by **Jev** (TypeSafe System One). Jev returns typed scores and verdicts; the app composes a **JevScore** and notes. Success is: drop a resume, pick who it is for, and see notes sitting on the page they belong to.

## Positioning

Jev does not write review essays. Neighboring “AI resume” tools generate prose. This product judges fragments and **points at the page**.

## Operating Context

- Resumes arrive as **PDF** (primary). LinkedIn PDF export is a planned second source, not shipped.
- Jev itself is **text-only**. Extraction still happens in the background for scoring; the human canvas must stay the original page.
- Two review lenses: general (default persona) and per-job (stored job persona from a description + tags).
- Cloudflare Worker + D1 store resumes, personas, and evaluation runs.

## Capabilities and Constraints

Confirmed in the running app:

- Client extract of PDF / DOCX / paste, then `POST /api/review`.
- Findings today highlight **flattened text**, not the printed page.
- Rate limits on review and persona creation.

Undecided until this mock is locked:

- Annotation drawing is **manual**, not auto-edit of the PDF.
- Review, chat, and triggers live as **overlays on the preview**, not a second column of source text.
- How a Jev text span maps onto PDF glyph boxes (research in flight).

## Brand Commitments

- Name: **jevsume**. Wordmark: Syne, gold on “sume”.
- Voice: calm, specific, no flash. Existing copy: “Jev reads the words on the page — nothing flashy, just the resume.”
- Incumbent UI: near-black stage (`#07070d`), ivory type, gold / cyan / rose severity.

## Evidence on Hand

- Live SPA: `src/App.tsx`, `src/index.css`.
- Demo resume copy in `App.tsx` (`Jane Doe` / Staff Software Engineer).
- Research: `docs/research/2026-09-17-jev-typesafe-resume-review.md`.
- Do not invent customers, ATS logos, or Jev capabilities beyond typed judgments.

## Product Principles

1. The printed page is the object of work; extracted text is an implementation detail.
2. A note that cannot point at a region is unfinished.
3. Jev judges; the UI writes the sentences the visitor reads.
4. Desktop and phone share one stage: the preview. Chrome overlays it; it does not replace it.
5. Do not silently rewrite the PDF.

## Accessibility & Inclusion

Keyboard must reach every pin and overlay. Contrast on paper (dark ink on white) and on the dark stage both have to hold. Overlay cards must not trap focus or cover the region they explain without a way to dismiss.
