import type {
  FindingSeverity,
  RequirementReview,
  ReviewFinding,
  ReviewResponse,
  ReviewSuggestion,
} from "../packages/jev/types.ts";

export const MCP_SERVER_NAME = "jevsume";
export const MCP_SERVER_VERSION = "0.1.0";
export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const MCP_INSTRUCTIONS =
  "Compact Jev resume review. Prefer list_job_lenses or suggest_job_lens, then review_resume(resumeText, jobLensId). Pass jobText only when the user has a listing. Do not echo the resume.";

export const MAX_FINDINGS = 8;
export const MAX_SUGGESTIONS = 5;

export type CompactLens = {
  id: string;
  title: string;
  track: string;
  level: string;
  tags: string[];
  blurb: string;
};

export type CompactLensDetail = CompactLens & {
  company: string;
  jobText: string;
};

export type CompactFinding = {
  sev: FindingSeverity;
  title: string;
  detail: string;
};

export type CompactSuggestion = {
  text: string;
  recover?: number;
};

export type CompactGap = {
  text: string;
  verdict: string;
};

export type CompactSkill = {
  name: string;
  alignment: string;
  source: string;
  resumeLine?: string;
};

export type CompactComparison = {
  expected: string[];
  goodToHave: string[];
  missingSkills: string[];
  availableSkills: string[];
  skillGap: CompactSkill[];
  skillsValidated: CompactSkill[];
  otherExperiences: CompactSkill[];
};

export type CompactReview = {
  score: number;
  conformityScore: number;
  jobMatchScore: number | null;
  validity: number;
  evidence: number;
  mode: ReviewResponse["mode"];
  lens: { id: string; title: string };
  findings: CompactFinding[];
  suggestions: CompactSuggestion[];
  gaps: CompactGap[];
  comparison?: CompactComparison;
};

function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case "missing":
      return 0;
    case "risk":
      return 1;
    case "partial":
      return 2;
    case "works":
      return 3;
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

function compactFinding(finding: ReviewFinding): CompactFinding {
  return {
    sev: finding.severity,
    title: finding.title,
    detail: finding.detail,
  };
}

function compactSuggestion(suggestion: ReviewSuggestion): CompactSuggestion {
  const next: CompactSuggestion = { text: suggestion.text };
  if (suggestion.recoverPoints !== undefined) {
    next.recover = suggestion.recoverPoints;
  }
  return next;
}

function compactGap(requirement: RequirementReview): CompactGap | null {
  if (requirement.verdict === "works") {
    return null;
  }
  return { text: requirement.text, verdict: requirement.verdict };
}

export function compactReview(review: ReviewResponse): CompactReview {
  const ranked = [...review.findings].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity),
  );
  const actionable = ranked.filter((finding) => finding.severity !== "works");
  const selected = (actionable.length > 0 ? actionable : ranked).slice(0, MAX_FINDINGS);
  const suggestions = review.suggestions.slice(0, MAX_SUGGESTIONS).map(compactSuggestion);
  const gaps = (review.requirements ?? []).flatMap((item) => {
    const gap = compactGap(item);
    return gap ? [gap] : [];
  });
  const comparison = review.jobComparison
    ? {
        expected: review.jobComparison.expected,
        goodToHave: review.jobComparison.goodToHave,
        missingSkills: review.jobComparison.missingSkills,
        availableSkills: review.jobComparison.availableSkills,
        skillGap: review.jobComparison.skillGap.map((skill) => ({
          name: skill.name,
          alignment: skill.alignment,
          source: skill.source,
          ...(skill.resumeLine ? { resumeLine: skill.resumeLine } : {}),
        })),
        skillsValidated: review.jobComparison.skillsValidated.map((skill) => ({
          name: skill.name,
          alignment: skill.alignment,
          source: skill.source,
          ...(skill.resumeLine ? { resumeLine: skill.resumeLine } : {}),
        })),
        otherExperiences: review.jobComparison.otherExperiences.map((skill) => ({
          name: skill.name,
          alignment: skill.alignment,
          source: skill.source,
          ...(skill.resumeLine ? { resumeLine: skill.resumeLine } : {}),
        })),
      }
    : undefined;
  return {
    score: review.jevScore.value,
    conformityScore: review.conformityScore?.value ?? review.jevScore.value,
    jobMatchScore: review.jobMatchScore?.value ?? null,
    validity: review.validity,
    evidence: review.evidence,
    mode: review.mode,
    lens: { id: review.persona.id, title: review.persona.title },
    findings: selected.map(compactFinding),
    suggestions,
    gaps,
    ...(comparison ? { comparison } : {}),
  };
}

export function encodeToolJson(value: unknown): string {
  return JSON.stringify(value);
}
