import type { HierarchyKind, Questions, ScoreQuestion } from "./types.ts";

const QUALITY: string[] = [
  "Fails: empty, generic, or unusable for an ATS or hiring screen.",
  "Weak: vague, missing evidence, or hard for a parser to use.",
  "Adequate: understandable but not calibrated; some friction.",
  "Strong: specific, scannable, mostly ATS-safe.",
  "Excellent: concrete, concise, evidence-backed, and parser-friendly.",
];

function score(instructions: string): ScoreQuestion {
  return {
    type: "score",
    instructions: `${instructions} If \`persona.jobDescription\` or \`job.description\` is present, judge against that listing: skills fit, missing keywords, experience relevance, and seniority. If absent, judge the resume generally.`,
    criteria: QUALITY,
  };
}

export type RubricQuestion = {
  id: string;
  label: string;
  weight01: number;
  question: ScoreQuestion;
};

export function rubricForKind(kind: HierarchyKind, nodeId: string, path: string): RubricQuestion[] {
  const prefix = `n_${nodeId}`;
  switch (kind) {
    case "header":
      return [
        {
          id: `${prefix}_name`,
          label: "Name parseable",
          weight01: 0.3,
          question: score(`Is the candidate name in ${path} a plain-text token an ATS can extract (not an image)?`),
        },
        {
          id: `${prefix}_contact`,
          label: "Contact completeness",
          weight01: 0.3,
          question: score(`How complete is contact in ${path} (email, location, and a professional profile URL)?`),
        },
        {
          id: `${prefix}_ats`,
          label: "Header ATS parse",
          weight01: 0.25,
          question: score(`How safely would a text-layer ATS parse ${path} (no text in images, no multi-column contact)?`),
        },
        {
          id: `${prefix}_consistency`,
          label: "Format consistency",
          weight01: 0.15,
          question: score(`How consistent is formatting in ${path} with the rest of the resume?`),
        },
      ];
    case "summary":
      return [
        {
          id: `${prefix}_target`,
          label: "Role targeting",
          weight01: 0.3,
          question: score(`How specifically does ${path} name the role this resume is aiming at?`),
        },
        {
          id: `${prefix}_metrics`,
          label: "Quantified proof",
          weight01: 0.3,
          question: score(`How well does ${path} include numbered proof, not a vibe?`),
        },
        {
          id: `${prefix}_length`,
          label: "Length",
          weight01: 0.2,
          question: score(`How well does ${path} stay at two to four scannable lines without padding?`),
        },
        {
          id: `${prefix}_keywords`,
          label: "Keyword density",
          weight01: 0.2,
          question: score(`How well does ${path} use real role keywords without stuffing?`),
        },
      ];
    case "job":
    case "experience":
      return [
        {
          id: `${prefix}_verbs`,
          label: "Action verbs",
          weight01: 0.18,
          question: score(`How well do bullets in ${path} lead with ownership verbs rather than “responsible for”?`),
        },
        {
          id: `${prefix}_metrics`,
          label: "Quantified impact",
          weight01: 0.22,
          question: score(`How well do bullets in ${path} quantify impact with %, $, time, volume, or scale?`),
        },
        {
          id: `${prefix}_count`,
          label: "Bullet count",
          weight01: 0.12,
          question: score(`How well does ${path} stay in a 3–6 bullet band (not a wall, not a stub)?`),
        },
        {
          id: `${prefix}_recency`,
          label: "Recency",
          weight01: 0.1,
          question: score(`How clearly does ${path} show dates and that the role is placed in a recency-sensible order?`),
        },
        {
          id: `${prefix}_specific`,
          label: "Named systems",
          weight01: 0.16,
          question: score(`How specific is ${path} (named systems, products, or teams — not “various tools”)?`),
        },
        {
          id: `${prefix}_consistency`,
          label: "Tense and format",
          weight01: 0.1,
          question: score(`How consistent is tense, punctuation, and bullet shape in ${path}?`),
        },
        {
          id: `${prefix}_ats_parse`,
          label: "ATS line integrity",
          weight01: 0.12,
          question: score(`How safely would a text-layer ATS keep lines in ${path} (no tables, one column, real bullets)?`),
        },
      ];
    case "skills":
      return [
        {
          id: `${prefix}_unique`,
          label: "Unique tokens",
          weight01: 0.2,
          question: score(`Does the skills list in ${path} list each token once, with one spelling?`),
        },
        {
          id: `${prefix}_proven`,
          label: "Proven in work",
          weight01: 0.28,
          question: score(`How well do tokens in ${path} also appear next to the work that used them?`),
        },
        {
          id: `${prefix}_ats_parse`,
          label: "ATS separators",
          weight01: 0.18,
          question: score(`How parseable is ${path} as a token list (commas or bullets, not icons or columns)?`),
        },
        {
          id: `${prefix}_relevance`,
          label: "Relevance density",
          weight01: 0.2,
          question: score(`How tightly does ${path} stick to skills a hiring screen for this resume would search?`),
        },
        {
          id: `${prefix}_dump`,
          label: "Dump vs evidence",
          weight01: 0.14,
          question: score(`How well does ${path} avoid a forgettable dump and instead support the jobs above?`),
        },
      ];
    case "education":
      return [
        {
          id: `${prefix}_parse`,
          label: "School and degree",
          weight01: 0.35,
          question: score(`How clearly does ${path} name school and degree as plain text an ATS can group?`),
        },
        {
          id: `${prefix}_dates`,
          label: "Dates",
          weight01: 0.25,
          question: score(`How clearly does ${path} include dates or a graduation year?`),
        },
        {
          id: `${prefix}_relevance`,
          label: "Role relevance",
          weight01: 0.25,
          question: score(`How relevant is ${path} to the work this resume is selling?`),
        },
        {
          id: `${prefix}_weight`,
          label: "Seniority weight",
          weight01: 0.15,
          question: score(`How well is ${path} sized (not a senior IC resume dominated by coursework)?`),
        },
      ];
    case "accolades":
      return [
        {
          id: `${prefix}_named`,
          label: "Named award",
          weight01: 0.3,
          question: score(`How clearly does ${path} name the award, honor, or certification?`),
        },
        {
          id: `${prefix}_grantor`,
          label: "Grantor",
          weight01: 0.25,
          question: score(`How clearly does ${path} say who granted it?`),
        },
        {
          id: `${prefix}_recency`,
          label: "Recency",
          weight01: 0.2,
          question: score(`How clearly does ${path} date the accolade?`),
        },
        {
          id: `${prefix}_relevance`,
          label: "Relevance",
          weight01: 0.25,
          question: score(`How relevant is ${path} to the role this resume is aiming at?`),
        },
      ];
    case "projects":
      return [
        {
          id: `${prefix}_outcome`,
          label: "Named outcome",
          weight01: 0.3,
          question: score(`How clearly does ${path} name what shipped?`),
        },
        {
          id: `${prefix}_role`,
          label: "Personal role",
          weight01: 0.25,
          question: score(`How clearly does ${path} say what this person owned versus the team?`),
        },
        {
          id: `${prefix}_metrics`,
          label: "Metrics",
          weight01: 0.25,
          question: score(`How well does ${path} quantify impact?`),
        },
        {
          id: `${prefix}_recency`,
          label: "Recency",
          weight01: 0.2,
          question: score(`How clearly is ${path} dated and still relevant?`),
        },
      ];
    case "other":
      return [
        {
          id: `${prefix}_parse`,
          label: "Parseability",
          weight01: 0.4,
          question: score(`How safely would an ATS parse ${path}?`),
        },
        {
          id: `${prefix}_specific`,
          label: "Specificity",
          weight01: 0.35,
          question: score(`How specific and evidenced is ${path}?`),
        },
        {
          id: `${prefix}_belongs`,
          label: "Belongs on page",
          weight01: 0.25,
          question: score(`How clearly does ${path} earn its place on this resume?`),
        },
      ];
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function buildSectionQuestions(kind: HierarchyKind, nodeId: string, path: string): Questions {
  const questions: Questions = {};
  for (const item of rubricForKind(kind, nodeId, path)) {
    questions[item.id] = item.question;
  }
  return questions;
}

export const KIND_PRIOR: Record<HierarchyKind, number> = {
  header: 8,
  summary: 10,
  experience: 48,
  job: 0,
  skills: 16,
  education: 8,
  accolades: 6,
  projects: 10,
  other: 6,
};

export function buildWeightQuestions(nodes: Array<{ id: string; kind: HierarchyKind; title: string }>): Questions {
  const questions: Questions = {};
  for (const node of nodes) {
    questions[`weight_${node.id}`] = score(
      `How much of an ATS and hiring-manager screen of this resume should the L1 section “${node.title}” (${node.kind}) carry? 4 = decisive for this page; 0 = almost no hiring weight.`,
    );
  }
  return questions;
}
