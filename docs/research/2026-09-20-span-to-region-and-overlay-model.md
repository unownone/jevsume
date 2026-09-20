# Mapping Jev spans to PDF regions and overlay state

**Date:** 2026-09-20  
**Scope:** research only; no product UI or PDF mutation

## Recommendation

Keep the uploaded PDF immutable. Treat PDF.js as the renderer and geometry source, and store Jev findings, manual pins, threads, and triggers as application data keyed to a specific PDF revision. The preview should project application anchors into an SVG/DOM layer above the page; it should not add annotation dictionaries to the user's file.

Use this normalized page-space rectangle at the overlay boundary:

```ts
type PageBox = {
  page: number; // 1-based PDF page number
  x: number;    // 0..1 from the canonical page's left edge
  y: number;    // 0..1 from the canonical page's top edge
  w: number;    // 0..1 of canonical page width
  h: number;    // 0..1 of canonical page height
};
```

The canonical page is `page.getViewport({ scale: 1 })`, including the PDF page's intrinsic rotation. Normalize a viewport rectangle with `x / viewport.width`, `y / viewport.height`, `w / viewport.width`, and `h / viewport.height`. A renderer multiplies those values by its current CSS page dimensions. Keep full floating-point values, not display percentages. If the viewer adds user-controlled rotation, transform from the canonical orientation at render time instead of rewriting stored boxes.

For interoperability and diagnostics, an anchor may additionally retain the source PDF user-space rectangle and `page.view` (`[xMin, yMin, xMax, yMax]`). Hypothes.is currently uses PDF user-space points for shape selectors. The normalized `PageBox` remains the simple Jevsume overlay contract.

## What PDF.js actually exposes

`PDFPageProxy.getTextContent()` returns a page `TextContent`; each `TextItem` contains `str`, `dir`, `transform`, `width`, `height`, `fontName`, and `hasEOL`. PDF.js also states that whitespace occurrences are replaced by ordinary spaces. A `TextItem` is a text run, not a guaranteed word, character, or glyph. PDF.js maintainers explicitly say item combination is heuristic and even disabling combination does not guarantee one item per word; the supported API does not expose an individual box for every glyph.

The PDF.js text-layer implementation is the best reference for laying these runs out. It composes the page and item transforms, derives the angle with `atan2`, derives font height with `hypot`, adjusts the baseline using font ascent, and scales run width to the extracted `TextItem.width`. `PageViewport` applies PDF user units, crop/view box, rotation, scale, and the PDF-bottom-left to viewport-top-left flip. Its `convertToViewportPoint` and inverse are the supported coordinate bridge.

