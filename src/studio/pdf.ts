import * as pdfjs from "pdfjs-dist";
import { Util } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { isPlausibleGlyph } from "./boxes.ts";
import { flattenGlyphs } from "./ledger.ts";
import type { GlyphBox, LedgerRun, PageMetrics } from "./types.ts";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: data.slice(0) }).promise;
}

function isTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") {
    return false;
  }
  const candidate = item as PdfTextItem;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

export async function collectDocument(pdf: PDFDocumentProxy): Promise<{
  glyphs: GlyphBox[];
  text: string;
  ledger: LedgerRun[];
  pages: PageMetrics[];
}> {
  const glyphs: GlyphBox[] = [];
  const pages: PageMetrics[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ page: pageNumber, width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!isTextItem(item)) {
        continue;
      }
      if (!item.str.trim()) {
        continue;
      }
      const text = item;
      const origin = viewport.convertToViewportPoint(text.transform[4], text.transform[5]);
      const tx = Util.transform(viewport.transform, text.transform);
      const fontHeight = Math.hypot(Number(tx[2]), Number(tx[3]));
      const xScale = Math.hypot(Number(tx[0]), Number(tx[1])) || 1;
      const sourceScale = Math.hypot(Number(text.transform[0]), Number(text.transform[1])) || 1;
      const width = text.width * (xScale / sourceScale);
      const left = Number(origin[0]);
      const baseline = Number(origin[1]);
      const top = baseline - fontHeight;
      const x1 = Math.min(left, left + width);
      const x2 = Math.max(left, left + width);
      const y1 = Math.min(top, baseline);
      const y2 = Math.max(top, baseline);
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || x2 - x1 <= 0 || y2 - y1 <= 0) {
        continue;
      }
      const glyph: GlyphBox = {
        page: pageNumber,
        str: text.str,
        x: (x1 / viewport.width) * 100,
        y: (y1 / viewport.height) * 100,
        w: ((x2 - x1) / viewport.width) * 100,
        h: ((y2 - y1) / viewport.height) * 100,
      };
      if (!isPlausibleGlyph(glyph)) {
        continue;
      }
      glyphs.push(glyph);
    }
  }
  const flattened = flattenGlyphs(glyphs);
  return { ...flattened, pages };
}

export async function collectGlyphs(pdf: PDFDocumentProxy): Promise<GlyphBox[]> {
  return (await collectDocument(pdf)).glyphs;
}

const inflight = new WeakMap<HTMLCanvasElement, { cancel: () => void }>();

function isRenderCancelled(caught: unknown): boolean {
  return Boolean(
    caught &&
      typeof caught === "object" &&
      "name" in caught &&
      (caught as { name: string }).name === "RenderingCancelledException",
  );
}

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<{ width: number; height: number }> {
  inflight.get(canvas)?.cancel();
  const unscaled = page.getViewport({ scale: 1 });
  const outputScale = window.devicePixelRatio || 1;
  const scale = (cssWidth * outputScale) / unscaled.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssWidth * (unscaled.height / unscaled.width)}px`;
  const task = page.render({
    canvas,
    viewport,
  });
  inflight.set(canvas, task);
  try {
    await task.promise;
  } catch (caught) {
    if (!isRenderCancelled(caught)) {
      throw caught;
    }
  }
  return {
    width: cssWidth,
    height: cssWidth * (unscaled.height / unscaled.width),
  };
}
