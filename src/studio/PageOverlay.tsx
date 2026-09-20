import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { OverlayFinding, PageBox } from "./types.ts";
import { severityLabel } from "./severity.ts";

type PageOverlayProps = {
  page: number;
  findings: OverlayFinding[];
  activeId: string | null;
  hoveredId: string | null;
  drawMode: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onDraw: (box: PageBox) => void;
};

type Draft = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function localPercent(event: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * 100,
    y: ((event.clientY - bounds.top) / bounds.height) * 100,
  };
}

export function PageOverlay({
  page,
  findings,
  activeId,
  hoveredId,
  drawMode,
  onSelect,
  onHover,
  onDraw,
}: PageOverlayProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const pageFindings = findings.filter((finding) => finding.box?.page === page && finding.box);

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawMode || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPercent(event);
    origin.current = point;
    setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!origin.current) {
      return;
    }
    const point = localPercent(event);
    const x = Math.min(origin.current.x, point.x);
    const y = Math.min(origin.current.y, point.y);
    setDraft({
      x,
      y,
      w: Math.abs(point.x - origin.current.x),
      h: Math.abs(point.y - origin.current.y),
    });
  }

  function onPointerUp() {
    if (draft && draft.w > 1.2 && draft.h > 0.8) {
      onDraw({ page, ...draft });
    }
    origin.current = null;
    setDraft(null);
  }

  useEffect(() => {
    if (!drawMode) {
      origin.current = null;
      setDraft(null);
    }
  }, [drawMode]);

  return (
    <svg
      className={`page-overlay${drawMode ? " is-draw" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden={drawMode ? undefined : true}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {pageFindings.map((finding) => {
        const box = finding.box;
        if (!box) {
          return null;
        }
        const active = finding.id === activeId;
        const hot = finding.id === hoveredId;
        return (
          <g
            key={finding.id}
            className={`mark-box ${finding.severity}${active ? " is-active" : ""}${hot ? " is-hot" : ""}`}
          >
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              rx={0.7}
              onClick={() => onSelect(finding.id)}
              onMouseEnter={() => onHover(finding.id)}
              onMouseLeave={() => onHover(null)}
            />
            <g
              className="pin"
              transform={`translate(${Math.min(box.x + box.w, 97)} ${box.y})`}
              onClick={() => onSelect(finding.id)}
            >
              <circle r="1.85" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="1.6">
                {severityLabel(finding.severity).slice(0, 1)}
              </text>
            </g>
          </g>
        );
      })}
      {draft ? (
        <rect className="draft-box" x={draft.x} y={draft.y} width={draft.w} height={draft.h} rx={0.7} />
      ) : null}
    </svg>
  );
}
