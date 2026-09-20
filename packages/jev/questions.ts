import type { ChoiceQuestion, NoulQuestion, Questions, ScoreQuestion } from "./types.ts";

/** Shared 0–4 quality rubric. Each level stands alone (TypeSafe Score docs). */
export const QUALITY_LEVELS: string[] = [
  "Fails the dimension: empty, generic, or unusable for an ATS.",
  "Weak: vague language, missing evidence, or hard for a parser to use.",
  "Adequate: understandable but not calibrated; some ATS friction.",
  "Strong: specific, scannable, mostly ATS-safe.",
  "Excellent: concrete, concise, metric-backed, and parser-friendly.",
];

export const REQUIREMENT_CATEGORIES: Record<string, string> = {
  must_have: "A non-negotiable skill, years bar, or qualification.",
  nice_to_have: "Preferred but not blocking.",
  responsibility: "Day-to-day work the hire will do.",
  culture: "Working style or values, not a hard skill.",
  not_a_requirement: "Boilerplate, benefits, marketing, or not screenable.",
};

export const VERDICT_CRITERIA: Record<string, string> = {
  works: "The resume clearly evidences this requirement.",
  partial: "Some related evidence exists but it is incomplete or implicit.",
  missing: "The resume does not address this requirement.",
  contradicts: "The resume conflicts with this requirement.",
};

export const WEAKEST_DIMENSION_CRITERIA: Record<string, string> = {
  wording: "Diction is generic, buzzword-heavy, or unprofessional.",
  conciseness: "Too long, padded, or repetitive for an ATS skim.",
  structure: "Headings, bullets, or order would confuse a parser.",
  metrics: "Impact is not quantified.",
  ats_parse: "Layout or tokens would be lost in a text-layer extract.",
  none: "No dimension is a meaningful ATS risk.",
};

export const SECTION_KIND_CRITERIA: Record<string, string> = {
  header: "Name, contact, or title block at the top of the page.",
  summary: "Professional summary, profile, or objective.",
  experience: "Paid or equivalent work history as a group of roles.",
  job: "A single role with a title, employer, and bullets.",
  education: "Degrees, schools, or coursework.",
  skills: "Skill tokens, tools, or languages.",
  accolades: "Awards, honors, certifications, or publications.",
  projects: "Projects, open source, or portfolio work.",
  other: "None of the above.",
};

function qualityScore(instructions: string): ScoreQuestion {
  return {
    type: "score",
    instructions,
    criteria: QUALITY_LEVELS,
  };
}

function noul(instructions: string, yes: string, no: string): NoulQuestion {
  return {
    type: "noul",
    instructions,
    criteria: { true: yes, false: no },
  };
}

function choice(instructions: string, criteria: Record<string, string>): ChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

/**
 * Honesty / “is this resume true” cannot be answered from the page.
 * Do not add trustworthiness or truthfulness questions to proctoring.
 * Validity is parser/ATS structure. Evidence is numbered or named claims.
 */
export const LEADERSHIP_VERBS = [
  "led",
  "managed",
  "headed",
  "directed",
  "mentored",
  "coached",
  "hired",
  "staffed",
  "supervised",
  "oversaw",
] as const;

export const LEADERSHIP_REPEAT_CRITERIA: Record<string, string> = {
  none: `No closed-set leadership verbs (${LEADERSHIP_VERBS.join(", ")}) appear.`,
  once: "Each leadership verb from that closed set appears at most twice.",
  repeated: "At least one leadership verb from that closed set appears three or more times.",
};

