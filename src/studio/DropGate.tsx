import type { DragEvent, ReactNode } from "react";
import { DEFAULT_PRESET_ID } from "../../shared/resume-presets.ts";
import { trackClick } from "../lib/events.ts";
import { PresetSelect } from "./PresetSelect.tsx";

type DropGateProps = {
  hot: boolean;
  onHot: (value: boolean) => void;
  onFiles: (files: FileList | null) => void;
  onDemo: (presetId: string) => void;
  demoPresetId: string;
  onDemoPresetId: (id: string) => void;
  jobSlot?: ReactNode;
};

export function DropGate({
  hot,
  onHot,
  onFiles,
  onDemo,
  demoPresetId,
  onDemoPresetId,
  jobSlot,
}: DropGateProps) {
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
        <p>Jev extracts text like a parser, scores sections, and pins notes to regions you can open.</p>
        <div className="demo-preset">
          <PresetSelect
            id="demo-resume-preset"
            value={demoPresetId || DEFAULT_PRESET_ID}
            label="Sample resume"
            onChange={onDemoPresetId}
          />
        </div>
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
            onDemo(demoPresetId || DEFAULT_PRESET_ID);
          }}>
            Load demo PDF
          </button>
        </div>
      </article>
      <article className="drop-plate is-soon bounce-in delay" aria-disabled="true">
        <LinkedInGlyph />
        <h2>LinkedIn PDF</h2>
        <p>Export from LinkedIn when this lane ships. Same studio flow—still being wired.</p>
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
