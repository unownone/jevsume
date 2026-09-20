import { useEffect, useState, type CSSProperties } from "react";
import { formatJevScore, scoreTone } from "../../shared/format.ts";
import type { StudioScore } from "./types.ts";

type ScorePanelProps = {
  score: StudioScore;
};

export function ScorePanel({ score }: ScorePanelProps) {
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
        </div>
      </div>
      <div className="score-bars">
        {score.dimensions.map((dimension, index) => (
          <div className="score-bar" key={dimension.id} style={{ "--i": index + 1 } as CSSProperties}>
            <label>
              <span>{dimension.label}</span>
              <span>
                {dimension.score.toFixed(1)} / {dimension.max}
              </span>
            </label>
            <div className="track">
              <div className="fill" style={{ "--p": dimension.score / dimension.max } as CSSProperties} />
            </div>
          </div>
        ))}
      </div>
      <p className="score-count">
        {score.noteCount} {score.noteCount === 1 ? "note" : "notes"} on the page
      </p>
    </aside>
  );
}
