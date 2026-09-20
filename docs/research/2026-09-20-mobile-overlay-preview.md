# Mobile PDF preview, hit-testing, and overlay chrome

**Date:** 2026-09-20  
**Scope:** Research only. This note covers a custom jevsume preview built on the PDF.js display layer; it does not propose editing or writing annotations into the PDF.

## Recommendation

Treat each printed PDF page as one scene with three co-registered layers:

1. a PDF.js-rendered canvas,
2. an SVG annotation layer with the same page viewport, and
3. an optional DOM text/accessibility layer.

Store every pin and region in canonical, unscaled **PDF page user space**, keyed by page number. Never persist CSS pixels or the current zoom transform. Project canonical coordinates through the current PDF.js `PageViewport` for paint and invert the same transform for pointer input. PDF.js exposes a page `view` in user-space units and `getViewport({ scale, rotation })`, whose result contains dimensions and the transforms required for rendering ([PDFPageProxy API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html), [PDF.js API source](https://mozilla.github.io/pdf.js/api/draft/api.js.html)).

Place the canvas and SVG under the **same transformed page wrapper**. Live pinch/pan can transform that wrapper once, keeping paper and annotations locked together; after the gesture settles, rerender the canvas at an appropriate PDF.js scale for sharp text while preserving the canonical annotation geometry. This is preferable to separately updating canvas and overlay positions.

Use Pointer Events as the common mouse, pen, and touch input model. Give actual pins/regions pointer targets, while making decorative overlay areas transparent to hits. On phones, open a selected finding in a non-modal bottom sheet over the lower part of the paper. On desktop, use a compact floating card offset from its anchor and keep the marked region visible. Chat can expand to a modal sheet/dialog only when the user explicitly enters a focused composition task.

## Why the paper remains the stage

jevsume's product promise is that findings point at the printed page. The stage should therefore remain visible during review, chat, and trigger selection:

- **Desktop:** center one or more paper pages in a dark scrollable stage. Pins and highlight regions live on-page. A selected pin opens a floating review card near—but not on top of—the region. Clamp the card to the stage viewport and draw a leader back to the anchor. A compact trigger/chat launcher can float at a stage edge.
- **Phone:** show a single-column paper stream edge-to-edge within safe gutters. A tap selects a pin and raises a bottom sheet. Start the sheet at a compact “peek” height so the anchor remains visible; let the user expand it for thread history or chat. The sheet is stage chrome, not part of the transformed page.
- **Both:** selecting a finding may pan/scroll its region into an unobscured area, but must not silently change the document. Keep a visible close action, return focus to the invoking pin, and make every pin keyboard reachable.

The responsive difference is presentation, not data or anchoring. The same thread ID and page-space region drives a desktop card or a phone sheet.

## Coordinate model that survives zoom

### Canonical data

Persist:

```text
pageNumber
region = [pdfX1, pdfY1, pdfX2, pdfY2]  // PDF page user space
anchor = [pdfX, pdfY]                  // optional pin/leader attachment
```

Also retain document identity and the page's intended rotation policy. PDF.js reports `userUnit` as units in 1/72 inch and `view` as the visible page rectangle in user space ([PDFPageProxy API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html)). Do not save device pixels, canvas backing-store pixels, `getBoundingClientRect()` output, or coordinates after CSS pan/zoom.

Normalized page fractions are acceptable at an API boundary, but PDF user-space coordinates are the stronger internal representation because PDF.js already converts between that space and each rendered viewport. If normalized coordinates are used, normalize against the PDF page `view`, not a CSS box.

### Render pipeline

For each page:

1. Build `viewport = page.getViewport({ scale, rotation })`.
2. Size the page wrapper and SVG CSS box to `viewport.width × viewport.height`.
3. Give the SVG a matching `viewBox`.
4. Render the PDF canvas with that viewport. Increase only its backing-store resolution for `devicePixelRatio`; keep its CSS dimensions aligned with the viewport.
5. Convert stored PDF regions to viewport/SVG coordinates with the viewport transform (PDF.js `PageViewport` provides the conversion machinery used by `getViewport`; the viewport contains the transforms required for rendering).
6. Put canvas and SVG in the same page wrapper and apply live pan/zoom to their common ancestor.

CSS `transform` changes the coordinate space, creates a stacking context, and establishes a containing block for positioned descendants ([MDN: `transform`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)). Keep cards and sheets outside that transformed ancestor, or they will scale with the paper and `position: fixed` will no longer behave as viewport chrome.

### Pointer-to-PDF conversion

For an SVG overlay, the least fragile conversion is:

```text
client pointer
  -> inverse(svg.getScreenCTM())
  -> SVG/page viewport point
  -> viewport.convertToPdfPoint(...)
  -> canonical PDF point
```

`getScreenCTM()` returns the matrix from an SVG element's coordinate system to the SVG viewport coordinate system ([MDN: `getScreenCTM`](https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM)). Inverting that matrix accounts for the actual SVG transform stack. This avoids trying to reconstruct nested translate/scale operations from CSS values.

For simple, axis-aligned layouts, `getBoundingClientRect()` can provide a viewport-relative box, and `PointerEvent.clientX/clientY` are also viewport coordinates. However, the returned rectangle is the smallest axis-aligned rectangle containing the element, so it is not enough by itself for arbitrary rotation or skew ([MDN: `getBoundingClientRect`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)). Prefer the inverse matrix path as the general implementation.

The browser's DOM/SVG event target should normally perform hit-testing. Pointer Events define hit-testing in terms of pointer location and visual layout ([MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)), while CSS transforms modify the visual coordinate space. Use explicit coordinate inversion for drawing, marquee selection, proximity selection, or mapping a tap to PDF content—not to replace normal button activation.

## Pointer-event architecture

Pointer Events unify mouse, pen, and touch and expose `pointerId`, `pointerType`, contact dimensions, pressure, and primary-pointer state ([MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)).

Recommended layer behavior:

- Set the SVG overlay root or decorative groups to `pointer-events: none`.
- Restore `pointer-events: auto`, `fill`, `stroke`, or `bounding-box` on interactive SVG shapes as appropriate. SVG-specific values control whether fill, stroke, or bounds receive the hit ([MDN: `pointer-events`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)).
- Render each visual pin with a larger transparent interactive target so touch does not depend on a tiny glyph. MDN recommends targets large enough for the largest contact area.
- Prefer semantic DOM buttons for pins when practical, positioned in the same page coordinate space; they supply keyboard and activation semantics without recreating them in SVG.
- On a one-pointer drag, call `setPointerCapture(pointerId)` after `pointerdown` so movement continues to arrive if the contact leaves the handle. Release or reset state on both `pointerup` and `pointercancel`. Pointer capture retargets later events and suppresses boundary events while active ([MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)).
- Track active pointers by `pointerId`. One pointer may pan or manipulate an annotation; two pointers switch to pinch mode. Do not activate a pin when movement exceeds the tap threshold or a second pointer joins.
- Do not depend on hover. Hover may enrich desktop affordances, but tap/click and focus must expose the same action.

`document.elementFromPoint(clientX, clientY)` returns the topmost element at viewport-relative coordinates and ignores elements with `pointer-events: none` ([MDN: `elementFromPoint`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)). It is useful for diagnostics or resolving stacked targets, but direct event targets and semantic controls should remain the normal path.

## Pinch zoom and pan

There are two distinct zooms:

1. **browser/page zoom**, which changes the visual viewport, and
2. **document-stage zoom**, which changes the PDF scene transform and app zoom state.

The app needs document-stage zoom so page-space annotations remain synchronized and the canvas can be rerendered sharply. Use a gesture state containing the two active pointer positions, initial midpoint, initial distance, initial stage scale, and the PDF point under the midpoint. During movement:

- scale by `currentDistance / initialDistance`, clamped to product limits;
- adjust translation so the PDF point under the initial midpoint remains under the current midpoint;
- transform the common paper wrapper for immediate feedback;
- schedule one crisp PDF.js rerender after the gesture settles rather than rerendering every move.

`touch-action` declares which gestures the browser owns before listeners run. If the browser takes over a gesture, the app receives `pointercancel` ([MDN: `touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)). A fully custom PDF gesture surface therefore needs `touch-action: none` on that surface. Do **not** apply it to the whole application or set a viewport policy that disables user scaling: MDN warns that `touch-action: none` can inhibit browser zoom needed by low-vision users. Provide explicit zoom controls and a fit-width reset in addition to pinch.

An alternative is to leave `touch-action: pan-y pinch-zoom` or `manipulation` and let the browser own page scrolling/zooming, but then custom two-finger PDF zoom will be canceled and app chrome must react to the visual viewport. That is a valid read-only fallback, not a reliable basis for annotation manipulation.

PDF.js's full viewer has a pinch implementation enabled by default according to Mozilla maintainers, while the repository's `examples/mobile-viewer` is intentionally only a limited example and does not include every viewer feature ([Mozilla issue #16328](https://github.com/mozilla/pdf.js/issues/16328), [Mozilla issue #19004](https://github.com/mozilla/pdf.js/issues/19004)). The iframe report in #16328 also shows why jevsume should own the preview directly instead of placing the stock viewer in a cross-document iframe: pointer delivery and overlay composition become harder. PDF.js itself describes its display layer as the rendering API and its viewer as a starting point that embedded products should build upon or reskin ([PDF.js Getting Started](https://mozilla.github.io/pdf.js/getting_started/)).

## Bottom sheets, floating cards, popovers, and dialogs

### Desktop floating card

Use a non-modal card for a selected finding:

- position it in untransformed stage chrome;
- derive a screen anchor from the region's projected viewport rectangle;
- prefer a side that does not cover the region;
- clamp to the visible stage and connect with a leader;
- recompute on stage pan/zoom, scroll, and resize.

The Popover API is suitable for non-modal top-layer review cards and supplies declarative control, toggle events, and light-dismiss behavior. Popovers are explicitly non-modal; focused tasks that must make the rest of the page inert belong in a modal dialog ([MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)).

### Phone bottom sheet

Use the same review content in a bottom-sheet layout:

- fixed to the **visual** viewport rather than nested in the transformed paper;
- three states at most: closed, peek, expanded;
- close button plus drag handle; dragging is an enhancement, never the only close mechanism;
- reserve enough unobscured stage area to keep the selected region visible;
- when the software keyboard appears, size/position against `window.visualViewport`.

Mobile has distinct layout and visual viewports; pinch zoom and the on-screen keyboard can resize or offset the visual viewport without changing the layout viewport ([MDN: Visual Viewport](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)). Listen to visual-viewport resize/scroll when keeping a sheet or composer visible, but avoid continuous “device-fixed” transforms unless necessary because MDN notes they can flicker.

### Modal only for focused chat or confirmation

Use `<dialog>.showModal()` only for states that should suspend paper interaction, such as a full phone chat composer or destructive confirmation. Native modal dialog makes the rest of the document inert, manages initial focus, supports Escape dismissal, and supplies a backdrop; it still needs an explicit close mechanism ([MDN: `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)).

Routine finding inspection should remain non-modal so the user can compare card and paper. On current browsers, Popover is available across the latest browser set but MDN labels it “Baseline 2025”; retain a controlled non-modal card fallback if the product supports older WebViews ([MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)).

## Interaction priority

Use an explicit gesture state machine:

```text
idle
  -> pending-tap
  -> pan
  -> pinch
  -> annotation-drag
  -> idle/cancelled
```

Priority rules:

1. An interactive pin or annotation handle gets first opportunity on `pointerdown`.
2. Two active touch pointers always promote the paper to pinch; suppress click activation.
3. One touch on unoccupied paper pans only after a movement threshold.
4. A short stationary release activates the hit pin/region.
5. Mouse wheel/trackpad zoom should require the chosen modifier and zoom around the pointer; ordinary wheel input scrolls the page stream.
6. `pointercancel`, loss of capture, page visibility changes, and overlay opening all terminate the current gesture safely.

Keep transient gesture coordinates separate from persisted annotation data. Persist only after a completed annotation drag/draw, transformed back to PDF user space.

## Risks and test matrix

- **Transform drift:** independently transformed canvas/SVG layers or CSS-pixel persistence will drift across zoom. Test rotated pages, non-zero page origins, multiple `userUnit` values, fit-width changes, and high-DPI backing stores.
- **Gesture arbitration:** browser takeover produces `pointercancel`. Test Android Chrome, iOS Safari, Firefox Android, touch Windows, trackpads, mouse, and pen.
- **Iframe boundaries:** parent hit-testing returns the iframe element, not descendants, and Mozilla reports iframe pinch complications. Keep the viewer and overlay in the same document.
- **Card occlusion:** test anchors at all four edges and under the phone sheet; pan selected regions into the remaining visible area.
- **Visual viewport:** test browser zoom and software-keyboard opening separately from app PDF zoom.
- **Accessibility:** test Tab/Shift+Tab, Enter/Space activation, Escape, focus return, screen reader names, reduced motion, 200% browser zoom, and explicit zoom controls. Do not make drag or pinch the only route.
- **Performance:** transform during the gesture, debounce expensive rerenders, cancel stale PDF.js render tasks, and avoid layout reads followed by writes in every pointer event.

## Decision

Use `pdfjs-dist` already present in jevsume for rendering, a co-transformed SVG/semantic-DOM annotation layer, PDF user-space persistence, Pointer Events for all direct manipulation, a phone bottom sheet, and desktop non-modal floating cards. Keep overlay chrome outside the transformed paper scene. Do not embed the stock viewer in an iframe, do not persist CSS coordinates, and do not make extracted Jev text the visual review surface.
