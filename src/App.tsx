import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { formatJevScore, scoreTone } from "../shared/format.ts";
import {
  formatRateLimitCopy,
  rateLimitTitle,
  secondsUntil,
  type RateLimitCheckpoint,
} from "../shared/rate-limit.ts";
import {
  RateLimitError,
  createPersona,
  fetchHealth,
  generalReview,
  jobReview,
  listPersonas,
  storeResume,
  type PersonaListItem,
  type ReviewResponse,
} from "./lib/api.ts";
import { extractFromFile } from "./lib/extract.ts";

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

type Mode = "general" | "job";

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
  const [mode, setMode] = useState<Mode>("general");
  const [resumeText, setResumeText] = useState(DEMO_RESUME);
  const [source, setSource] = useState("paste");
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitNotices>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [provider, setProvider] = useState("…");
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [personaId, setPersonaId] = useState("");
  const [title, setTitle] = useState("Staff Backend Engineer");
  const [tags, setTags] = useState("golang, kafka, staff");
  const [jobDescription, setJobDescription] = useState(DEMO_JD);

  useEffect(() => {
    void fetchHealth()
      .then((health) => setProvider(health.provider))
      .catch(() => setProvider("offline"));
    void listPersonas()
      .then((items) => {
        setPersonas(items);
        if (items[0]) {
          setPersonaId(items[0].id);
        }
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
      setError(caught instanceof Error ? caught.message : "Could not extract text");
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
      setPersonaId(persona.id);
      const items = await listPersonas();
      setPersonas(items);
    } catch (caught) {
      if (caught instanceof RateLimitError) {
        rememberRateLimit(caught);
      } else {
        setError(caught instanceof Error ? caught.message : "Persona create failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReview() {
    setBusy(true);
    setError(null);
    try {
      await storeResume(resumeText, source).catch(() => undefined);
      const result =
        mode === "general"
          ? await generalReview(resumeText)
          : await jobReview(resumeText, personaId);
      setReview(result);
      setProvider(result.provider);
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
          jev<span>sume</span>
        </div>
        <div className="badge">provider · {provider}</div>
      </header>

      <section className="hero">
        <h1>ATS-native resume review, scored by Jev.</h1>
        <p>
          Extract text the way a parser would, then run TypeSafe System One judgments —
          wording, structure, metrics, and a JevScore against a job persona.
        </p>
      </section>

      <div className="modes">
        <button
          className={mode === "general" ? "mode active" : "mode"}
          onClick={() => setMode("general")}
          type="button"
        >
          <h2>General review</h2>
          <p>Calibrate wording, conciseness, structure, and ATS parseability.</p>
        </button>
        <button
          className={mode === "job" ? "mode active" : "mode"}
          onClick={() => setMode("job")}
          type="button"
        >
          <h2>Per-job review</h2>
          <p>Drop a resume into a job persona. See what works, what doesn’t, JevScore.</p>
        </button>
      </div>

      <div className="grid">
        <section className="panel">
          <div
            className={hot ? "drop hot" : "drop"}
            onDragOver={(event) => {
              event.preventDefault();
              setHot(true);
            }}
            onDragLeave={() => setHot(false)}
            onDrop={onDrop}
          >
            <strong>Drop PDF or DOCX</strong>
            <p>Client-side ATS extract. Nothing is parsed in the Worker.</p>
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
            style={{ marginTop: 14 }}
            aria-label="Resume text"
          />

          {mode === "job" ? (
            <form onSubmit={(event) => void onCreatePersona(event)} style={{ marginTop: 16 }}>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Job title"
                aria-label="Job title"
              />
              <input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Tags, comma separated"
                aria-label="Job tags"
                style={{ marginTop: 8 }}
              />
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                aria-label="Job description"
                style={{ marginTop: 8, minHeight: 120 }}
              />
              <div className="row">
                <button className="ghost" type="submit" disabled={busy || personaBlocked}>
                  {personaBlocked ? `Persona limit · ${personaWait}s` : "Save persona"}
                </button>
                <select
                  value={personaId}
                  onChange={(event) => setPersonaId(event.target.value)}
                  aria-label="Saved personas"
                >
                  <option value="">Select persona</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.title}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          ) : null}

          <div className="row">
            <button
              className="primary"
              type="button"
              disabled={busy || reviewBlocked}
              onClick={() => void onReview()}
            >
              {busy
                ? "Scoring…"
                : reviewBlocked
                  ? `Review locked · ${reviewWait}s`
                  : mode === "job"
                    ? "Run JevScore"
                    : "Review resume"}
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

        <section className="panel">
          {review ? (
            <>
              <div className="orb-wrap">
                <div className={`orb ${tone}`}>
                  <strong>{formatJevScore(review.jevScore.value)}</strong>
                </div>
              </div>
              <p style={{ textAlign: "center", color: "var(--muted)", marginTop: 0 }}>
                JevScore · {review.mode} · {review.model ?? review.provider}
              </p>
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
                        style={{ width: `${(dimension.score / dimension.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <h3>Findings</h3>
              <div className="chips">
                {review.findings.map((item) => (
                  <span className={`chip ${item.severity}`} key={item.id} title={item.detail}>
                    {item.title}
                  </span>
                ))}
              </div>
              {review.requirements?.length ? (
                <>
                  <h3>Persona mapping</h3>
                  <div className="chips">
                    {review.requirements.map((req) => (
                      <span className={`chip ${req.verdict}`} key={req.id}>
                        {req.verdict}: {req.text.slice(0, 48)}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              <h3>Suggestions</h3>
              <ul className="suggestions">
                {review.suggestions.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
              <div className="sections">
                {review.sections.map((section) => (
                  <article className="section" key={section.id}>
                    <h3>
                      {section.heading} · {section.kind}
                    </h3>
                    <p>{section.text || "—"}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>
              Run a review to see grouped sections, dimension scores, and JevScore.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
