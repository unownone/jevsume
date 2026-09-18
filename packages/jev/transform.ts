import {
  fallbackSpan,
  passageForSpan,
  sectionBodySpan,
  spanForDimension,
  spanMatchingText,
} from "./anchors.ts";
import { DEFAULT_PERSONA } from "./default-persona.ts";
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
  ReviewTelemetry,
  ScoreAnswer,
  SectionKind,
  SystemOneResult,
  TextSpan,
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
  ats_parse: "Plain text",
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

const EMPTY_TELEMETRY: ReviewTelemetry = {
  serverMs: 0,
  inputTokens: 0,
  costUsd: 0,
};

function suggestion(
  id: string,
  text: string,
  span?: TextSpan,
  findingId?: string,
): ReviewSuggestion {
  return { id, text, ...(span ? { span } : {}), ...(findingId ? { findingId } : {}) };
}

function finding(
  id: string,
  severity: FindingSeverity,
  title: string,
  detail: string,
  span: TextSpan,
  suggestedRewrite?: string,
): ReviewFinding {
  return { id, severity, title, detail, span, ...(suggestedRewrite ? { suggestedRewrite } : {}) };
}

function rewriteFor(kind: string, passage: string): string {
  const line = passage.replace(/\s+/g, " ").trim();
  const clipped = line.length > 140 ? `${line.slice(0, 137)}…` : line;
  const stem = clipped || "this line";
  switch (kind) {
    case "metrics":
      return `Try: ${stem} — name the outcome in numbers (%, $, time, or scale).`;
    case "wording":
      return `Try: lead with what you owned, not “responsible for.” ${stem}`;
    case "conciseness":
      return `Try: keep one outcome on this line. ${stem}`;
    case "structure":
      return "Try: put this heading on its own line: Experience, Education, or Skills.";
    case "ats_parse":
      return "Try: keep this as a single column of plain text, no tables or images.";
    case "summary":
      return "Try: a two-line profile that names the role you want and two proof points.";
    case "skills":
      return "Try: a Skills line of tools and languages a recruiter can copy.";
    default:
      return `Try tightening this line: ${stem}`;
  }
}

