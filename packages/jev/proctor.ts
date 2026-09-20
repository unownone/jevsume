import { validityEvidenceFromTree } from "../../shared/score-pair.ts";
import { fallbackSpan } from "./anchors.ts";
import { DEFAULT_PERSONA } from "./default-persona.ts";
import { kindLabel, sectionsFromTree } from "./hierarchy.ts";
import {
  applyContributions,
  climbOverall,
  innerScore01,
  largestRemainderPercents,
  recoverPoints,
} from "./iterative-score.ts";
import { KIND_PRIOR, rubricForKind } from "./rubrics.ts";
import { normalizeScore } from "./score.ts";
import type {
  Answer,
  FindingSeverity,
  HierarchyNode,
  JobPersona,
  ProviderId,
  ReviewFinding,
  ReviewResponse,
  ReviewSuggestion,
  ReviewTelemetry,
  RubricScore,
  ScoreAnswer,
  TextSpan,
} from "./types.ts";

function asScore(answer: Answer | undefined): ScoreAnswer | null {
  if (answer && answer.type === "score") {
    return answer;
  }
  return null;
}

export function applyL1Weights(roots: HierarchyNode[], answers: Record<string, Answer>): HierarchyNode[] {
  const raw = roots.map((node) => {
    const prior = KIND_PRIOR[node.kind] || KIND_PRIOR.other;
    const judged = asScore(answers[`weight_${node.id}`]);
    const score01 = judged ? normalizeScore(judged.score) : 0.5;
    return Math.max(0.5, prior * (0.45 + 0.55 * score01));
  });
  const percents = largestRemainderPercents(raw, 100);
  return applyChildWeights(
    roots.map((node, index) => ({
      ...node,
      weight: percents[index] ?? 0,
    })),
  );
}

/** Split an L1 weight across children with integers that still sum to the parent. */
export function applyChildWeights(roots: HierarchyNode[]): HierarchyNode[] {
  return roots.map((root) => {
    if (root.children.length === 0 || root.weight === null) {
      return root;
    }
    const shares = largestRemainderPercents(
      root.children.map(() => 1),
      root.weight,
    );
    return {
      ...root,
      children: root.children.map((child, index) => ({
        ...child,
        weight: shares[index] ?? 0,
      })),
    };
  });
}

function spanFor(node: HierarchyNode): TextSpan {
  return {
    start: node.start,
    end: Math.max(node.start + 1, node.end),
    sectionId: node.id,
    fragmentId: `${node.id}-body`,
    line: node.line,
  };
}

function suggestionFromRubric(
  node: HierarchyNode,
  dimension: RubricScore,
  sectionWeight: number,
): ReviewSuggestion | null {
  if (dimension.score >= 3) {
    return null;
  }
  const recover = recoverPoints({
    sectionWeight,
    dimensionWeight01: dimension.weight01,
    current01: dimension.score / dimension.max,
  });
  if (recover <= 0) {
    return null;
  }
  return {
    id: `${node.id}-${dimension.id}`,
    text: `Raise ${dimension.label.toLowerCase()} in ${node.title}. Applying this recovers about ${recover} point${recover === 1 ? "" : "s"}.`,
    span: spanFor(node),
    sectionId: node.id,
    recoverPoints: recover,
  };
}

function findingFromRubric(node: HierarchyNode, dimension: RubricScore): ReviewFinding {
  const ratio = dimension.score / dimension.max;
  let severity: FindingSeverity = "works";
  if (ratio < 0.4) {
    severity = "missing";
  } else if (ratio < 0.55) {
    severity = "risk";
  } else if (ratio < 0.75) {
    severity = "partial";
  }
  return {
    id: `f-${node.id}-${dimension.id}`,
    severity,
    title: `${dimension.label}: ${dimension.score.toFixed(1)} / ${dimension.max}`,
    detail: `${kindLabel(node.kind)} · ${node.title}. Recover ${dimension.recoverPoints} if this dimension is fixed.`,
    span: spanFor(node),
  };
}

