import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { formatJevScore, scoreTone } from "../../shared/format.ts";
import { DEMO_PERSONA } from "./demo.ts";
import { linesFromGlyphs, reviewFromGlyphs, scoreFromDocument } from "./findings.ts";
import { DropGate } from "./DropGate.tsx";
import { Leader } from "./Leader.tsx";
import { OverlayNote } from "./OverlayNote.tsx";
import { PdfStage } from "./PdfStage.tsx";
import { ScorePanel } from "./ScorePanel.tsx";
import "./studio.css";
import type { ChatMessage, GlyphBox, OverlayFinding, PageBox, Scene } from "./types.ts";

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
  const [personaOpen, setPersonaOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [fromRect, setFromRect] = useState<DOMRect | null>(null);
  const [toRect, setToRect] = useState<DOMRect | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const markRef = useRef(1);
  const glyphsRef = useRef<GlyphBox[]>([]);
  const compactRef = useRef(false);

  glyphsRef.current = glyphs;
  compactRef.current = compact;

  const active = findings.find((finding) => finding.id === activeId) ?? null;
  const score = useMemo(() => {
    if (scene !== "reviewed") {
      return null;
    }
    const judged = findings.filter((item) => item.origin === "jev");
    if (judged.length === 0) {
      return null;
    }
    return scoreFromDocument(linesFromGlyphs(glyphs), judged);
  }, [findings, glyphs, scene]);

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
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveId(null);
        setDrawMode(false);
        setPersonaOpen(false);
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
  }, []);

  const loadDemo = useCallback(
    async (next: Scene = "loaded") => {
      const response = await fetch("/demo-resume.pdf");
      if (!response.ok) {
        setError("Demo PDF is missing");
        return;
      }
      await loadBuffer(await response.arrayBuffer(), "demo-resume.pdf", next);
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
    const reviewed = reviewFromGlyphs(nextGlyphs);
    setFindings(reviewed.findings);
    setThreads(
      Object.fromEntries(
        reviewed.findings.map((finding) => [
          finding.id,
          [{ id: `${finding.id}-jev`, from: "jev" as const, text: finding.detail }],
        ]),
      ),
    );
    setActiveId(compactRef.current ? null : (reviewed.findings[0]?.id ?? null));
  }, []);

  useEffect(() => {
    if (scene !== "reviewed" || glyphs.length === 0) {
      return;
    }
    if (findings.some((item) => item.origin === "jev")) {
      return;
    }
    attachFromPage(glyphs);
  }, [attachFromPage, findings, glyphs, scene]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Drop a PDF — the page is the canvas.");
      return;
    }
    await loadBuffer(await file.arrayBuffer(), file.name);
  }

  async function onReview() {
    if (!data) {
      return;
    }
    setReading(true);
    setDrawMode(false);
    setError(null);
    await new Promise((resolve) => window.setTimeout(resolve, 2100));
    const started = Date.now();
    while (glyphsRef.current.length === 0 && Date.now() - started < 2500) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    if (glyphsRef.current.length === 0) {
      setError("The page is still rendering. Try Review with Jev again.");
      setReading(false);
      return;
    }
    attachFromPage(glyphsRef.current);
    setScene("reviewed");
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

  async function goScene(next: Scene) {
    if (next === "empty") {
      setData(null);
      setFindings([]);
      setActiveId(null);
      setScene("empty");
      return;
    }
    if (!data) {
      await loadDemo(next);
      return;
    }
    if (next === "loaded") {
      setFindings([]);
      setActiveId(null);
      setThreads({});
    }
    setScene(next);
  }

  useEffect(() => {
    if (!activeId) {
      return;
    }
    const mark = document.querySelector<HTMLElement>(`[data-mark="${activeId}"]`);
    mark?.scrollIntoView({
      block: compact ? "center" : "center",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeId, compact]);

  useEffect(() => {
    if (!active?.box || compact) {
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
  }, [active, compact, findings, zoom]);

  useLayoutEffect(() => {
    setToRect(noteRef.current?.getBoundingClientRect() ?? null);
  }, [active, compact, fromRect]);

  const messages = active ? (threads[active.id] ?? []) : [];

  return (
    <div
      className={`studio${scene === "reviewed" ? " is-reviewed" : ""}${reading ? " is-loading" : ""}`}
      style={{ "--zoom": String(zoom) } as CSSProperties}
    >
      <header className="studio-chrome">
        <a className="brand" href="/">
          <img className="brand-mark" src="/jev-mark.svg" width={32} height={32} alt="" />
          jev<span>sume</span>
        </a>
        <div className="chrome-center">
          {data ? (
            <button type="button" className="persona-chip" onClick={() => setPersonaOpen((open) => !open)}>
              {DEMO_PERSONA.title}
            </button>
          ) : null}
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
                const panel = document.querySelector(".score-panel");
                panel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}
            >
              <div className={`score-orb ${scoreTone(score.value)}`}>{formatJevScore(score.value)}</div>
              <span>{score.noteCount} notes</span>
            </button>
          ) : null}
          <a className="ghost tight" href="/?view=classic">
            Text review
          </a>
        </div>
      </header>

      {personaOpen ? (
        <div className="persona-pop bounce-in">
          <strong>{DEMO_PERSONA.title}</strong>
          <p>{DEMO_PERSONA.summary}</p>
        </div>
      ) : null}

      <main className={`stage${active && !compact ? " has-note" : ""}${score ? " has-score" : ""}`}>
        {score ? <ScorePanel score={score} /> : null}
        {scene === "empty" || !data ? (
          <DropGate hot={hot} onHot={setHot} onFiles={(files) => void onFiles(files)} onDemo={() => void loadDemo()} />
        ) : (
          <PdfStage
            data={data}
            zoom={zoom}
            findings={findings}
            activeId={activeId}
            hoveredId={hoveredId}
            drawMode={drawMode}
            reading={reading}
            onGlyphs={onGlyphs}
            onSelect={setActiveId}
            onHover={setHoveredId}
            onDraw={onDraw}
          />
        )}
        {active && !compact ? (
          <div className="note-rail" ref={noteRef}>
            <OverlayNote
              key={active.id}
              finding={active}
              messages={messages}
              draft={draft}
              compact={false}
              total={findings.length}
              onDraft={setDraft}
              onSend={onSend}
              onClose={() => setActiveId(null)}
              onIgnore={onIgnore}
              onPrev={() => stepFinding(-1)}
              onNext={() => stepFinding(1)}
            />
          </div>
        ) : null}
        {!compact ? <Leader key={active?.id ?? "none"} from={fromRect} to={toRect} /> : null}
      </main>

      {active && compact ? (
        <OverlayNote
          key={active.id}
          finding={active}
          messages={messages}
          draft={draft}
          compact
          total={findings.length}
          onDraft={setDraft}
          onSend={onSend}
          onClose={() => setActiveId(null)}
          onIgnore={onIgnore}
          onPrev={() => stepFinding(-1)}
          onNext={() => stepFinding(1)}
        />
      ) : null}

      {data ? (
        <div className="trigger-dock" role="toolbar" aria-label="Page tools">
          <button
            type="button"
            className={`ghost tight${drawMode ? " is-on" : ""}`}
            aria-pressed={drawMode}
            onClick={() => setDrawMode((value) => !value)}
          >
            Draw mark
          </button>
          <button type="button" className="ghost tight" onClick={() => setZoom((value) => Math.max(0.75, value - 0.15))}>
            −
          </button>
          <span className="zoom-read">{Math.round(zoom * 100)}%</span>
          <button type="button" className="ghost tight" onClick={() => setZoom((value) => Math.min(1.45, value + 0.15))}>
            +
          </button>
          <button className={`primary tight${reading ? " is-busy" : ""}`} type="button" disabled={reading} onClick={() => void onReview()}>
            {reading ? "Reading…" : "Review with Jev"}
          </button>
        </div>
      ) : null}

      {error ? <p className="studio-error">{error}</p> : null}

      <nav className="mock-scenes" aria-label="Mock scenes">
        <span>Scenes</span>
        <button type="button" className={scene === "empty" ? "is-on" : ""} onClick={() => void goScene("empty")}>
          Drop
        </button>
        <button type="button" className={scene === "loaded" && findings.length === 0 ? "is-on" : ""} onClick={() => void goScene("loaded")}>
          Page
        </button>
        <button type="button" className={scene === "reviewed" ? "is-on" : ""} onClick={() => void goScene("reviewed")}>
          Notes
        </button>
      </nav>
    </div>
  );
}
