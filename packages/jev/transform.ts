import { PERSONA_NOUL_KEEP_THRESHOLD } from "./questions.ts";
import { GENERAL_WEIGHTS, JOB_SCORE_WEIGHTS, toJevScore } from "./score.ts";
import type {
  Answer,
  ChoiceAnswer,
  FindingSeverity,
  JobPersona,
  NoulAnswer,
  PersonaRequirement,
  ProviderId,
  RequirementCategory,
  RequirementReview,
  RequirementVerdict,
  ResumeSection,
  ReviewFinding,
  ReviewResponse,
  ReviewSuggestion,
  ScoreAnswer,
  SectionKind,
  SystemOneResult,
} from "./types.ts";
import { assertNever } from "./types.ts";

function asScore(answer: Answer | undefined): ScoreAnswer | null {
  if (answer && answer.type === "score") {
    return answer;
  }
  return null;
}

function asNoul(answer: Answer | undefined): NoulAnswer | null {
  if (answer && answer.type === "noul") {
    return answer;
  }
  return null;
}

function asChoice(answer: Answer | undefined): ChoiceAnswer | null {
  if (answer && answer.type === "choice") {
    return answer;
  }
  return null;
}

function pickScores(
  answers: Record<string, Answer>,
  keys: string[],
): Record<string, ScoreAnswer> {
  const out: Record<string, ScoreAnswer> = {};
  for (const key of keys) {
    const score = asScore(answers[key]);
    if (score) {
      out[key] = score;
    }
  }
  return out;
}

const DIMENSION_LABELS: Record<string, string> = {
  wording: "Wording",
  conciseness: "Conciseness",
  structure: "Structure",
  metrics: "Metrics",
  ats_parse: "ATS parse",
  fit_overall: "Role fit",
  keyword_alignment: "Keyword alignment",
  evidence_strength: "Evidence",
};

function dimensionList(
  answers: Record<string, Answer>,
  ids: string[],
): ReviewResponse["dimensions"] {
  return ids.flatMap((id) => {
    const score = asScore(answers[id]);
    if (!score) {
      return [];
    }
    return [
      {
        id,
        label: DIMENSION_LABELS[id] ?? id,
        score: Number(score.score.toFixed(2)),
        max: 4,
        confidence: score.confidence,
      },
    ];
  });
}

function suggestion(id: string, text: string): ReviewSuggestion {
  return { id, text };
}

function finding(
  id: string,
  severity: FindingSeverity,
  title: string,
  detail: string,
): ReviewFinding {
  return { id, severity, title, detail };
}

function generalSuggestions(answers: Record<string, Answer>): ReviewSuggestion[] {
  const out: ReviewSuggestion[] = [];
  const metrics = asScore(answers.metrics);
  const wording = asScore(answers.wording);
  const conciseness = asScore(answers.conciseness);
  const structure = asScore(answers.structure);
  const ats = asScore(answers.ats_parse);
  const hasSummary = asNoul(answers.has_summary);
  const hasSkills = asNoul(answers.has_skills);
  const weakest = asChoice(answers.weakest_dimension);

  if (metrics && metrics.score < 2) {
    out.push(
      suggestion(
        "metrics",
        "Add quantified outcomes (%, $, time saved, team size, scale) to bullets.",
      ),
    );
  }
  if (wording && wording.score < 2) {
    out.push(
      suggestion(
        "wording",
        "Replace generic verbs (responsible for, helped) with specific ownership language.",
      ),
    );
  }
  if (conciseness && conciseness.score < 2) {
    out.push(
      suggestion(
        "conciseness",
        "Cut filler and keep one outcome per bullet so ATS and humans can scan.",
      ),
    );
  }
  if (structure && structure.score < 2) {
    out.push(
      suggestion(
        "structure",
        "Use canonical headings (Experience, Education, Skills) on their own lines.",
      ),
    );
  }
  if (ats && ats.score < 2) {
    out.push(
      suggestion(
        "ats_parse",
        "Avoid multi-column layouts, text in images, and tables; keep a linear text layer.",
      ),
    );
  }
  if (hasSummary && hasSummary.noul < 0.4) {
    out.push(
      suggestion(
        "summary",
        "Add a short profile that names the role you want and 2–3 proof points.",
      ),
    );
  }
  if (hasSkills && hasSkills.noul < 0.4) {
    out.push(
      suggestion("skills", "Add a Skills line of parser-friendly tokens (tools, languages)."),
    );
  }
  if (weakest && weakest.choice !== "none") {
    out.push(
      suggestion(
        "weakest",
        `Biggest ATS risk flagged: ${weakest.choice}. Raise that dimension before applying.`,
      ),
    );
  }
  return out;
}

