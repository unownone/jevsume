import { useEffect } from "react";
import type { ReviewResponse } from "../lib/api.ts";

type FindingsPanelProps = {
  findings: ReviewResponse["findings"];
  suggestions: ReviewResponse["suggestions"];
  activeId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

function suggestionFor(findingId: string, suggestions: ReviewResponse["suggestions"]) {
  return suggestions.find((item) => item.findingId === findingId || item.id === findingId);
}

export function FindingsPanel({
  findings,
  suggestions,
  activeId,
  hoveredId,
  onSelect,
  onHover,
}: FindingsPanelProps) {
  useEffect(() => {
    if (!activeId) {
      return;
    }
    document.getElementById(`finding-${activeId}`)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeId]);

  return (
    <div className="findings" role="list" aria-label="Jev notes">
      {findings.map((finding) => {
        const linked = suggestionFor(finding.id, suggestions);
        const active = finding.id === activeId || finding.id === hoveredId;
        return (
          <article
            key={finding.id}
            id={`finding-${finding.id}`}
            role="listitem"
            className={`finding ${finding.severity}${active ? " is-active" : ""}`}
            tabIndex={0}
            onClick={() => onSelect(finding.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(finding.id);
              }
            }}
            onMouseEnter={() => onHover(finding.id)}
            onMouseLeave={() => onHover(null)}
          >
            <header>
              <span className={`pill ${finding.severity}`}>{finding.severity}</span>
              <strong>{finding.title}</strong>
              <span className="line-ref">line {finding.span.line}</span>
            </header>
            <p>{finding.detail}</p>
            {finding.suggestedRewrite ? (
              <p className="rewrite">{finding.suggestedRewrite}</p>
            ) : null}
            {linked && linked.text !== finding.suggestedRewrite ? (
              <p className="hint">{linked.text}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
