import { useEffect, useMemo, useRef } from "react";
import type { ReviewResponse } from "../lib/api.ts";
import { buildAnnotatedSegments, severityForFindings } from "../lib/annotate.ts";

type ResumeCanvasProps = {
  text: string;
  findings: ReviewResponse["findings"];
  activeId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function ResumeCanvas({
  text,
  findings,
  activeId,
  hoveredId,
  onSelect,
  onHover,
}: ResumeCanvasProps) {
  const scroller = useRef<HTMLElement>(null);
  const segments = useMemo(
    () =>
      buildAnnotatedSegments(
        text,
        findings.map((finding) => ({
          id: finding.id,
          start: finding.span.start,
          end: finding.span.end,
        })),
      ),
    [text, findings],
  );
  const severities = useMemo(
    () => Object.fromEntries(findings.map((finding) => [finding.id, finding.severity])),
    [findings],
  );

  useEffect(() => {
    if (!activeId || !scroller.current) {
      return;
    }
    const mark = scroller.current.querySelector(`[data-finding-ids~="${CSS.escape(activeId)}"]`);
    mark?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  return (
    <article className="canvas" aria-label="Annotated resume" ref={scroller}>
      <pre className="canvas-text">
        {segments.map((segment, index) => {
          if (segment.findingIds.length === 0) {
            return <span key={index}>{segment.text}</span>;
          }
          const primary = segment.findingIds[0] ?? "";
          const active = Boolean(activeId && segment.findingIds.includes(activeId));
          const hot = Boolean(hoveredId && segment.findingIds.includes(hoveredId));
          const severity = severityForFindings(segment.findingIds, severities);
          return (
            <mark
              key={index}
              tabIndex={0}
              data-finding-ids={segment.findingIds.join(" ")}
              className={`mark ${severity}${active ? " is-active" : ""}${hot ? " is-hot" : ""}`}
              onClick={() => onSelect(primary)}
              onFocus={() => onSelect(primary)}
              onMouseEnter={() => onHover(primary)}
              onMouseLeave={() => onHover(null)}
            >
              {segment.text}
            </mark>
          );
        })}
      </pre>
    </article>
  );
}
