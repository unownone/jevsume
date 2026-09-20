import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { GlyphBox } from "./types.ts";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data }).promise;
}

function isTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") {
    return false;
  }
  const candidate = item as PdfTextItem;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

export async function collectGlyphs(pdf: PDFDocumentProxy): Promise<GlyphBox[]> {
  const glyphs: GlyphBox[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!isTextItem(item)) {
        continue;
      }
      if (!item.str.trim()) {
        continue;
      }
      const text = item;
      const [, , , , e, f] = text.transform;
      const originX = typeof e === "number" ? e : 0;
      const originY = typeof f === "number" ? f : 0;
      const fontHeight = text.height || Math.hypot(Number(text.transform[2]), Number(text.transform[3])) || 11;
      const [x1, y1] = viewport.convertToViewportPoint(originX, originY);
      const [x2, y2] = viewport.convertToViewportPoint(originX + text.width, originY + fontHeight);
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1) || text.width;
      const height = Math.abs(y2 - y1) || fontHeight;
      glyphs.push({
        page: pageNumber,
        str: text.str,
        x: (left / viewport.width) * 100,
        y: (top / viewport.height) * 100,
        w: (width / viewport.width) * 100,
        h: (height / viewport.height) * 100,
      });
    }
  }
  return glyphs;
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
