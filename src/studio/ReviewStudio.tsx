import type { CSSProperties } from "react";
import type { JobTargetFields } from "../../shared/job-target.ts";
import { formatJevScore, scoreTone } from "../../shared/format.ts";
import { SiteFooter } from "../components/SiteFooter.tsx";
import { StudioSiteNav } from "../components/prosume/LegacyViewRedirect.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { studioCopy } from "@/lib/site-copy.ts";
import { DropGate } from "./DropGate.tsx";
import { JobComposer } from "./JobComposer.tsx";
import { Leader } from "./Leader.tsx";
import { OverlayNote } from "./OverlayNote.tsx";
import { PdfStage } from "./PdfStage.tsx";
import type { SectionBand } from "./PageOverlay.tsx";
import { DiagnosticsRail } from "./DiagnosticsRail.tsx";
import { ScorePanel } from "./ScorePanel.tsx";
import type { ChatMessage, GlyphBox, OverlayFinding, PageBox, Scene, StudioScore } from "./types.ts";

export type ReviewStudioProps = {
  scene: Scene;
  reading: boolean;
  targeted: boolean;
  jobOpen: boolean;
  jobLabel: string;
  jobTarget: JobTargetFields;
  resumeText: string;
  filename: string;
  data: ArrayBuffer | null;
  zoom: number;
  score: StudioScore | null;
  selected: string[];
  findings: OverlayFinding[];
  sectionBands: SectionBand[];
  activeId: string | null;
  hoveredId: string | null;
  drawMode: boolean;
  hot: boolean;
  error: string | null;
  demoPresetId: string;
  isNarrow: boolean;
  diagnosticsOpen: boolean;
  active: OverlayFinding | null;
  messages: ChatMessage[];
  draft: string;
  fromRect: DOMRect | null;
  toRect: DOMRect | null;
  noteRef: React.RefObject<HTMLDivElement | null>;
  onJobOpenToggle: () => void;
  onJobClose: () => void;
  onJobTargetChange: (value: JobTargetFields) => void;
  onDiagnosticsOpenChange: (open: boolean) => void;
  onHot: (hot: boolean) => void;
  onFiles: (files: FileList | null) => void;
  onDemoPresetId: (id: string) => void;
  onDemo: (id: string) => void;
  onGlyphs: (glyphs: GlyphBox[]) => void;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onDraw: (box: PageBox) => void;
  onToggleSelected: (id: string) => void;
  onZoomDelta: (delta: number) => void;
  onReview: () => void;
  onDrawModeToggle: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onIgnore: () => void;
  onStepFinding: (delta: number) => void;
};

