import { useEffect, useState, type CSSProperties } from "react";
import { formatJevScore, formatReviewCost, formatTokenCount, scoreTone } from "../../shared/format.ts";
import { SuggestionList } from "./SuggestionList.tsx";
import type { StudioScore } from "./types.ts";

type ScorePanelProps = {
  score: StudioScore;
  selected: string[];
  onToggle: (id: string) => void;
  onOpen?: (findingId: string) => void;
};

export function ScorePanel({ score, selected, onToggle, onOpen }: ScorePanelProps) {
  const tone = scoreTone(score.value);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(score.value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 720);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(score.value * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score.value]);

  return (
    <aside className={`score-panel ${tone}`} aria-label="JevScore">
      <div className="score-panel-head">
        <div className={`score-orb is-lg ${tone}`}>
          <strong>{formatJevScore(shown)}</strong>
        </div>
        <div>
          <h2>JevScore</h2>
          <p>{score.verdict}</p>
          {score.targetLabel ? (
            <p className="score-target">
              Rated against {score.targetLabel}
              {score.targetFit ? ` · ${score.targetFit}` : ""}
            </p>
          ) : (
            <p className="score-target is-general">General review — no listing attached</p>
          )}
        </div>
      </div>
      <div className="score-pair">
        <div>
          <strong>{score.validity}</strong>
          <span>Validity</span>
        </div>
        <div>
          <strong>{score.evidence}</strong>
          <span>Evidence</span>
        </div>
      </div>
      {score.telemetry ? (
        <p className="score-cost" aria-label="Jev token cost">
          This review burned {formatTokenCount(score.telemetry.totalTokens)} tokens (
          {formatTokenCount(score.telemetry.inputTokens)} in / {formatTokenCount(score.telemetry.outputTokens)} out) ·{" "}
          {formatReviewCost(score.telemetry.costUsd)}
          {score.telemetry.requestCount > 1
            ? ` · ${score.telemetry.requestCount} Jev requests`
            : " · 1 Jev request"}
        </p>
      ) : null}
      {score.hierarchy && score.hierarchy.length > 0 ? (
        <ul className="score-tree">
          {score.hierarchy.map((node) => (
            <li key={node.id} className={node.status}>
              <span>
                {node.title}
                {node.weight !== null ? ` · ${node.weight}` : ""}
              </span>
              <strong>{node.status === "scored" ? Math.round(node.contribution ?? 0) : "…"}</strong>
              {node.children.length > 0 ? (
                <ul>
                  {node.children.map((child) => (
                    <li key={child.id} className={child.status}>
                      <span>{child.title}</span>
                      <strong>
                        {child.status === "scored" ? Math.round(child.contribution ?? 0) : "…"}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="judge-lines">
        <div>
          <dt>Leadership</dt>
          <dd>{score.leadershipLine}</dd>
        </div>
        <div>
          <dt>Roles</dt>
          <dd>{score.jobsLine}</dd>
        </div>
        <div>
          <dt>Skills</dt>
          <dd>{score.skillsLine}</dd>
        </div>
        <div>
          <dt>Rewrite</dt>
          <dd>{score.rewriteLine}</dd>
        </div>
      </dl>
      <div className="score-bars">
        {score.dimensions.map((dimension, index) => (
          <div className="score-bar" key={dimension.id} style={{ "--i": index + 1 } as CSSProperties}>
            <label>
              <span>{dimension.label}</span>
              <span>
                {dimension.max > 4 ? Math.round(dimension.score) : dimension.score.toFixed(1)} / {dimension.max}
              </span>
            </label>
            <div className="track">
              <div
                className="fill"
                style={{ "--p": dimension.max > 0 ? dimension.score / dimension.max : 0 } as CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="score-strong">
        Strong: {score.strong}
      </p>
      <p className="score-weak">
        Weak: {score.weak}
      </p>
      <p className="score-count">
        {score.noteCount} {score.noteCount === 1 ? "note" : "notes"} on the page
      </p>
      <SuggestionList cards={score.suggestions} selected={selected} onToggle={onToggle} onOpen={onOpen} />
    </aside>
  );
}
