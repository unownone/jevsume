import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PageOverlay, type SectionBand } from "./PageOverlay.tsx";
import { collectDocument, loadPdf, renderPage } from "./pdf.ts";
import type { GlyphBox, LedgerRun, OverlayFinding, PageBox, PageMetrics } from "./types.ts";

type PdfStageProps = {
  data: ArrayBuffer;
  zoom: number;
  findings: OverlayFinding[];
  sections?: SectionBand[];
  activeId: string | null;
  hoveredId: string | null;
  drawMode: boolean;
  reading: boolean;
  onGlyphs: (glyphs: GlyphBox[]) => void;
  onDocument?: (doc: { glyphs: GlyphBox[]; text: string; ledger: LedgerRun[]; pages: PageMetrics[] }) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDraw: (box: PageBox) => void;
};

export function PdfStage({
  data,
  zoom,
  findings,
  sections = [],
  activeId,
  hoveredId,
  drawMode,
  reading,
  onGlyphs,
  onDocument,
  onSelect,
  onHover,
  onDraw,
}: PdfStageProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const papers = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void loadPdf(data)
      .then(async (document) => {
        if (cancelled) {
          return;
        }
        setPdf(document);
        setPageCount(document.numPages);
        const extracted = await collectDocument(document);
        onGlyphs(extracted.glyphs);
        onDocument?.(extracted);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not read that PDF");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, onGlyphs]);

  useEffect(() => {
    if (!pdf) {
      return;
    }
    let cancelled = false;
    async function paint() {
      for (let pageNumber = 1; pageNumber <= (pdf?.numPages ?? 0); pageNumber += 1) {
        const canvas = papers.current.get(pageNumber);
        const frame = canvas?.parentElement;
        if (!canvas || !pdf || !frame) {
          continue;
        }
        const page = await pdf.getPage(pageNumber);
        const width = frame.clientWidth;
        if (cancelled || width < 32) {
          return;
        }
        await renderPage(page, canvas, width);
      }
    }
    void paint();
    const first = papers.current.get(1)?.parentElement;
    const observer = first ? new ResizeObserver(() => void paint()) : null;
    if (first && observer) {
      observer.observe(first);
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pdf, zoom, pageCount]);

  if (error) {
    return <p className="stage-error">{error}</p>;
  }

  return (
    <div className="paper-stack">
      {Array.from({ length: pageCount }, (_, index) => {
        const page = index + 1;
        return (
          <article className={`paper${reading ? " is-reading" : ""}${findings.length ? " is-marked" : ""}`} key={page} data-page={page}>
            <canvas
              ref={(node) => {
                if (node) {
                  papers.current.set(page, node);
                } else {
                  papers.current.delete(page);
                }
              }}
            />
            <PageOverlay
              page={page}
              findings={findings}
              sections={sections}
              activeId={activeId}
              hoveredId={hoveredId}
              drawMode={drawMode}
              onSelect={onSelect}
              onHover={onHover}
              onDraw={onDraw}
            />
            {reading ? (
              <>
                <div className="scan-line" />
                <div className="reading-veil">Jev is reading this page</div>
                <div className="read-ticks" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
