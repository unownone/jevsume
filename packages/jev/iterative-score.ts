import { normalizeScore } from "./score.ts";
import type { HierarchyNode, RubricScore } from "./types.ts";

/** Integer percents that sum to `total` (default 100) via largest remainder. */
export function largestRemainderPercents(raw: number[], total = 100): number[] {
  if (raw.length === 0) {
    return [];
  }
  const cleaned = raw.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = cleaned.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    const even = Math.floor(total / raw.length);
    const leftover = total - even * raw.length;
    return raw.map((_, index) => even + (index < leftover ? 1 : 0));
  }
  const scaled = cleaned.map((value) => (value / sum) * total);
  const floors = scaled.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = scaled
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((left, right) => right.frac - left.frac);
  const out = [...floors];
  for (const item of order) {
    if (remainder <= 0) {
      break;
    }
    out[item.index] = (out[item.index] ?? 0) + 1;
    remainder -= 1;
  }
  return out;
}

export function recoverPoints(input: {
  sectionWeight: number;
  dimensionWeight01: number;
  current01: number;
  target01?: number;
}): number {
  const target = input.target01 ?? 1;
  const gap = Math.max(0, target - Math.min(1, Math.max(0, input.current01)));
  const points = input.sectionWeight * Math.min(1, Math.max(0, input.dimensionWeight01)) * gap;
  return Number(points.toFixed(1));
}

export function innerScore01(dimensions: RubricScore[]): number {
  if (dimensions.length === 0) {
    return 0;
  }
  const weight = dimensions.reduce((sum, item) => sum + item.weight01, 0);
  if (weight <= 0) {
    return 0;
  }
  return dimensions.reduce((sum, item) => sum + (item.score / item.max) * item.weight01, 0) / weight;
}

export function scoredContribution(weight: number, score01: number | null): number {
  if (score01 === null) {
    return 0;
  }
  return weight * Math.min(1, Math.max(0, score01));
}

/** Overall 0–100 from L1 nodes. Unscored sections contribute 0 so the total climbs. */
export function climbOverall(roots: HierarchyNode[]): number {
  const raw = roots.reduce((sum, node) => sum + scoredContribution(node.weight ?? 0, node.score01), 0);
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function applyContributions(roots: HierarchyNode[], overall: number): HierarchyNode[] {
  const scored = roots.filter((node) => node.score01 !== null && (node.weight ?? 0) > 0);
  const raw = scored.map((node) => scoredContribution(node.weight ?? 0, node.score01));
  const rounded = largestRemainderPercents(raw, overall);
  let cursor = 0;
  return roots.map((node) => {
    if (node.score01 === null || !(node.weight ?? 0)) {
      return { ...node, contribution: 0 };
    }
    const contribution = rounded[cursor] ?? 0;
    cursor += 1;
    return { ...node, contribution };
  });
}

export function scoreFromLevels(
  answers: Record<string, { type: string; score?: number }>,
  ids: string[],
  max = 4,
): number {
  const values = ids.flatMap((id) => {
    const answer = answers[id];
    if (!answer || answer.type !== "score" || typeof answer.score !== "number") {
      return [];
    }
    return [normalizeScore(answer.score, max)];
  });
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