export function ReviewStudio(props: ReviewStudioProps) {
  const {
    scene,
    reading,
    targeted,
    jobOpen,
    jobLabel,
    jobTarget,
    resumeText,
    filename,
    data,
    zoom,
    score,
    selected,
    findings,
    sectionBands,
    activeId,
    hoveredId,
    drawMode,
    hot,
    error,
    demoPresetId,
    isNarrow,
    diagnosticsOpen,
    active,
    messages,
    draft,
    fromRect,
    toRect,
    noteRef,
    onJobOpenToggle,
    onJobClose,
    onJobTargetChange,
    onDiagnosticsOpenChange,
    onHot,
    onFiles,
    onDemoPresetId,
    onDemo,
    onGlyphs,
    onSelect,
    onHover,
    onDraw,
    onToggleSelected,
    onZoomDelta,
    onReview,
    onDrawModeToggle,
    onDraft,
    onSend,
    onIgnore,
    onStepFinding,
  } = props;

  const showInlineDiagnostics = scene === "reviewed" && !isNarrow;
  const showMobileDiagnostics = scene === "reviewed" && isNarrow;

  const noteDetail =
    active ? (
      <OverlayNote
        key={active.id}
        finding={active}
        messages={messages}
        draft={draft}
        variant="rail"
        total={findings.length}
        onDraft={onDraft}
        onSend={onSend}
        onClose={() => onSelect(null)}
        onIgnore={onIgnore}
        onPrev={() => onStepFinding(-1)}
        onNext={() => onStepFinding(1)}
      />
    ) : null;

  const stageClasses = [
    "stage",
    score && !isNarrow ? "has-score" : "",
    showInlineDiagnostics ? "has-diagnostics" : "",
    active && !isNarrow && !showInlineDiagnostics ? "has-note" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`studio${scene === "reviewed" ? " is-reviewed" : ""}${reading ? " is-loading" : ""}${targeted ? " is-job-targeted" : ""}${isNarrow ? " is-narrow" : " is-wide"}${diagnosticsOpen && isNarrow ? " is-diagnostics-open" : ""}`}
      data-studio-scene={scene}
      data-studio-reading={reading ? "true" : "false"}
      data-studio-viewport={isNarrow ? "narrow" : "wide"}
      style={{ "--zoom": String(zoom) } as CSSProperties}
    >
      <header className="studio-chrome">
        <div className="chrome-start">
          <StudioSiteNav className="studio-site-nav" />
        </div>
        <div className="chrome-center">
          <button
            type="button"
            className={`persona-chip${targeted ? " is-targeted" : ""}${jobOpen ? " is-open" : ""}`}
            aria-expanded={jobOpen}
            aria-controls="job-composer"
            onClick={onJobOpenToggle}
          >
            {scene === "reviewed" && targeted ? `Rated against ${jobLabel}` : jobLabel}
          </button>
          {filename && data ? <span className="file-chip">{filename}</span> : null}
        </div>
        <div className="chrome-end">
          {reading ? (
            <div className="score-orb is-reading" aria-label="Reading">
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {score ? (
            <button
              type="button"
              className={`score-chip ${scoreTone(score.value)}`}
              aria-label={`JevScore ${formatJevScore(score.value)}, ${score.noteCount} notes`}
              onClick={() => {
                if (isNarrow && showMobileDiagnostics) {
                  onDiagnosticsOpenChange(true);
                  return;
                }
                document.querySelector(".score-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}
            >
              <div className={`score-orb ${scoreTone(score.value)}`}>{formatJevScore(score.value)}</div>
              <span>{score.noteCount} notes</span>
            </button>
          ) : null}
        </div>
      </header>

      {jobOpen ? (
        <div className="persona-pop bounce-in" id="job-composer">
          <JobComposer
            value={jobTarget}
            onChange={onJobTargetChange}
            onClose={onJobClose}
            variant="popover"
            resumeText={resumeText}
          />
        </div>
      ) : null}

      <main className={stageClasses}>
        {score && !isNarrow ? (
          <ScorePanel
            score={score}
            selected={selected}
            onToggle={onToggleSelected}
            onOpen={(id) => onSelect(id)}
          />
        ) : null}
        {scene === "empty" || !data ? (
          <DropGate
            hot={hot}
            onHot={onHot}
            onFiles={onFiles}
            demoPresetId={demoPresetId}
            onDemoPresetId={onDemoPresetId}
            onDemo={onDemo}
            jobSlot={<JobComposer value={jobTarget} onChange={onJobTargetChange} resumeText={resumeText} variant="plate" />}
          />
        ) : (
          <PdfStage
            data={data}
            zoom={zoom}
            findings={findings}
            sections={sectionBands}
            activeId={activeId}
            hoveredId={hoveredId}
            drawMode={drawMode}
            reading={reading}
            onGlyphs={onGlyphs}
            onSelect={(id) => {
              onSelect(id);
              if (isNarrow && scene === "reviewed") {
                onDiagnosticsOpenChange(true);
              }
            }}
            onHover={onHover}
            onDraw={onDraw}
          />
        )}
        {showInlineDiagnostics ? (
          <div className="diagnostics-rail-wrap" ref={noteRef}>
            <DiagnosticsRail
              findings={findings}
              activeId={activeId}
              reading={reading}
              onSelect={(id) => onSelect(id)}
              onHover={onHover}
              detailSlot={noteDetail}
            />
          </div>
        ) : active && !isNarrow ? (
          <div className="note-rail" ref={noteRef}>
            {noteDetail}
          </div>
        ) : null}
        {!isNarrow ? <Leader key={active?.id ?? "none"} from={fromRect} to={toRect} /> : null}
      </main>

      {showMobileDiagnostics ? (
        <Sheet open={diagnosticsOpen} onOpenChange={onDiagnosticsOpenChange}>
          <SheetContent side="bottom" className="studio-mobile-sheet" showCloseButton>
            <SheetHeader className="studio-mobile-sheet-head">
              <SheetTitle>{studioCopy.diagnosticsTitle}</SheetTitle>
              <SheetDescription>{studioCopy.diagnosticsHint}</SheetDescription>
            </SheetHeader>
            <div className="studio-mobile-sheet-body">
              <DiagnosticsRail
                findings={findings}
                activeId={activeId}
                reading={reading}
                onSelect={(id) => onSelect(id)}
                onHover={onHover}
                detailSlot={active ? noteDetail : undefined}
                hideIntro
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {data ? (
        <div className="trigger-dock" role="toolbar" aria-label="Page tools">
          <button
            type="button"
            className={`ghost tight${drawMode ? " is-on" : ""}`}
            aria-pressed={drawMode}
            onClick={onDrawModeToggle}
          >
            Draw mark
          </button>
          <button type="button" className="ghost tight" onClick={() => onZoomDelta(-0.15)}>
            −
          </button>
          <span className="zoom-read">{Math.round(zoom * 100)}%</span>
          <button type="button" className="ghost tight" onClick={() => onZoomDelta(0.15)}>
            +
          </button>
          {showMobileDiagnostics ? (
            <button
              type="button"
              className="ghost tight diagnostics-toggle"
              aria-expanded={diagnosticsOpen}
              onClick={() => onDiagnosticsOpenChange(!diagnosticsOpen)}
            >
              Diagnostics
            </button>
          ) : null}
          <button className={`primary tight${reading ? " is-busy" : ""}`} type="button" disabled={reading} onClick={onReview}>
            {reading ? "Reading…" : targeted ? `Review against ${jobLabel}` : "Review with Jev"}
          </button>
          {scene === "reviewed" ? (
            <button
              type="button"
              className={`ghost tight enhance${selected.length > 0 ? " is-armed" : ""}`}
              disabled
              title="Coming soon"
            >
              {selected.length > 0 ? `Enhance ${selected.length}` : "Enhance resume"}
              <span className="soon-tag">Coming soon</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="studio-error">{error}</p> : null}
      <SiteFooter />
    </div>
  );
}