Sources: [PDFPageProxy API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html), [TextItem API typedef](https://mozilla.github.io/pdf.js/api/draft/api.js.html), [PDF.js TextLayer source](https://github.com/mozilla/pdf.js/blob/master/src/display/text_layer.js), [PageViewport source](https://github.com/mozilla/pdf.js/blob/master/src/display/page_viewport.js), [PDF.js issue on item granularity](https://github.com/mozilla/pdf.js/issues/13047), [PDF.js issue on individual glyph positions](https://github.com/mozilla/pdf.js/issues/7996).

## Span-to-region pipeline

### 1. Preserve an extraction ledger

Today `src/lib/extract.ts` creates each page with:

```text
TextItem.str joined with one synthetic space
```

and joins pages with one synthetic newline. Jev's `{start,end,line}` therefore addresses that exact flattened string, not PDF content-stream offsets or text-layer DOM offsets. The inserted spaces also ignore `hasEOL`; `line` is not sufficient geometry.

At extraction time, retain a ledger alongside the exact text sent to Jev:

```ts
type TextRunRef = {
  page: number;
  itemIndex: number;
  flatStart: number;
  flatEnd: number;
  itemText: string;
  itemStart: number; // normally 0
  itemEnd: number;   // itemText.length, in JS UTF-16 units
};
```

Synthetic separators need ledger entries too, marked as having no geometry. This makes a Jev span a deterministic interval intersection against page items. Use JavaScript UTF-16 offsets throughout because Jev's current spans are consumed with `String.slice`; do not silently change to Unicode code-point indices.

Also persist:

- a cryptographic hash or immutable revision ID for the PDF bytes;
- the exact flattened extraction text or its hash;
- the exact quote `resumeText.slice(start, end)` plus short prefix/suffix context;
- the PDF.js version and extraction policy.

An offset is valid only against the same document revision and extraction policy.

### 2. Resolve the Jev interval

For each finding:

1. Clamp and validate `start < end`.
2. Verify the stored exact quote against the current flattened text.
3. Intersect `[start,end)` with ledger entries.
4. Convert each overlap into local `[itemStart,itemEnd)` UTF-16 offsets.
5. Ignore synthetic separators for geometry, but keep them when checking the quote.
6. Group resulting rectangles by page and visual line; merge only adjacent boxes with compatible baseline/height and a small horizontal gap. Do not union an entire multi-line finding into one large rectangle.

The result is `regions: PageBox[]`, not one box. Multi-column text, wrapped lines, and page crossings require multiple boxes.

### 3. Recover visual rectangles

Preferred browser path:

1. Call `getTextContent()` once and use that same object for extraction and a PDF.js `TextLayer`.
2. Preserve the item-to-text-node mapping in item order.
3. Translate each ledger overlap to offsets in the corresponding text node.
4. Create a DOM `Range` and read `range.getClientRects()`.
5. Subtract the page container's client rectangle, then normalize by its width and height.

This delegates transforms, font ascent, horizontal scaling, writing direction, and rotated runs to PDF.js and browser layout. It yields character-subrange rectangles but still does not claim true font-outline glyph bounds.

Headless or pre-render fallback:

1. Compose `viewport.transform` with `item.transform`.
2. Use the transformed baseline/orientation and `TextItem.width`/`height` to build an item quadrilateral.
3. For a partial item, interpolate along the run's writing direction by the selected UTF-16 fraction.
4. Axis-align the transformed corners for `PageBox`, retaining the quadrilateral if later precision is needed.
5. Mark the anchor `geometryQuality: "run-approximation"`.

Equal character fractions are only an approximation for proportional fonts, kerning, ligatures, combining marks, bidirectional text, and vertical writing. The DOM text-layer range is therefore preferred.

### 4. Re-anchor when exact offsets fail

Follow the useful parts of the Hypothes.is strategy:

1. Try the `TextPositionSelector`-like flattened offset first because it is fastest.
2. Require the exact quote to match before accepting it.
3. Fall back to quote matching using `exact`, `prefix`, and `suffix`, with the old page/offset as a hint.
4. Align strings while tolerating PDF.js whitespace and Unicode-normalization differences.
5. Accept only a unique/high-confidence match; otherwise show the finding as unanchored instead of highlighting the wrong text.

Hypothes.is current source stores text selections with `TextPositionSelector`, `TextQuoteSelector`, and a zero-based `PageSelector`. It tries position first, verifies the quote, falls back to quote matching, ignores ASCII-space differences during PDF quote search, and translates offsets between extracted text and the rendered text layer with Unicode normalization. Its shape workflow stores a `PageSelector` plus `ShapeSelector` in PDF user-space coordinates. These are patterns to adopt, not wire-compatible Jevsume storage requirements.

Sources: [Hypothesis PDF anchoring source](https://github.com/hypothesis/client/blob/main/src/annotator/anchoring/pdf.ts), [Hypothesis selector types](https://github.com/hypothesis/client/blob/main/src/types/api.ts), [normalization fix](https://github.com/hypothesis/client/commit/c78d0d8f459414eed3a2b46d049e1db096e4b24c), [PDF-region design history](https://github.com/hypothesis/client/issues/3720).

### 5. Explicit failure states

Use an anchor status rather than inventing geometry:

- `anchored`: exact ledger and geometry match;
- `reanchored`: quote/context fallback produced a unique match;
- `approximate`: only run-level interpolation is available;
- `orphaned`: no safe match;
- `unavailable`: image-only/scanned PDF has no usable text.

OCR is a separate feature and coordinate source. It should not be implied by PDF.js text extraction.

## Overlay data model

Separate durable semantic objects from current visual state:

```ts
type Anchor = {
  id: string;
  documentId: string;
  documentRevision: string; // hash/revision of original bytes
  origin: "jev-span" | "manual-region" | "manual-pin";
  selectors?: {
    position?: { start: number; end: number };
    quote?: { exact: string; prefix?: string; suffix?: string };
    pageHint?: number;
  };
  regions: PageBox[];
  pin?: { page: number; x: number; y: number }; // normalized top-left space
  status: "anchored" | "reanchored" | "approximate" | "orphaned" | "unavailable";
  geometryQuality: "text-layer-range" | "run-approximation" | "manual";
};

type CommentThread = {
  id: string;
  anchorId: string;
  findingId?: string;
  state: "open" | "resolved";
  createdAt: string;
  createdBy: string;
  messages: Array<{
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    editedAt?: string;
  }>;
};

type OverlayTrigger = {
  id: string;
  anchorId: string;
  threadId?: string;
  findingId?: string;
  activation: "click" | "keyboard" | "programmatic";
  action: "focus-finding" | "open-thread" | "start-thread";
  presentation: "region" | "pin" | "region-and-pin";
};
```

Store pin coordinates independently from region boxes so a user can reposition a pin without corrupting the text anchor. A finding may reference one anchor and one optional thread; several triggers may open the same thread from a highlight, pin, findings list, or keyboard navigation. Hover and selection are ephemeral UI state and do not belong in these records.

Recommended invariants:

- all anchor geometry belongs to exactly one immutable document revision;
- every region and pin is page-local and normalized to `[0,1]`;
- a thread survives re-anchoring because it references `anchorId`, not coordinates;
- trigger actions are declarative and contain no arbitrary executable code;
- deleting or resolving a thread does not alter the original PDF;
- export is a separate, explicit operation that creates a new file.

## ISO 32000 annotations versus the application overlay

ISO 32000-1:2008 defines annotations as objects associated with page locations. A page's `/Annots` array references annotation dictionaries. Common entries include `/Subtype`, required `/Rect`, optional `/Contents`, `/NM`, `/M`, flags `/F`, and appearance dictionary `/AP`. Markup annotations add author `/T`, `/Popup`, opacity `/CA`, rich text `/RC`, creation date, subject, and reply relationships `/IRT` plus `/RT`; `/RT /R` is the standard threaded-reply relationship. Text-markup subtypes are `/Highlight`, `/Underline`, `/Squiggly`, and `/StrikeOut`, with required `/QuadPoints` in default user space. A supplied appearance stream can take precedence over `QuadPoints`.

Those dictionaries are a valid *export format*, but adding them requires writing a changed PDF (even if implemented as an incremental update). It also exposes Jevsume state to other PDF viewers, invokes viewer-dependent annotation appearances, and couples application threads to PDF reply semantics. None of that is needed for an in-app review overlay.

Therefore:

- default: keep annotations in Jevsume storage and render a non-mutating overlay;
- preserve and render existing PDF-owned annotations separately if desired;
- never overwrite or silently append to the uploaded bytes;
- if PDF export is later offered, label it clearly as “Export annotated copy,” create a new artifact, and test `/Rect`, `/QuadPoints`, appearance streams, replies, permissions, and signatures across viewers.

Source: [Adobe-hosted ISO 32000-1:2008, clauses 12.5.2, 12.5.6.2, and 12.5.6.10](https://opensource.adobe.com/dc-acrobat-sdk-docs/standards/pdfstandards/pdf/PDF32000_2008.pdf).

## LinkedIn PDF caveats

LinkedIn's current first-party help says “Save to PDF” is a desktop-only profile feature, is limited to profiles whose profile language is English, may not be available to every member, and currently supports only English characters. LinkedIn warns that other language settings can produce translation mismatches and improper rendering. The current English help page also states a limit of 200 profile PDF downloads per month.

Product implications:

- describe LinkedIn PDF upload as one input path, not a mobile LinkedIn integration;
- expect generated layout and section ordering rather than the member's original resume layout;
- do not promise support for non-English LinkedIn profile PDFs based on this export path;
- treat the downloaded PDF like any other immutable upload and verify that it has an extractable text layer;
- do not rely on LinkedIn export availability or quota for the core flow.

Source: [LinkedIn Help — Save a profile as a PDF](https://www.linkedin.com/help/linkedin/answer/a541960/save-a-profile-as-a-pdf?lang=en).

## Validation cases before implementation

Build a fixture set that includes proportional fonts, ligatures, combining characters, RTL and vertical text, rotated pages, crop boxes with non-zero origins, two columns, wrapped findings, a finding crossing pages, repeated phrases, headers/footers, and an image-only scan. Assert that:

1. the extraction ledger reproduces the exact Jev input byte-for-byte;
2. every accepted anchor's quote round-trips through its ledger interval;
3. normalized boxes stay aligned at multiple zoom levels and viewport sizes;
4. ambiguous quote matches become orphaned rather than misplaced;
5. overlay actions never change the uploaded PDF bytes.
