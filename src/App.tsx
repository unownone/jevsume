import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { formatJevScore, scoreTone } from "../shared/format.ts";
import {
  formatRateLimitCopy,
  rateLimitTitle,
  secondsUntil,
  type RateLimitCheckpoint,
} from "../shared/rate-limit.ts";
import { FindingsPanel } from "./components/FindingsPanel.tsx";
import { PersonaControls } from "./components/PersonaControls.tsx";
import { ResumeCanvas } from "./components/ResumeCanvas.tsx";
import { ReviewMeta } from "./components/ReviewMeta.tsx";
import {
  RateLimitError,
  createPersona,
  fetchVisitorCount,
  listJobPersonas,
  recordVisitor,
  runReview,
  storeResume,
  type JobPersonaItem,
  type ReviewResponse,
} from "./lib/api.ts";
import { trackClick } from "./lib/events.ts";
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

type RateLimitNotice = {
  checkpoint: RateLimitCheckpoint;
  resetAt: string;
  limit: number;
};

type RateLimitNotices = Partial<Record<RateLimitCheckpoint, RateLimitNotice>>;

function noticeWait(notice: RateLimitNotice | undefined, nowMs: number): number {
  return notice ? secondsUntil(notice.resetAt, nowMs) : 0;
}

function pruneExpired(notices: RateLimitNotices, nowMs: number): RateLimitNotices {
  const next: RateLimitNotices = {};
  const resume = notices.resumeReview;
  if (resume && secondsUntil(resume.resetAt, nowMs) > 0) {
    next.resumeReview = resume;
  }
  const persona = notices.personaCreation;
  if (persona && secondsUntil(persona.resetAt, nowMs) > 0) {
    next.personaCreation = persona;
  }
  return next;
}

function activeNotices(notices: RateLimitNotices, nowMs: number): RateLimitNotice[] {
  const pruned = pruneExpired(notices, nowMs);
  const items: RateLimitNotice[] = [];
  if (pruned.resumeReview) {
    items.push(pruned.resumeReview);
  }
  if (pruned.personaCreation) {
    items.push(pruned.personaCreation);
  }
  return items;
}

export default function App() {
  const [resumeText, setResumeText] = useState(DEMO_RESUME);
  const [source, setSource] = useState("paste");
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitNotices>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
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
    void fetchVisitorCount()
      .then(setVisitors)
      .catch(() => undefined);
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

  useEffect(() => {
    if (!rateLimits.resumeReview && !rateLimits.personaCreation) {
      return;
    }
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [rateLimits]);

  useEffect(() => {
    setRateLimits((current) => {
      const pruned = pruneExpired(current, nowMs);
      if (pruned.resumeReview === current.resumeReview && pruned.personaCreation === current.personaCreation) {
        return current;
      }
      return pruned;
    });
  }, [nowMs]);

  const reviewWait = noticeWait(rateLimits.resumeReview, nowMs);
  const personaWait = noticeWait(rateLimits.personaCreation, nowMs);
  const reviewBlocked = reviewWait > 0;
  const personaBlocked = personaWait > 0;
  const notices = activeNotices(rateLimits, nowMs);

  function rememberRateLimit(caught: RateLimitError): void {
    setRateLimits((current) => ({
      ...current,
      [caught.checkpoint]: {
        checkpoint: caught.checkpoint,
        resetAt: caught.resetAt,
        limit: caught.limit,
      },
    }));
  }

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
    trackClick("/upload");
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
    trackClick("/persona");
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
      if (caught instanceof RateLimitError) {
        rememberRateLimit(caught);
      } else {
        setError(caught instanceof Error ? caught.message : "Could not save that job");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReview() {
    trackClick("/review");
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
      if (caught instanceof RateLimitError) {
        rememberRateLimit(caught);
      } else {
        setError(caught instanceof Error ? caught.message : "Review failed");
      }
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
        <h1>
          <img
            className="hero-mark"
            src="/jev-mark.svg"
            width={40}
            height={40}
            alt=""
            decoding="async"
          />
          <span>Review resume using Jev</span>
        </h1>
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
              <button className="ghost" type="button" onClick={() => {
                trackClick("/demo");
                setResumeText(DEMO_RESUME);
              }}>
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
            personaBlocked={personaBlocked}
            personaWait={personaWait}
          />
          <div className="row">
            <button
              className="primary"
              type="button"
              disabled={busy || reviewBlocked}
              onClick={() => void onReview()}
            >
              {busy ? "Reading…" : reviewBlocked ? `Review locked · ${reviewWait}s` : "Review with Jev"}
            </button>
          </div>
          {notices.map((notice) => (
            <div className="rate-limit" role="status" aria-live="polite" key={notice.checkpoint}>
              <strong>{rateLimitTitle(notice.checkpoint)}</strong>
              {formatRateLimitCopy({
                checkpoint: notice.checkpoint,
                limit: notice.limit,
                resetAt: notice.resetAt,
                nowMs,
              })}
            </div>
          ))}
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