function annotateSections(
  sections: ResumeSection[],
  answers: Record<string, Answer>,
): ResumeSection[] {
  return sections.map((section) => {
    const quality = asScore(answers[`sec_${section.id}_quality`]);
    const kindChoice = asChoice(answers[`sec_${section.id}_kind`]);
    const kind =
      section.kind === "other" && kindChoice
        ? coerceSectionKind(kindChoice.choice, section.kind)
        : section.kind;
    return {
      ...section,
      kind,
      fragments: section.fragments,
      text: section.text,
      heading: section.heading,
      id: section.id,
      ...(quality ? { quality: quality.score } : {}),
    } as ResumeSection & { quality?: number };
  });
}

function coerceSectionKind(choice: string, fallback: SectionKind): SectionKind {
  switch (choice) {
    case "summary":
    case "experience":
    case "education":
    case "skills":
    case "projects":
    case "other":
      return choice;
    default:
      return fallback;
  }
}

function coerceCategory(choice: string): RequirementCategory {
  switch (choice) {
    case "must_have":
    case "nice_to_have":
    case "responsibility":
    case "culture":
    case "not_a_requirement":
      return choice;
    default:
      return "not_a_requirement";
  }
}

function coerceVerdict(choice: string): RequirementVerdict {
  switch (choice) {
    case "works":
    case "partial":
    case "missing":
    case "contradicts":
      return choice;
    default:
      return "missing";
  }
}

export function transformGeneralReview(input: {
  result: SystemOneResult;
  sections: ResumeSection[];
  provider: ProviderId;
}): ReviewResponse {
  const { answers, model } = input.result;
  const scores = pickScores(answers, Object.keys(GENERAL_WEIGHTS));
  const jevScore = toJevScore(GENERAL_WEIGHTS, scores, null, 0);
  const sections = annotateSections(input.sections, answers);
  const findings: ReviewFinding[] = [];

  const hasExperience = asNoul(answers.has_experience);
  if (hasExperience && hasExperience.noul < 0.4) {
    findings.push(
      finding(
        "no-experience",
        "risk",
        "Experience hard to parse",
        "Jev is not confident this resume contains recognizable work history.",
      ),
    );
  }

  const weakest = asChoice(answers.weakest_dimension);
  if (weakest && weakest.choice !== "none") {
    findings.push(
      finding(
        "weakest",
        "risk",
        `Weakest dimension: ${weakest.choice}`,
        `Confidence ${weakest.confidence.toFixed(2)}.`,
      ),
    );
  }

  for (const section of sections) {
    const quality = asScore(answers[`sec_${section.id}_quality`]);
    if (quality && quality.score >= 3) {
      findings.push(
        finding(
          `sec-ok-${section.id}`,
          "works",
          `${section.heading} reads well`,
          `Section quality ${quality.score.toFixed(1)} / 4.`,
        ),
      );
    } else if (quality && quality.score < 2) {
      findings.push(
        finding(
          `sec-weak-${section.id}`,
          "partial",
          `${section.heading} needs work`,
          `Section quality ${quality.score.toFixed(1)} / 4.`,
        ),
      );
    }
  }

  return {
    mode: "general",
    jevScore,
    dimensions: dimensionList(answers, Object.keys(GENERAL_WEIGHTS)),
    sections,
    findings,
    suggestions: generalSuggestions(answers),
    provider: input.provider,
    model,
  };
}

