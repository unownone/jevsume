import type { DragEvent, ReactNode } from "react";
import { trackClick } from "../lib/events.ts";

type DropGateProps = {
  hot: boolean;
  onHot: (value: boolean) => void;
  onFiles: (files: FileList | null) => void;
  onDemo: () => void;
  jobSlot?: ReactNode;
};

export function DropGate({ hot, onHot, onFiles, onDemo, jobSlot }: DropGateProps) {
  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    onHot(false);
    onFiles(event.dataTransfer.files);
  }

  return (
    <div className="drop-gate">
      <article
        className={`drop-plate${hot ? " is-hot" : ""} bounce-in`}
        onDragOver={(event) => {
          event.preventDefault();
          onHot(true);
        }}
        onDragLeave={() => onHot(false)}
        onDrop={onDrop}
      >
        <PdfGlyph />
        <h1>Drop a resume PDF</h1>
        <p>The page stays a page. Jev reads it underneath, then marks the regions that need work.</p>
        <div className="drop-actions">
          <label className="primary tight">
            Choose PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => onFiles(event.target.files)}
            />
          </label>
          <button className="ghost tight" type="button" onClick={() => {
            trackClick("/demo");
            onDemo();
          }}>
            Load demo PDF
          </button>
        </div>
      </article>
      <article className="drop-plate is-soon bounce-in delay" aria-disabled="true">
        <LinkedInGlyph />
        <h2>LinkedIn PDF</h2>
        <p>Export from LinkedIn, drop it here. Same canvas, same marks. Not wired yet.</p>
        <span className="soon">Coming soon</span>
      </article>
      {jobSlot}
    </div>
  );
}

function PdfGlyph() {
  return (
    <svg className="plate-mark" viewBox="0 0 48 56" aria-hidden="true">
      <rect x="6" y="4" width="36" height="48" rx="3" fill="#f7f4ec" />
      <path d="M14 16h20M14 22h16M14 28h18M14 34h12" stroke="#1a1408" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInGlyph() {
  return (
    <svg className="plate-mark" viewBox="0 0 48 56" aria-hidden="true">
      <rect x="6" y="4" width="36" height="48" rx="3" fill="#d9efe9" />
      <rect x="16" y="18" width="16" height="16" rx="2" fill="#1a5c54" />
    </svg>
  );
}
