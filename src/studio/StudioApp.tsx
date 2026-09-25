import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SectionBand } from "./PageOverlay.tsx";
import { streamReview } from "../lib/api.ts";
import {
  EMPTY_JOB_TARGET,
  hasJobTarget,
  jobTargetLabel,
  type JobTargetFields,
} from "../../shared/job-target.ts";
import {
  DEFAULT_PRESET,
  DEFAULT_PRESET_ID,
  jobFieldsFromPreset,
  presetById,
} from "../../shared/resume-presets.ts";
import { validityEvidenceFromTree } from "../../shared/score-pair.ts";
import { decorateStudioScore, fillWaitingJudgeLines, linesFromGlyphs, reviewFromGlyphs, scoreFromDocument } from "./findings.ts";
import { boxForSpan, flattenGlyphs } from "./ledger.ts";
import { pdfBufferFromResumeText } from "./resume-pdf.ts";
import { ReviewStudio } from "./ReviewStudio.tsx";
import { useStudioViewport } from "./useStudioViewport.ts";
import "./studio.css";
import "./semantic-bridge.css";
import { trackClick } from "../lib/events.ts";
import type { ChatMessage, GlyphBox, LedgerRun, OverlayFinding, PageBox, Scene, StudioScore } from "./types.ts";

function sceneFromSearch(): Scene | null {
  const value = new URLSearchParams(window.location.search).get("scene");
  if (value === "empty" || value === "loaded" || value === "reviewed") {
    return value;
  }
  return null;
}