export function buildGeneralReviewQuestions(sectionIds: string[]): Questions {
  const questions: Questions = {
    wording: qualityScore(
      "How specific and professional is diction in `resume.text` for an ATS-facing resume?",
    ),
    conciseness: qualityScore(
      "How concise is `resume.text` without losing evidence a hiring screen needs?",
    ),
    structure: qualityScore(
      "How well do `resume.sections` use canonical headings and scannable bullets an ATS can group?",
    ),
    metrics: qualityScore(
      "How well does `resume.text` quantify impact with numbers, scope, or outcomes?",
    ),
    ats_parse: qualityScore(
      "How safely would a text-layer ATS parse `resume.text` (plain headings, linear bullets, no implied tables)?",
    ),
    has_summary: noul(
      "Does `resume.text` include a professional summary or profile section?",
      "A summary, profile, or objective is present.",
      "No summary-like section is present.",
    ),
    has_experience: noul(
      "Does `resume.text` include work experience with roles and dates or scope?",
      "Work experience with roles is present.",
      "Work experience is missing or not recognizable.",
    ),
    has_skills: noul(
      "Does `resume.text` list skills a parser could extract as tokens?",
      "Skill tokens are listed.",
      "Skills are missing or only implied.",
    ),
    weakest_dimension: choice(
      "Which dimension is the biggest ATS risk in `resume.text`?",
      WEAKEST_DIMENSION_CRITERIA,
    ),
    leadership_repeat: choice(
      `Count closed-set leadership verbs in \`resume.text\` (${LEADERSHIP_VERBS.join(", ")}). Which bucket fits the highest single-verb count?`,
      LEADERSHIP_REPEAT_CRITERIA,
    ),
    role_over_six: noul(
      "Does any single role in `resume.sections` of kind experience contain more than six bullets or sentences?",
      "At least one role has more than six bullets or sentences.",
      "No role exceeds six bullets or sentences.",
    ),
    skill_unproven: noul(
      "Are there skill tokens listed in a skills section of `resume.text` that never appear in experience bullets?",
      "At least one listed skill token is absent from experience bullets.",
      "Every listed skill token also appears in experience, or there is no skills list.",
    ),
    skill_duplicate: noul(
      "Does the skills list in `resume.text` repeat the same token more than once?",
      "A skill token is listed more than once.",
      "Each skill token appears at most once, or there is no skills list.",
    ),
  };

  for (const id of sectionIds.slice(0, 8)) {
    questions[`sec_${id}_kind`] = choice(
      `Which canonical ATS section kind best fits resume section id ${id} in \`resume.sections\`?`,
      SECTION_KIND_CRITERIA,
    );
    questions[`sec_${id}_quality`] = qualityScore(
      `Rate the ATS usefulness of the section with id ${id} in \`resume.sections\`.`,
    );
  }

  return questions;
}

export function buildPersonaQuestions(candidateCount: number): Questions {
  const questions: Questions = {};
  for (let i = 0; i < candidateCount; i += 1) {
    questions[`req_c${i}`] = noul(
      `Is \`candidates[${i}].text\` a concrete hiring requirement or qualification for \`job.title\`, given \`job.description\` and \`job.tags\`?`,
      "A skill, experience bar, duty, or qualification a hiring manager would screen for.",
      "Boilerplate, benefits, company marketing, or empty phrasing.",
    );
    questions[`cat_c${i}`] = choice(
      `Which requirement category best fits \`candidates[${i}].text\` for this role?`,
      REQUIREMENT_CATEGORIES,
    );
  }
  return questions;
}

export function buildJobReviewQuestions(
  requirementIds: string[],
  fragmentSectionIds: string[],
): Questions {
  const questions: Questions = {
    fit_overall: qualityScore(
      "How well does `resume.text` match `persona.title` and `persona.jobDescription`?",
    ),
    keyword_alignment: qualityScore(
      "How well do tokens in `resume.text` overlap `persona.tags` and the language of `persona.requirements`?",
    ),
    evidence_strength: qualityScore(
      "How well do resume bullets prove `persona.requirements` rather than restating job titles?",
    ),
    wording: qualityScore(
      "How specific and professional is diction in `resume.text` for this job persona?",
    ),
    conciseness: qualityScore(
      "How concise is `resume.text` without dropping evidence this persona would screen for?",
    ),
    structure: qualityScore(
      "How well is `resume.text` structured for an ATS screen against this persona?",
    ),
    metrics: qualityScore(
      "How well does `resume.text` quantify impact relevant to `persona.jobDescription`?",
    ),
  };

  for (const id of requirementIds.slice(0, 16)) {
    questions[`req_${id}_covered`] = noul(
      `Does \`resume.text\` provide evidence for the persona requirement whose id is ${id} in \`persona.requirements\`?`,
      "Clear evidence for that requirement is present.",
      "No usable evidence for that requirement is present.",
    );
    questions[`req_${id}_verdict`] = choice(
      `How does the resume stand against the persona requirement whose id is ${id}?`,
      VERDICT_CRITERIA,
    );
  }

  for (const id of fragmentSectionIds.slice(0, 6)) {
    questions[`frag_${id}_helps`] = noul(
      `Does the resume section with id ${id} help demonstrate fit for \`persona.title\`?`,
      "This section provides useful evidence for the persona.",
      "This section does not help the persona match.",
    );
  }

  return questions;
}

export const PERSONA_NOUL_KEEP_THRESHOLD = 0.55;