export function scoreHierarchyNode(
  node: HierarchyNode,
  answers: Record<string, Answer>,
  sectionWeight: number,
): { node: HierarchyNode; suggestions: ReviewSuggestion[]; findings: ReviewFinding[] } {
  const rubric = rubricForKind(node.kind, node.id, `\`node.text\` for ${node.title}`);
  const dimensions: RubricScore[] = rubric.map((item) => {
    const judged = asScore(answers[item.id]);
    const score = judged ? Number(judged.score.toFixed(2)) : 0;
    const current01 = judged ? normalizeScore(judged.score) : 0;
    return {
      id: item.id,
      label: item.label,
      score,
      max: 4,
      weight01: item.weight01,
      recoverPoints: recoverPoints({
        sectionWeight,
        dimensionWeight01: item.weight01,
        current01,
      }),
    };
  });
  const score01 = innerScore01(dimensions);
  const scored: HierarchyNode = {
    ...node,
    score01,
    contribution: scoredContributionSafe(sectionWeight, score01),
    status: "scored",
    dimensions,
  };
  const weak = dimensions.filter((item) => item.score < 3);
  const suggestions = dimensions.flatMap((item) => {
    const next = suggestionFromRubric(scored, item, sectionWeight);
    return next ? [next] : [];
  });
  const findings = (weak.length > 0 ? weak : dimensions.slice(0, 1)).map((item) =>
    findingFromRubric(scored, item),
  );
  return { node: scored, suggestions, findings };
}

function scoredContributionSafe(weight: number, score01: number): number {
  return Number((weight * score01).toFixed(2));
}

export function rollUpParents(roots: HierarchyNode[]): HierarchyNode[] {
  return roots.map((root) => {
    if (root.kind !== "experience" || root.children.length === 0) {
      return root;
    }
    const children = root.children.map((child) => {
      if (child.score01 === null) {
        return child;
      }
      const weight = child.weight ?? childShare(root.weight ?? 0, root.children.length);
      return {
        ...child,
        weight,
        contribution: scoredContributionSafe(weight, child.score01),
      };
    });
    const scoredKids = children.filter((child) => child.score01 !== null);
    if (scoredKids.length === 0) {
      return { ...root, children };
    }
    const score01 =
      scoredKids.reduce((sum, child) => sum + (child.score01 ?? 0), 0) / scoredKids.length;
    return {
      ...root,
      children,
      score01,
      contribution: scoredContributionSafe(root.weight ?? 0, score01),
      status: scoredKids.length === children.length ? "scored" : "pending",
    };
  });
}

export function dimensionsFromRoots(roots: HierarchyNode[]): ReviewResponse["dimensions"] {
  return roots.map((root) => ({
    id: root.id,
    label: root.title,
    score: root.contribution ?? 0,
    max: root.weight ?? 0,
    confidence: root.status === "scored" ? 1 : undefined,
  }));
}

export function buildProctorReview(input: {
  roots: HierarchyNode[];
  provider: ProviderId;
  resumeText: string;
  telemetry: ReviewTelemetry;
  suggestions: ReviewSuggestion[];
  findings: ReviewFinding[];
  persona?: JobPersona;
  mode: "general" | "job";
  model?: string;
  requirements?: ReviewResponse["requirements"];
  jobTarget?: ReviewResponse["jobTarget"];
}): ReviewResponse {
  const rolled = rollUpParents(input.roots);
  const overall = climbOverall(rolled);
  const roots = applyContributions(rolled, overall);
  const pair = validityEvidenceFromTree(roots);
  const sections = sectionsFromTree(roots);
  const findings =
    input.findings.length > 0
      ? input.findings
      : [
          {
            id: "read-through",
            severity: "works" as const,
            title: "This resume holds together",
            detail: "No hard gaps jumped out on the section pass.",
            span: fallbackSpan(sections),
          },
        ];
  return {
    mode: input.mode,
    jevScore: {
      value: overall,
      breakdown: roots.map((root) => ({
        key: root.id,
        score01: root.score01 ?? 0,
        weight: (root.weight ?? 0) / 100,
      })),
      confidence: null,
    },
    validity: pair.validity,
    evidence: pair.evidence,
    dimensions: dimensionsFromRoots(roots),
    sections,
    hierarchy: roots,
    findings,
    suggestions: input.suggestions,
    requirements: input.requirements,
    provider: input.provider,
    model: input.model,
    resumeText: input.resumeText,
    persona: input.persona
      ? { id: input.persona.id, title: input.persona.title, isDefault: false }
      : { id: DEFAULT_PERSONA.id, title: DEFAULT_PERSONA.title, isDefault: true },
    jobTarget: input.jobTarget,
    telemetry: input.telemetry,
  };
}

export function childShare(parentWeight: number, childCount: number): number {
  if (childCount <= 0) {
    return parentWeight;
  }
  return parentWeight / childCount;
}

export function nodeWeightForScoring(roots: HierarchyNode[], node: HierarchyNode): number {
  if (node.weight !== null) {
    return node.weight;
  }
  if (node.level === 1) {
    return 0;
  }
  const parent = roots.find((root) => root.id === node.parentId);
  return childShare(parent?.weight ?? 0, parent?.children.length ?? 1);
}