function generalSuggestions(
  answers: Record<string, Answer>,
  sections: ResumeSection[],
): ReviewSuggestion[] {
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
    const span = spanForDimension("metrics", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "metrics",
        "Add quantified outcomes (%, $, time saved, team size, scale) to this bullet.",
        span,
        "weakest",
      ),
    );
  }
  if (wording && wording.score < 2) {
    const span = spanForDimension("wording", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "wording",
        "Replace generic verbs (responsible for, helped) with specific ownership language.",
        span,
      ),
    );
  }
  if (conciseness && conciseness.score < 2) {
    const span = spanForDimension("conciseness", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "conciseness",
        "Cut filler and keep one outcome per bullet so a reader can scan.",
        span,
      ),
    );
  }
  if (structure && structure.score < 2) {
    const span = spanForDimension("structure", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "structure",
        "Use familiar headings (Experience, Education, Skills) on their own lines.",
        span,
      ),
    );
  }
  if (ats && ats.score < 2) {
    const span = spanForDimension("ats_parse", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "ats_parse",
        "Keep a linear text layer — avoid columns, text in images, and tables.",
        span,
      ),
    );
  }
  if (hasSummary && hasSummary.noul < 0.4) {
    const span = spanForDimension("wording", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "summary",
        "Add a short profile that names the role you want and 2–3 proof points.",
        span,
      ),
    );
  }
  if (hasSkills && hasSkills.noul < 0.4) {
    const span = spanForDimension("skills", sections) ?? fallbackSpan(sections);
    out.push(
      suggestion("skills", "Add a Skills line of tools and languages a reader can copy.", span),
    );
  }
  if (weakest && weakest.choice !== "none") {
    const span = spanForDimension(weakest.choice, sections) ?? fallbackSpan(sections);
    out.push(
      suggestion(
        "weakest",
        `The thinnest part of this resume is ${weakest.choice}. Raise that before you send it.`,
        span,
        "weakest",
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
  resumeText?: string;
  telemetry?: ReviewTelemetry;
}): ReviewResponse {
  const { answers, model } = input.result;
  const scores = pickScores(answers, Object.keys(GENERAL_WEIGHTS));
  const jevScore = toJevScore(GENERAL_WEIGHTS, scores, null, 0);
  const sections = annotateSections(input.sections, answers);
  const dimensions = dimensionList(answers, Object.keys(GENERAL_WEIGHTS));
  const findings: ReviewFinding[] = [];

  const hasExperience = asNoul(answers.has_experience);
  if (hasExperience && hasExperience.noul < 0.4) {
    const span = spanForDimension("structure", sections) ?? fallbackSpan(sections);
    findings.push(
      finding(
        "no-experience",
        "risk",
        "Experience hard to parse",
        "Jev is not confident this resume contains recognizable work history.",
        span,
        rewriteFor("structure", passageForSpan(sections, span)),
      ),
    );
  }

  const weakest = asChoice(answers.weakest_dimension);
  if (weakest && weakest.choice !== "none") {
    const span = spanForDimension(weakest.choice, sections) ?? fallbackSpan(sections);
    findings.push(
      finding(
        "weakest",
        "risk",
        `Needs work: ${weakest.choice}`,
        `This is the thinnest part of the resume (confidence ${weakest.confidence.toFixed(2)}).`,
        span,
        rewriteFor(weakest.choice, passageForSpan(sections, span)),
      ),
    );
  }

  for (const section of sections) {
    const quality = asScore(answers[`sec_${section.id}_quality`]);
    const span = sectionBodySpan(section) ?? fallbackSpan(sections);
    if (quality && quality.score >= 3) {
      findings.push(
        finding(
          `sec-ok-${section.id}`,
          "works",
          `${section.heading} reads well`,
          `Section quality ${quality.score.toFixed(1)} / 4.`,
          span,
        ),
      );
    } else if (quality && quality.score < 2) {
      findings.push(
        finding(
          `sec-weak-${section.id}`,
          "partial",
          `${section.heading} needs work`,
          `Section quality ${quality.score.toFixed(1)} / 4.`,
          span,
          rewriteFor(section.kind === "skills" ? "skills" : "wording", passageForSpan(sections, span)),
        ),
      );
    }
  }

  for (const dimension of dimensions) {
    if (dimension.score >= 3) {
      continue;
    }
    const span = spanForDimension(dimension.id, sections) ?? fallbackSpan(sections);
    findings.push(
      finding(
        `dim-${dimension.id}`,
        dimension.score < 2 ? "partial" : "partial",
        `${dimension.label} could be tighter`,
        `${dimension.label} scored ${dimension.score.toFixed(1)} / 4 on this passage.`,
        span,
        rewriteFor(dimension.id, passageForSpan(sections, span)),
      ),
    );
  }

  if (findings.length === 0) {
    const span = fallbackSpan(sections);
    findings.push(
      finding(
        "read-through",
        "works",
        "This resume holds together",
        "No hard gaps jumped out. Skim the marked lines anyway — small wording wins still count.",
        span,
      ),
    );
  }

  return {
    mode: "general",
    jevScore,
    dimensions,
    sections,
    findings,
    suggestions: generalSuggestions(answers, sections),
    provider: input.provider,
    model,
    resumeText: input.resumeText ?? sections.map((section) => section.text).join("\n"),
    persona: {
      id: DEFAULT_PERSONA.id,
      title: DEFAULT_PERSONA.title,
      isDefault: true,
    },
    telemetry: input.telemetry ?? EMPTY_TELEMETRY,
  };
}

export function transformJobReview(input: {
  result: SystemOneResult;
  persona: JobPersona;
  sections: ResumeSection[];
  provider: ProviderId;
  resumeText?: string;
  telemetry?: ReviewTelemetry;
}): ReviewResponse {
  const { answers, model } = input.result;
  const scores = pickScores(answers, Object.keys(JOB_SCORE_WEIGHTS));
  const sections = annotateSections(input.sections, answers);

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

  const coveragePool = requirements.filter(
    (req) =>
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
  const suggestions: ReviewSuggestion[] = [...generalSuggestions(answers, sections)];

  for (const req of requirements) {
    const span = spanMatchingText(sections, req.text) ?? fallbackSpan(sections);
    const passage = passageForSpan(sections, span);
    switch (req.verdict) {
      case "works":
        findings.push(finding(`req-${req.id}`, "works", "Works for this job", req.text, span));
        break;
      case "partial":
        findings.push(finding(`req-${req.id}`, "partial", "Partial match", req.text, span, `Make this requirement explicit near: ${passage}`));
        suggestions.push(
          suggestion(`req-${req.id}`, `Make this requirement explicit: ${req.text}`, span, `req-${req.id}`),
        );
        break;
      case "missing":
        findings.push(
          finding(
            `req-${req.id}`,
            "missing",
            "Missing for this job",
            req.text,
            span,
            `Add a line that shows: ${req.text}`,
          ),
        );
        suggestions.push(
          suggestion(`req-${req.id}`, `Add evidence for: ${req.text}`, span, `req-${req.id}`),
        );
        break;
      case "contradicts":
        findings.push(
          finding(
            `req-${req.id}`,
            "risk",
            "Conflicts with the job",
            req.text,
            span,
            `Reconcile this line with: ${req.text}`,
          ),
        );
        suggestions.push(
          suggestion(`req-${req.id}`, `Resolve the conflict with: ${req.text}`, span, `req-${req.id}`),
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
    sections,
    findings,
    requirements,
    suggestions,
    provider: input.provider,
    model,
    resumeText: input.resumeText ?? sections.map((section) => section.text).join("\n"),
    persona: {
      id: input.persona.id,
      title: input.persona.title,
      isDefault: false,
    },
    telemetry: input.telemetry ?? EMPTY_TELEMETRY,
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
