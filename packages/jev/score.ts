import type { JevScore, ScoreAnswer, ScoreBreakdown } from "./types.ts";

export const GENERAL_WEIGHTS: Record<string, number> = {
  wording: 0.22,
  conciseness: 0.18,
  structure: 0.22,
  metrics: 0.2,
  ats_parse: 0.18,
};

export const JOB_SCORE_WEIGHTS: Record<string, number> = {
  fit_overall: 0.28,
  keyword_alignment: 0.18,
  evidence_strength: 0.18,
  wording: 0.1,
  conciseness: 0.08,
  structure: 0.08,
  metrics: 0.1,
};

const SCORE_MAX = 4;

export function normalizeScore(score: number, max = SCORE_MAX): number {
  if (!Number.isFinite(score) || max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, score / max));
}

export function weightedMean(parts: ScoreBreakdown[]): number {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }
  return parts.reduce((sum, part) => sum + part.score01 * part.weight, 0) / totalWeight;
}

export function toJevScore(
  weights: Record<string, number>,
  scores: Record<string, Pick<ScoreAnswer, "score" | "confidence">>,
  coverage01: number | null,
  coverageWeight: number,
): JevScore {
  const breakdown: ScoreBreakdown[] = [];
  const confidences: number[] = [];

  for (const [key, weight] of Object.entries(weights)) {
    const answer = scores[key];
    const score01 = answer ? normalizeScore(answer.score) : 0;
    if (answer && typeof answer.confidence === "number") {
      confidences.push(answer.confidence);
    }
    breakdown.push({ key, score01, weight });
  }

  let value01 = weightedMean(breakdown);
  if (coverage01 !== null && coverageWeight > 0) {
    const scoreWeight = 1 - coverageWeight;
    value01 = scoreWeight * value01 + coverageWeight * Math.min(1, Math.max(0, coverage01));
    breakdown.push({ key: "requirement_coverage", score01: coverage01, weight: coverageWeight });
  }

  const confidence =
    confidences.length > 0 ? Math.min(...confidences) : null;

  return {
    value: Math.round(value01 * 100),
    breakdown,
    confidence,
  };
}
