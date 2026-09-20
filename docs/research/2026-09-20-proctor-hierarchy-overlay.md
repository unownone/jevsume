# Proctor hierarchy, scoring, overlay mapping

**Date:** 2026-09-20  
**Scope:** diagnose why suggestions pin to the top of the resume; design the hierarchical Jev proctor.

## Root cause (overlay / “top vs bottom”)

Suggestions and notes are supposed to sit on the resume region they describe. They land on the **top** of the page because three mappings all prefer the start of the document:

1. **PDF extraction is one line per page.** `src/lib/extract.ts` joins every `TextItem.str` with a single space, then joins pages with one newline. A one-page PDF is therefore a single string with **no heading line breaks**. `groupResumeText` only classifies a line that *is* a heading; it cannot see “Skills” in the middle of a space-joined blob. The whole page becomes one `other` / Overview section whose `start` is 0.

2. **Jev spans then fall back to the first fragment.** `fallbackSpan` / `firstSectionSpan` / `spanForDimension` default (`packages/jev/anchors.ts`) return the first body fragment. `boxForNeedle` uses `String.indexOf` (first visual/stream hit). `suggestionsFromAnalysis` uses `lines.find` (first match). Repeated verbs such as “Led” and comma-separated tech lists in early job bullets therefore pin to the **header / first role**, not the later job or the skills dump at the bottom.

3. **Local mock findings are capped top-down.** `reviewFromGlyphs` sorts lines by `y` ascending (top first) and stops at `FINDING_CAP` (28). Long pages never get notes on the bottom third.

Coordinate conversion in `collectGlyphs` (viewport transform, `y = 0` at the top of the page) is consistent with overlay CSS `top: y%`. This is **not** a CSS hack or a missing Y-flip; it is an offset/section-mapping bug. The printed page stays the canvas; the ledger must preserve line geometry.

Sources: local `src/lib/extract.ts`, `worker/ats/group.ts`, `packages/jev/anchors.ts`, `src/studio/boxes.ts`, `src/studio/analyze.ts`, `src/studio/findings.ts`; [PDF.js TextItem / hasEOL](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html); `docs/research/2026-09-20-span-to-region-and-overlay-model.md`.

## Fix

- Flatten PDF text with visual line breaks (`hasEOL` and baseline clustering), not a single space-joined page.
- Keep a **UTF-16 ledger** of each run: `{ flatStart, flatEnd, page, box }`. A Jev span is an interval intersection against that ledger (same extraction the model saw).
- Constrain needles to the owning section’s Y-band; for “rotate later hits”, take the **last** occurrence in visual order.
- Prefer a Skills heading’s dump over the first comma-separated tech list (often a job bullet at the top).

## Jev programming model (no text review)

Jev is System One: typed Score / Choice / Noul only — **no generated review essay**. Narrative copy is assembled in code from labels, legends, and recover points. Official pattern: [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md) (normalize 0–4 in code, apply weights in code). Structure recovery is a **first request** that classifies blocks, then later requests judge each block ([autoformat cookbook](https://docs.typesafe.ai/cookbooks/autoformat.md)).

Price (Jev 1.13): **$0.042 / MTok input; output tokens free**. Report both token counts and estimated USD. Source: [Models](https://docs.typesafe.ai/models.md).

## Hierarchy pass

Code proposes candidate blocks (header, headings, role lines, skill dumps). One SystemOne call classifies each block (`header | summary | job | skills | education | accolades | projects | other`). Consecutive jobs nest under an L1 Experience/body node. That tree is required for scoring and for overlay bands.

## Iterative scoring (always sums to 100)

1. L1 weight Scores (hiring importance). Convert 0–4 to raw weights, mix with kind priors, **largest-remainder** to integers that sum to 100.
2. Per-section (and per-job) rubric Scores in parallel, section-specific.
3. Section points = `weight * score01`. Unscored sections contribute 0, so the overall score **climbs** as inner results arrive.
4. On completion, displayed L1 points are remainder-normalized to the rounded overall (0–100). Suggestion **recover points** = `sectionWeight * dimWeight01 * (1 - current01)`.

## Section rubrics (serious verifier, not one generic scale)

| Kind | Dimensions |
| --- | --- |
| Header | name parseable; contact completeness; ATS text (not image); format consistency |
| Summary | role targeting; quantified proof; length; keyword density without stuffing |
| Job | action verbs; quantified impact; bullet count (3–6); recency; named systems; tense/format consistency; ATS line integrity |
| Skills | unique tokens; proven in experience; ATS separators; relevance density; dump vs evidence |
| Education | school/degree parseable; dates; role relevance; weight appropriate to seniority |
| Accolades | named award; grantor; recency; relevance |
| Projects | named outcome; personal role; metrics; recency |
| Other | parseability; specificity; whether it belongs on this page |

Honesty / “is this true” is **not** asked. Validity is parser structure; evidence is numbered or named claims.

## Streaming

Pass 1: hierarchy. Pass 2: L1 weights. Pass 3: parallel section scoring. NDJSON events to the client: `hierarchy` → `weights` → `section` (score climbs, inner boxes, suggestions with recover points) → `complete` with accumulated usage.