export default function StudioApp() {
  const [scene, setScene] = useState<Scene>(() => sceneFromSearch() ?? "empty");
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = useState("demo-resume.pdf");
  const [glyphs, setGlyphs] = useState<GlyphBox[]>([]);
  const [findings, setFindings] = useState<OverlayFinding[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [reading, setReading] = useState(false);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [zoom, setZoom] = useState(1);
  const [hot, setHot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [jobTarget, setJobTarget] = useState<JobTargetFields>(EMPTY_JOB_TARGET);
  const [demoPresetId, setDemoPresetId] = useState(DEFAULT_PRESET_ID);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [fromRect, setFromRect] = useState<DOMRect | null>(null);
  const [toRect, setToRect] = useState<DOMRect | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerRun[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [sectionBands, setSectionBands] = useState<SectionBand[]>([]);
  const [liveScore, setLiveScore] = useState<StudioScore | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const markRef = useRef(1);
  const glyphsRef = useRef<GlyphBox[]>([]);
  const isNarrowRef = useRef(false);
  const jobTargetRef = useRef(jobTarget);
  const { isNarrow } = useStudioViewport();

  glyphsRef.current = glyphs;
  isNarrowRef.current = isNarrow;
  jobTargetRef.current = jobTarget;

  const active = findings.find((finding) => finding.id === activeId) ?? null;
  const score = useMemo(() => {
    let next: StudioScore | null = null;
    const judged = findings.filter((item) => item.origin === "jev");
    const lines = glyphs.length > 0 ? linesFromGlyphs(glyphs) : [];
    if (scene !== "reviewed") {
      next = liveScore;
    } else if (liveScore) {
      next = liveScore;
    } else if (judged.length > 0) {
      next = scoreFromDocument(lines, judged, jobTarget);
    }
    if (!next) {
      return null;
    }
    if (liveScore) {
      next = decorateStudioScore(next, lines, judged, jobTarget);
    }
    if (hasJobTarget(jobTarget)) {
      return {
        ...next,
        targetLabel: jobTargetLabel(jobTarget),
        targetFit: next.targetFit,
      };
    }
    return { ...next, targetLabel: undefined, targetFit: undefined };
  }, [findings, glyphs, jobTarget, liveScore, scene]);

  const stepFinding = useCallback((delta: number) => {
    setActiveId((current) => {
      const index = findings.findIndex((item) => item.id === current);
      const next = findings[index + delta];
      return next?.id ?? current;
    });
    setDraft("");
  }, [findings]);

  const onGlyphs = useCallback((next: GlyphBox[]) => {
    setGlyphs(next);
    const flat = flattenGlyphs(next);
    setResumeText(flat.text);
    setLedger(flat.ledger);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveId(null);
        setDrawMode(false);
        setJobOpen(false);
        setDiagnosticsOpen(false);
      }
      if (event.key === "ArrowRight") {
        stepFinding(1);
      }
      if (event.key === "ArrowLeft") {
        stepFinding(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepFinding]);

  const loadBuffer = useCallback(async (buffer: ArrayBuffer, name: string, next: Scene = "loaded") => {
    setError(null);
    setData(buffer);
    setFilename(name);
    setScene(next);
    setFindings([]);
    setActiveId(null);
    setDrawMode(false);
    setThreads({});
    setGlyphs([]);
    setSelected([]);
    setLiveScore(null);
    setSectionBands([]);
    setLedger([]);
    setResumeText("");
  }, []);

  const loadDemo = useCallback(
    async (next: Scene = "loaded", presetId = DEFAULT_PRESET_ID) => {
      const preset = presetById(presetId) ?? DEFAULT_PRESET;
      await loadBuffer(pdfBufferFromResumeText(preset.resumeText), `${preset.id}.pdf`, next);
      setJobTarget(jobFieldsFromPreset(preset));
      setDemoPresetId(preset.id);
    },
    [loadBuffer],
  );

  useEffect(() => {
    const wanted = sceneFromSearch();
    if (wanted === "loaded" || wanted === "reviewed") {
      void loadDemo(wanted);
    }
  }, [loadDemo]);

  const attachFromPage = useCallback((nextGlyphs: GlyphBox[]) => {
    const reviewed = reviewFromGlyphs(nextGlyphs, jobTargetRef.current);
    setFindings(reviewed.findings);
    setThreads(
      Object.fromEntries(
        reviewed.findings.map((finding) => [
          finding.id,
          [{ id: `${finding.id}-jev`, from: "jev" as const, text: finding.detail }],
        ]),
      ),
    );
    setActiveId(isNarrowRef.current ? null : (reviewed.findings[0]?.id ?? null));
    setSelected([]);
  }, []);

  useEffect(() => {
    if (reading || liveScore || scene !== "reviewed" || glyphs.length === 0) {
      return;
    }
    if (findings.some((item) => item.origin === "jev")) {
      return;
    }
    attachFromPage(glyphs);
  }, [attachFromPage, findings, glyphs, reading, scene]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Drop a PDF — the page is the canvas.");
      return;
    }
    trackClick("/upload");
    await loadBuffer(await file.arrayBuffer(), file.name);
  }

  async function onReview() {
    if (!data) {
      return;
    }
    trackClick("/review");
    setReading(true);
    setDrawMode(false);
    setError(null);
    setFindings([]);
    setActiveId(null);
    setLiveScore(null);
    setSectionBands([]);
    const started = Date.now();
    while (glyphsRef.current.length === 0 && Date.now() - started < 2500) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    if (glyphsRef.current.length === 0) {
      setError("The page is still rendering. Try Review with Jev again.");
      setReading(false);
      return;
    }
    const flat = flattenGlyphs(glyphsRef.current);
    const text = resumeText || flat.text;
    const runs = ledger.length > 0 ? ledger : flat.ledger;
    setScene("reviewed");
    try {
      for await (const event of streamReview(text, undefined, jobTargetRef.current)) {
        const type = event.type;
        if (type === "error") {
          throw new Error(typeof event.message === "string" ? event.message : "Review failed");
        }
        if (type === "hierarchy" && Array.isArray(event.roots)) {
          setSectionBands(bandsFromRoots(event.roots, runs, false));
          setLiveScore((current) =>
            mergeLiveScore(current, {
              value: 0,
              ...pairPatch(event.roots),
              telemetry: event.telemetry as StudioScore["telemetry"],
            }),
          );
        }
        if (type === "weights" && Array.isArray(event.roots)) {
          setSectionBands(bandsFromRoots(event.roots, runs, false));
          setLiveScore((current) =>
            mergeLiveScore(current, {
              ...pairPatch(event.roots),
              telemetry: event.telemetry as StudioScore["telemetry"],
            }),
          );
        }
        if (type === "section") {
          const overall = typeof event.overall === "number" ? event.overall : 0;
          const node = event.node as { id?: string; title?: string; start?: number; end?: number; status?: "pending" | "scored" };
          const liveRoots = Array.isArray(event.roots) ? event.roots : null;
          if (liveRoots) {
            setSectionBands((current) => mergeBands(current, bandsFromRoots(liveRoots, runs, true)));
          } else if (typeof node.start === "number" && typeof node.end === "number" && node.id) {
            const box = boxForSpan(runs, node.start, node.end);
            if (box) {
              setSectionBands((current) =>
                upsertBand(current, {
                  id: node.id ?? "section",
                  title: node.title ?? "Section",
                  status: node.status ?? "scored",
                  box,
                }),
              );
            }
          }
          const incoming = Array.isArray(event.findings) ? event.findings : [];
          const mapped = incoming.flatMap((item, index) => {
            const finding = item as {
              id?: string;
              severity?: OverlayFinding["severity"];
              title?: string;
              detail?: string;
              span?: { start: number; end: number };
            };
            const box = finding.span ? boxForSpan(runs, finding.span.start, finding.span.end) : null;
            if (!finding.title) {
              return [];
            }
            return [
              {
                id: finding.id ?? `jev-${node.id ?? index}`,
                severity: finding.severity ?? "partial",
                title: finding.title,
                detail: finding.detail ?? "",
                needle: finding.title,
                box,
                origin: "jev" as const,
                index: index + 1,
                quote: node.title,
              } satisfies OverlayFinding,
            ];
          });
          if (mapped.length > 0) {
            setFindings((current) => {
              const next = [...current, ...mapped.filter((item) => !current.some((row) => row.id === item.id))];
              return next.map((item, index) => ({ ...item, index: index + 1 }));
            });
            setThreads((current) => {
              const next = { ...current };
              for (const finding of mapped) {
                next[finding.id] = [{ id: `${finding.id}-jev`, from: "jev", text: finding.detail }];
              }
              return next;
            });
          }
          const suggestions = Array.isArray(event.suggestions) ? event.suggestions : [];
          const fromRoots = liveRoots ? pairPatch(liveRoots) : null;
          setLiveScore((current) =>
            mergeLiveScore(current, {
              value: overall,
              noteCount: (current?.noteCount ?? 0) + mapped.length,
              ...(fromRoots ?? {}),
              validity:
                typeof event.validity === "number"
                  ? event.validity
                  : (fromRoots?.validity ?? current?.validity ?? 0),
              evidence:
                typeof event.evidence === "number"
                  ? event.evidence
                  : (fromRoots?.evidence ?? current?.evidence ?? 0),
              suggestions: suggestions.map((item) => {
                const suggestion = item as {
                  id?: string;
                  text?: string;
                  recoverPoints?: number;
                  span?: { start: number; end: number };
                };
                const box = suggestion.span ? boxForSpan(runs, suggestion.span.start, suggestion.span.end) : null;
                return {
                  id: suggestion.id ?? crypto.randomUUID(),
                  kind: "add-metric" as const,
                  title: suggestion.text ?? "Suggestion",
                  detail: suggestion.recoverPoints
                    ? `Recover ${suggestion.recoverPoints} by applying this.`
                    : suggestion.text ?? "",
                  recoverPoints: suggestion.recoverPoints,
                  box,
                };
              }),
              telemetry: event.telemetry as StudioScore["telemetry"],
            }),
          );
        }
        if (type === "complete" && event.review && typeof event.review === "object") {
          const review = event.review as {
            jevScore?: { value?: number };
            conformityScore?: { value?: number };
            jobMatchScore?: { value?: number } | null;
            jobComparison?: {
              expected: string[];
              goodToHave: string[];
              missingSkills: string[];
              availableSkills: string[];
              skillGap: Array<{ name: string }>;
              skillsValidated: Array<{ name: string }>;
            };
            validity?: number;
            evidence?: number;
            suggestions?: Array<{ id?: string; text?: string; recoverPoints?: number; span?: { start: number; end: number } }>;
            hierarchy?: StudioScore["hierarchy"];
            telemetry?: StudioScore["telemetry"];
            verdict?: string;
          };
          const pair = review.hierarchy ? pairPatch(review.hierarchy) : { validity: 0, evidence: 0 };
          setLiveScore((current) =>
            mergeLiveScore(current, {
              value: review.jevScore?.value ?? current?.value ?? 0,
              conformity: review.conformityScore?.value ?? review.jevScore?.value ?? current?.conformity,
              jobMatch: review.jobMatchScore?.value ?? null,
              comparison: review.jobComparison
                ? {
                    expected: review.jobComparison.expected,
                    goodToHave: review.jobComparison.goodToHave,
                    missingSkills: review.jobComparison.missingSkills,
                    availableSkills: review.jobComparison.availableSkills,
                    skillGap: review.jobComparison.skillGap.map((skill) => skill.name),
                    skillsValidated: review.jobComparison.skillsValidated.map((skill) => skill.name),
                  }
                : current?.comparison,
              validity: typeof review.validity === "number" ? review.validity : pair.validity || current?.validity || 0,
              evidence: typeof review.evidence === "number" ? review.evidence : pair.evidence || current?.evidence || 0,
              hierarchy: review.hierarchy ?? current?.hierarchy,
              dimensions: review.hierarchy ? dimensionsFromHierarchy(review.hierarchy) : current?.dimensions,
              telemetry: review.telemetry ?? current?.telemetry,
              suggestions: (review.suggestions ?? []).map((item) => ({
                id: item.id ?? crypto.randomUUID(),
                kind: "add-metric" as const,
                title: item.text ?? "Suggestion",
                detail: item.recoverPoints ? `Recover ${item.recoverPoints} by applying this.` : item.text ?? "",
                recoverPoints: item.recoverPoints,
                box: item.span ? boxForSpan(runs, item.span.start, item.span.end) : null,
              })),
            }),
          );
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed");
      attachFromPage(glyphsRef.current);
    }
    setReading(false);
  }

  function onDraw(box: PageBox) {
    const id = `mark-${markRef.current}`;
    markRef.current += 1;
    const finding: OverlayFinding = {
      id,
      severity: "partial",
      title: "Your mark",
      detail: "You drew this. It is not a Jev judgment until you review — leave a note, or wait for the next pass.",
      needle: "",
      box,
      origin: "you",
      index: findings.length + 1,
      quote: "Your mark on the page.",
    };
    setFindings((current) => [...current, finding]);
    setThreads((current) => ({
      ...current,
      [id]: [{ id: `${id}-seed`, from: "you", text: "Marked this passage." }],
    }));
    setActiveId(id);
    setDrawMode(false);
  }

  function onSend() {
    if (!active || !draft.trim()) {
      return;
    }
    const message: ChatMessage = { id: `${active.id}-${Date.now()}`, from: "you", text: draft.trim() };
    setThreads((current) => ({
      ...current,
      [active.id]: [...(current[active.id] ?? []), message],
    }));
    setDraft("");
  }

  function onIgnore() {
    if (!active) {
      return;
    }
    setFindings((current) => current.filter((item) => item.id !== active.id));
    setActiveId(null);
  }

  useEffect(() => {
    if (!activeId) {
      return;
    }
    const mark = document.querySelector<HTMLElement>(`[data-mark="${activeId}"]`);
    mark?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeId]);

  useEffect(() => {
    if (!active?.box || isNarrow) {
      setFromRect(null);
      return;
    }
    const paper = document.querySelector<HTMLElement>(`.paper[data-page="${active.box.page}"]`);
    const mark = document.querySelector<HTMLElement>(`[data-mark="${active.id}"]`);
    const origin = mark ?? paper;
    if (!origin) {
      setFromRect(null);
      return;
    }
    setFromRect(origin.getBoundingClientRect());
  }, [active, isNarrow, findings, zoom]);

  useLayoutEffect(() => {
    setToRect(noteRef.current?.getBoundingClientRect() ?? null);
  }, [active, isNarrow, fromRect]);

  const messages = active ? (threads[active.id] ?? []) : [];
  const targeted = hasJobTarget(jobTarget);
  const jobLabel = targeted ? jobTargetLabel(jobTarget) : "Target a job";

  return (
    <ReviewStudio
      scene={scene}
      reading={reading}
      targeted={targeted}
      jobOpen={jobOpen}
      jobLabel={jobLabel}
      jobTarget={jobTarget}
      resumeText={resumeText}
      filename={filename}
      data={data}
      zoom={zoom}
      score={score}
      selected={selected}
      findings={findings}
      sectionBands={sectionBands}
      activeId={activeId}
      hoveredId={hoveredId}
      drawMode={drawMode}
      hot={hot}
      error={error}
      demoPresetId={demoPresetId}
      isNarrow={isNarrow}
      diagnosticsOpen={diagnosticsOpen}
      active={active}
      messages={messages}
      draft={draft}
      fromRect={fromRect}
      toRect={toRect}
      noteRef={noteRef}
      onJobOpenToggle={() => setJobOpen((open) => !open)}
      onJobClose={() => setJobOpen(false)}
      onJobTargetChange={setJobTarget}
      onDiagnosticsOpenChange={setDiagnosticsOpen}
      onHot={setHot}
      onFiles={(files) => void onFiles(files)}
      onDemoPresetId={(id) => {
        setDemoPresetId(id);
        const preset = presetById(id);
        if (preset) {
          setJobTarget(jobFieldsFromPreset(preset));
        }
      }}
      onDemo={(id) => void loadDemo("loaded", id)}
      onGlyphs={onGlyphs}
      onSelect={setActiveId}
      onHover={setHoveredId}
      onDraw={onDraw}
      onToggleSelected={(id) => {
        setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
      }}
      onZoomDelta={(delta) => setZoom((value) => Math.min(1.45, Math.max(0.75, value + delta)))}
      onReview={() => void onReview()}
      onDrawModeToggle={() => setDrawMode((value) => !value)}
      onDraft={setDraft}
      onSend={onSend}
      onIgnore={onIgnore}
      onStepFinding={stepFinding}
    />
  );
}

function bandsFromRoots(roots: unknown, ledger: LedgerRun[], includeChildren: boolean): SectionBand[] {
  if (!Array.isArray(roots)) {
    return [];
  }
  const out: SectionBand[] = [];
  for (const item of roots) {
    const node = item as {
      id?: string;
      title?: string;
      start?: number;
      end?: number;
      status?: "pending" | "scored";
      children?: unknown[];
    };
    if (!node.id || typeof node.start !== "number" || typeof node.end !== "number") {
      continue;
    }
    const box = boxForSpan(ledger, node.start, node.end);
    if (box) {
      out.push({
        id: node.id,
        title: node.title ?? node.id,
        status: node.status ?? "pending",
        box,
      });
    }
    if (includeChildren && Array.isArray(node.children)) {
      out.push(...bandsFromRoots(node.children, ledger, true));
    }
  }
  return out;
}

function upsertBand(current: SectionBand[], next: SectionBand): SectionBand[] {
  const index = current.findIndex((item) => item.id === next.id);
  if (index < 0) {
    return [...current, next];
  }
  const copy = [...current];
  copy[index] = next;
  return copy;
}

function mergeBands(current: SectionBand[], incoming: SectionBand[]): SectionBand[] {
  let next = current;
  for (const band of incoming) {
    next = upsertBand(next, band);
  }
  return next;
}

function pairPatch(roots: unknown): Pick<StudioScore, "hierarchy" | "dimensions" | "validity" | "evidence"> {
  const pair = Array.isArray(roots) ? validityEvidenceFromTree(roots) : { validity: 0, evidence: 0 };
  return {
    hierarchy: (Array.isArray(roots) ? roots : []) as StudioScore["hierarchy"],
    dimensions: Array.isArray(roots) ? dimensionsFromHierarchy(roots) : [],
    validity: pair.validity,
    evidence: pair.evidence,
  };
}

function dimensionsFromHierarchy(roots: unknown): StudioScore["dimensions"] {
  if (!Array.isArray(roots)) {
    return [];
  }
  return roots.flatMap((item) => {
    const node = item as { id?: string; title?: string; contribution?: number | null; weight?: number | null };
    if (!node.id) {
      return [];
    }
    return [
      {
        id: node.id,
        label: node.title ?? node.id,
        score: node.contribution ?? 0,
        max: node.weight ?? 0,
      },
    ];
  });
}

function mergeLiveScore(current: StudioScore | null, patch: Partial<StudioScore>): StudioScore {
  const base: StudioScore = current ?? {
    value: 0,
    verdict: "Jev is scoring each section.",
    noteCount: 0,
    validity: 0,
    evidence: 0,
    leadershipLine: "Waiting on section scores.",
    jobsLine: "Roles appear as they score.",
    skillsLine: "Skills score after the dump is judged.",
    rewriteLine: "Suggestions arrive with recover points.",
    rewrite: "none",
    strong: "—",
    weak: "—",
    dimensions: [],
    suggestions: [],
  };
  return fillWaitingJudgeLines({
    ...base,
    ...patch,
    suggestions: patch.suggestions
      ? uniqueSuggestions([...(base.suggestions ?? []), ...patch.suggestions])
      : base.suggestions,
    hierarchy: patch.hierarchy ?? base.hierarchy,
    telemetry: patch.telemetry ?? base.telemetry,
    value: patch.value ?? base.value,
  });
}

function uniqueSuggestions(cards: StudioScore["suggestions"]): StudioScore["suggestions"] {
  const seen = new Set<string>();
  const out: StudioScore["suggestions"] = [];
  for (const card of cards) {
    if (seen.has(card.id)) {
      continue;
    }
    seen.add(card.id);
    out.push(card);
  }
  return out;
}
