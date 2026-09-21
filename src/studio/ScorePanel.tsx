import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { formatJevScore, formatReviewCost, formatTokenCount, scoreTone } from "../../shared/format.ts";
import { AnimatedScoreBar } from "@/components/prosume-motion-ui.tsx";
import { resolvePanelTransition, useAnimatedScore, usePrefersReducedMotion } from "@/lib/prosume-motion.ts";
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
  const shown = useAnimatedScore(score.value);
  const validityShown = useAnimatedScore(score.validity);
  const evidenceShown = useAnimatedScore(score.evidence);

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
          <strong>{formatJevScore(validityShown)}</strong>
          <span>Validity</span>
        </div>
        <div>
          <strong>{formatJevScore(evidenceShown)}</strong>
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
        {score.dimensions.map((dimension, index) => {
          const ratio = dimension.max > 0 ? Math.min(1, Math.max(0, dimension.score / dimension.max)) : 0;
          return (
            <div className="score-bar" key={dimension.id} style={{ "--i": index + 1 } as CSSProperties}>
              <label>
                <span>{dimension.label}</span>
                <span>
                  {dimension.max > 4 ? Math.round(dimension.score) : dimension.score.toFixed(1)} / {dimension.max}
                </span>
              </label>
              <div className="track">
                <AnimatedScoreBar className="fill is-motion" ratio={ratio} delayIndex={index} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="score-strong">Strong: {score.strong}</p>
      <p className="score-weak">Weak: {score.weak}</p>
      <p className="score-count">
        {score.noteCount} {score.noteCount === 1 ? "note" : "notes"} on the page
      </p>
      <SuggestionList cards={score.suggestions} selected={selected} onToggle={onToggle} onOpen={onOpen} />
    </aside>
  );
}

export function AnimatedScoreChip({ value }: { value: number }) {
  return formatJevScore(useAnimatedScore(value));
}

export function StudioReadingOrb() {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      className="score-orb is-reading"
      aria-label="Reading"
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={resolvePanelTransition(reduced)}
    >
      <span />
      <span />
      <span />
    </motion.div>
  );
}