export function transformJobReview(input: {
  result: SystemOneResult;
  persona: JobPersona;
  sections: ResumeSection[];
  provider: ProviderId;
}): ReviewResponse {
  const { answers, model } = input.result;
  const scores = pickScores(answers, Object.keys(JOB_SCORE_WEIGHTS));

  const requirements: RequirementReview[] = input.persona.requirements.map((req) => {
    const noul = asNoul(answers[`req_${req.id}_covered`])?.noul ?? 0;
    const verdict = coerceVerdict(
      asChoice(answers[`req_${req.id}_verdict`])?.choice ?? "missing",
    );
    return {
      id: req.id,
      text: req.text,
      category: req.category,
      noul,
      verdict,
    };
  });

  const coveragePool = requirements.filter((req) =>
    req.category === "must_have" ||
    req.category === "nice_to_have" ||
    req.category === "responsibility",
  );
  const coverage01 =
    coveragePool.length === 0
      ? 0
      : coveragePool.reduce((sum, req) => sum + req.noul, 0) / coveragePool.length;

  const jevScore = toJevScore(JOB_SCORE_WEIGHTS, scores, coverage01, 0.25);
  const findings: ReviewFinding[] = [];
  const suggestions: ReviewSuggestion[] = [...generalSuggestions(answers)];

  for (const req of requirements) {
    switch (req.verdict) {
      case "works":
        findings.push(finding(`req-${req.id}`, "works", "Works for this job", req.text));
        break;
      case "partial":
        findings.push(finding(`req-${req.id}`, "partial", "Partial match", req.text));
        suggestions.push(
          suggestion(`req-${req.id}`, `Make this requirement explicit: ${req.text}`),
        );
        break;
      case "missing":
        findings.push(finding(`req-${req.id}`, "missing", "Missing for this job", req.text));
        suggestions.push(
          suggestion(`req-${req.id}`, `Add evidence for: ${req.text}`),
        );
        break;
      case "contradicts":
        findings.push(
          finding(`req-${req.id}`, "risk", "Conflicts with the job", req.text),
        );
        suggestions.push(
          suggestion(`req-${req.id}`, `Resolve the conflict with: ${req.text}`),
        );
        break;
      default: {
        const _exhaustive: never = req.verdict;
        assertNever(_exhaustive, `Unhandled verdict ${String(_exhaustive)}`);
      }
    }
  }

  return {
    mode: "job",
    jevScore,
    dimensions: dimensionList(answers, [
      "fit_overall",
      "keyword_alignment",
      "evidence_strength",
      ...Object.keys(GENERAL_WEIGHTS).filter((key) => key !== "ats_parse"),
    ]),
    sections: input.sections,
    findings,
    requirements,
    suggestions,
    provider: input.provider,
    model,
  };
}

export function requirementsFromPersonaAnswers(input: {
  candidates: { id: string; text: string }[];
  answers: Record<string, Answer>;
}): PersonaRequirement[] {
  const kept: PersonaRequirement[] = [];
  for (let i = 0; i < input.candidates.length; i += 1) {
    const candidate = input.candidates[i];
    const noul = asNoul(input.answers[`req_c${i}`])?.noul ?? 0;
    const category = coerceCategory(
      asChoice(input.answers[`cat_c${i}`])?.choice ?? "not_a_requirement",
    );
    if (noul < PERSONA_NOUL_KEEP_THRESHOLD || category === "not_a_requirement") {
      continue;
    }
    kept.push({
      id: candidate.id,
      text: candidate.text,
      category,
      noul,
    });
  }
  return kept;
}
