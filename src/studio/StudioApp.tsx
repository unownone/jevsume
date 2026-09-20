import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { boxForNeedle, padBox } from "./boxes.ts";
import { DEMO_FINDINGS, DEMO_PERSONA } from "./demo.ts";
import { DropGate } from "./DropGate.tsx";
import { Leader } from "./Leader.tsx";
import { OverlayNote } from "./OverlayNote.tsx";
import { PdfStage } from "./PdfStage.tsx";
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

  const active = findings.find((finding) => finding.id === activeId) ?? null;
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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadBuffer = useCallback(async (buffer: ArrayBuffer, name: string, next: Scene = "loaded") => {
    setError(null);
    setData(buffer);
    setFilename(name);
    setScene(next);
    setFindings([]);
    setActiveId(null);
    setDrawMode(false);
    setThreads({});
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

  const attachBoxes = useCallback(
    (source: OverlayFinding[], nextGlyphs: GlyphBox[]) =>
      source.map((finding) => {
        const box = finding.needle ? boxForNeedle(nextGlyphs, finding.needle) : finding.box;
        return { ...finding, box: box ? padBox(box) : finding.box };
      }),
    [],
  );

  useEffect(() => {
    if (scene !== "reviewed" || glyphs.length === 0) {
      return;
    }
    if (findings.some((item) => item.origin === "jev")) {
      return;
    }
    const next = attachBoxes(DEMO_FINDINGS, glyphs);
    setFindings(next);
    setThreads(
      Object.fromEntries(
        next.map((finding) => [
          finding.id,
          [{ id: `${finding.id}-jev`, from: "jev" as const, text: finding.detail }],
        ]),
      ),
    );
    setActiveId(next[0]?.id ?? null);
  }, [attachBoxes, findings, glyphs, scene]);

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
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    const next = attachBoxes(DEMO_FINDINGS, glyphs);
    setFindings(next);
    setThreads(
      Object.fromEntries(
        next.map((finding) => [
          finding.id,
          [{ id: `${finding.id}-jev`, from: "jev" as const, text: finding.detail }],
        ]),
      ),
    );
    setActiveId(next[0]?.id ?? null);
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
    if (!active?.box || compact) {
      setFromRect(null);
      return;
    }
    const paper = document.querySelector<HTMLElement>(`.paper[data-page="${active.box.page}"]`);
    if (!paper) {
      setFromRect(null);
      return;
    }
    const bounds = paper.getBoundingClientRect();
    setFromRect(
      new DOMRect(
        bounds.left + (active.box.x / 100) * bounds.width,
        bounds.top + (active.box.y / 100) * bounds.height,
        (active.box.w / 100) * bounds.width,
        (active.box.h / 100) * bounds.height,
      ),
    );
  }, [active, compact, findings, zoom]);

  useLayoutEffect(() => {
    setToRect(noteRef.current?.getBoundingClientRect() ?? null);
  }, [active, compact, fromRect]);

  const messages = active ? (threads[active.id] ?? []) : [];
  const score = useMemo(() => (scene === "reviewed" ? "6.4" : null), [scene]);

  return (
    <div className="studio" style={{ "--zoom": String(zoom) } as CSSProperties}>
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
          {score ? (
            <div className="score-orb" aria-label={`JevScore ${score}`}>
              {score}
            </div>
          ) : null}
          <a className="ghost tight" href="/?view=classic">
            Text review
          </a>
        </div>
      </header>

      {personaOpen ? (
        <div className="persona-pop">
          <strong>{DEMO_PERSONA.title}</strong>
          <p>{DEMO_PERSONA.summary}</p>
        </div>
      ) : null}

      <main className="stage">
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
              finding={active}
              messages={messages}
              draft={draft}
              compact={false}
              onDraft={setDraft}
              onSend={onSend}
              onClose={() => setActiveId(null)}
              onIgnore={onIgnore}
            />
          </div>
        ) : null}
        {!compact ? <Leader from={fromRect} to={toRect} /> : null}
      </main>

      {active && compact ? (
        <OverlayNote
          finding={active}
          messages={messages}
          draft={draft}
          compact
          onDraft={setDraft}
          onSend={onSend}
          onClose={() => setActiveId(null)}
          onIgnore={onIgnore}
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
          <button className="primary tight" type="button" disabled={reading} onClick={() => void onReview()}>
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
