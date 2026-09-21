import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { sitePath } from "@/lib/routes.ts";
import { studioCopy } from "@/lib/site-copy.ts";
import type { OverlayFinding } from "./types.ts";

type DiagnosticsRailProps = {
  findings: OverlayFinding[];
  activeId: string | null;
  reading: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  detailSlot?: ReactNode;
  hideIntro?: boolean;
};

export function DiagnosticsRail({ findings, onSelect, detailSlot, hideIntro }: DiagnosticsRailProps) {
  const jevFindings = findings.filter((item) => item.origin === "jev");
  return (
    <aside className="diagnostics-rail" aria-label={studioCopy.diagnosticsTitle} data-studio-panel="diagnostics">
      {detailSlot ? (
        <div className="diagnostics-detail">{detailSlot}</div>
      ) : (
        <>
          {hideIntro ? null : (
            <header className="diagnostics-head">
              <h2>{studioCopy.diagnosticsTitle}</h2>
              <p>{studioCopy.diagnosticsHint}</p>
            </header>
          )}
          <ol className="diagnostics-list">
            {jevFindings.map((finding) => (
              <li key={finding.id}>
                <button type="button" className="diagnostics-card" onClick={() => onSelect(finding.id)}>
                  <strong>{finding.title}</strong>
                  <p>{finding.detail}</p>
                  <span className="diagnostics-inspect">{studioCopy.inspectCta}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <footer className="diagnostics-mcp">
        <Button variant="outline" size="sm" className="studio-action" asChild>
          <Link to={sitePath("agents")}>{studioCopy.mcpCta}</Link>
        </Button>
      </footer>
    </aside>
  );
}
