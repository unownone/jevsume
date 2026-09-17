import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { formatJevScore, scoreTone } from "../shared/format.ts";
import { FindingsPanel } from "./components/FindingsPanel.tsx";
import { PersonaControls } from "./components/PersonaControls.tsx";
import { ResumeCanvas } from "./components/ResumeCanvas.tsx";
import { ReviewMeta } from "./components/ReviewMeta.tsx";
import {
  createPersona,
  listJobPersonas,
  recordVisitor,
  runReview,
  storeResume,
  type JobPersonaItem,
  type ReviewResponse,
} from "./lib/api.ts";
import { extractFromFile } from "./lib/extract.ts";
import { loadVisitorId, persistVisitorId } from "./lib/visitor.ts";

const DEMO_RESUME = `Jane Doe
Staff Software Engineer

Summary
Distributed systems engineer who ships event-driven platforms.

Experience
- Built a Go + Kafka pipeline handling 2M events/day and cut p99 latency 40%
- Led 6 engineers on a TypeScript control plane used by 30 product teams
- Reduced AWS spend 18% by rewriting a hot path in Rust

Skills
Go, Kafka, TypeScript, PostgreSQL, Terraform

Education
B.S. Computer Science, State University
`;

const DEMO_JD = `Staff Backend Engineer
- 5+ years building event-driven services in Go
- Production Kafka or equivalent streaming experience
- Mentors senior engineers and sets technical direction
- Comfortable with Terraform and AWS
Unlimited PTO and a culture of snacks
`;

export default function App() {
  const [resumeText, setResumeText] = useState(DEMO_RESUME);
  const [source, setSource] = useState("paste");
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [clientMs, setClientMs] = useState(0);
  const [personas, setPersonas] = useState<JobPersonaItem[]>([]);
  const [personaId, setPersonaId] = useState("default");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("Staff Backend Engineer");
  const [tags, setTags] = useState("golang, kafka, staff");
  const [jobDescription, setJobDescription] = useState(DEMO_JD);
  const [visitors, setVisitors] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const visitorId = loadVisitorId();
    void recordVisitor(visitorId)
      .then((result) => {
        persistVisitorId(result.visitorId);
        setVisitors(result.uniqueVisitors);
      })
      .catch(() => undefined);
    void listJobPersonas()
      .then((catalog) => {
        setPersonas(catalog.items);
        setPersonaId(catalog.defaultId);
      })
      .catch(() => undefined);
  }, []);

  const tone = useMemo(
    () => (review ? scoreTone(review.jevScore.value) : "mid"),
    [review],
  );

  async function refreshPersonas(selectId?: string) {
    const catalog = await listJobPersonas();
    setPersonas(catalog.items);
    setPersonaId(selectId ?? catalog.defaultId);
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    try {
      const extracted = await extractFromFile(file);
      setResumeText(extracted.text);
      setSource(extracted.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that file");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setHot(false);
    void onFiles(event.dataTransfer.files);
  }

  async function onCreatePersona(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const persona = await createPersona({
        title,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        jobDescription,
      });
      setAdding(false);
      await refreshPersonas(persona.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that job");
    } finally {
      setBusy(false);
    }
  }

  async function onReview() {
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      await storeResume(resumeText, source).catch(() => undefined);
      const result = await runReview(resumeText, personaId);
      setReview(result);
      setClientMs(performance.now() - started);
      setActiveId(result.findings[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-mark"
            src="/jev-mark.svg"
            width={36}
            height={36}
            alt=""
            decoding="async"
          />
          jev<span>sume</span>
        </div>
        {visitors !== null ? (
          <div className="badge" title="Unique people who have opened this app">
            {visitors.toLocaleString("en-US")} {visitors === 1 ? "visitor" : "visitors"}
          </div>
        ) : (
          <div className="badge muted">counting visitors…</div>
        )}
      </header>

      <section className="hero">
        <h1>Review resume using Jev</h1>
        <p>
          Drop in a resume, choose who it’s for, and read it with Jev. Notes sit on the lines they
          belong to.
        </p>
      </section>

      <div className="workspace">
        <section className="panel composer">
          <div
            className={hot ? "drop hot" : "drop"}
            onDragOver={(event) => {
              event.preventDefault();
              setHot(true);
            }}
            onDragLeave={() => setHot(false)}
            onDrop={onDrop}
          >
            <strong>Drop a PDF or DOCX</strong>
            <p>Or paste the text. Jev reads the words on the page — nothing flashy, just the resume.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <label className="ghost">
                Choose file
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  hidden
                  onChange={(event) => void onFiles(event.target.files)}
                />
              </label>
              <button className="ghost" type="button" onClick={() => setResumeText(DEMO_RESUME)}>
                Load demo
              </button>
            </div>
          </div>
          <textarea
            value={resumeText}
            onChange={(event) => {
              setResumeText(event.target.value);
              setSource("paste");
            }}
            aria-label="Resume text"
          />
          <PersonaControls
            personas={personas}
            personaId={personaId}
            onPersonaId={setPersonaId}
            adding={adding}
            onToggleAdd={() => setAdding((value) => !value)}
            title={title}
            tags={tags}
            jobDescription={jobDescription}
            onTitle={setTitle}
            onTags={setTags}
            onJobDescription={setJobDescription}
            onCreate={(event) => void onCreatePersona(event)}
            busy={busy}
          />
          <div className="row">
            <button className="primary" type="button" disabled={busy} onClick={() => void onReview()}>
              {busy ? "Reading…" : "Review with Jev"}
            </button>
          </div>
          {error ? <div className="error">{error}</div> : null}
        </section>

        <section className="panel review" aria-live="polite">
          {review ? (
            <>
              <div className="review-head">
                <div className="orb-wrap">
                  <div className={`orb ${tone}`}>
                    <strong>{formatJevScore(review.jevScore.value)}</strong>
                  </div>
                </div>
                <div>
                  <h2>{review.persona.title}</h2>
                  <p className="muted">
                    Click a note, or a marked line. Each one points at the other.
                  </p>
                </div>
              </div>
              <div className="bars">
                {review.dimensions.map((dimension) => (
                  <div className="bar" key={dimension.id}>
                    <label>
                      <span>{dimension.label}</span>
                      <span>
                        {dimension.score.toFixed(1)} / {dimension.max}
                      </span>
                    </label>
                    <div className="track">
                      <div
                        className="fill"
                        style={{ transform: `scaleX(${dimension.score / dimension.max})` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="annotation">
                <ResumeCanvas
                  text={review.resumeText}
                  findings={review.findings}
                  activeId={activeId}
                  hoveredId={hoveredId}
                  onSelect={setActiveId}
                  onHover={setHoveredId}
                />
                <FindingsPanel
                  findings={review.findings}
                  suggestions={review.suggestions}
                  activeId={activeId}
                  hoveredId={hoveredId}
                  onSelect={setActiveId}
                  onHover={setHoveredId}
                />
              </div>
              <ReviewMeta
                clientMs={clientMs}
                serverMs={review.telemetry.serverMs}
                inputTokens={review.telemetry.inputTokens}
                costUsd={review.telemetry.costUsd}
              />
            </>
          ) : (
            <div className="empty">
              <h2>Notes live on the resume</h2>
              <p>
                After a review, marked lines and Jev’s notes stay linked. Click a passage to read
                why; open a note to jump back to the line.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
