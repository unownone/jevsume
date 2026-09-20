import { padBox } from "./boxes.ts";
import { DEMO_PERSONA } from "./demo.ts";
import type { DocumentLine, OverlayFinding, RewriteKind, SuggestionCard } from "./types.ts";

export const TECH_TOKENS = [
  "go",
  "golang",
  "rust",
  "python",
  "typescript",
  "javascript",
  "kafka",
  "react",
  "postgres",
  "postgresql",
  "redis",
  "aws",
  "gcp",
  "docker",
  "kubernetes",
  "fastapi",
  "next.js",
  "nextjs",
  "arangodb",
  "clickhouse",
  "bullmq",
] as const;

export const LEADERSHIP_WORDS = ["led", "managed", "headed", "directed", "mentored", "coached", "hired", "staffed", "supervised", "oversaw"] as const;

const DENSE_BULLET_LIMIT = 6;

const ROTATE: Record<(typeof LEADERSHIP_WORDS)[number], string> = {
  led: "mentored",
  managed: "coached",
  headed: "owned",
  directed: "guided",
  mentored: "staffed",
  coached: "mentored",
  hired: "grew",
  staffed: "mentored",
  supervised: "coached",
  oversaw: "owned",
};

export type LeadershipCount = {
  word: (typeof LEADERSHIP_WORDS)[number];
  count: number;
};

export type JobBlock = {
  title: string;
  bullets: DocumentLine[];
};

export type DocumentAnalysis = {
  leadership: LeadershipCount[];
  leadershipTotal: number;
  repeatedLeadership: LeadershipCount[];
  jobs: JobBlock[];
  denseJobs: JobBlock[];
  listedSkills: string[];
  inferredSkills: string[];
  expectedSkills: string[];
  duplicateSkills: string[];
  unprovenSkills: string[];
  missingExpected: string[];
};

function normalizeToken(value: string): string {
  const lower = value.toLowerCase().replace(/^\W+|\W+$/g, "");
  if (lower === "golang") {
    return "go";
  }
  if (lower === "postgresql") {
    return "postgres";
  }
  if (lower === "nextjs") {
    return "next.js";
  }
  return lower;
}

function tokensIn(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const token of TECH_TOKENS) {
    const needle = token === "go" ? /\bgo\b/i : new RegExp(`\\b${token.replace(".", "\\.")}\\b`, "i");
    if (needle.test(lower)) {
      found.add(normalizeToken(token));
    }
  }
  return [...found];
}

function expectedFromPersona(): string[] {
  return tokensIn(`${DEMO_PERSONA.title} ${DEMO_PERSONA.summary}`);
}

function isRoleLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12 || trimmed.length > 140) {
    return false;
  }
  if (/^[•\-\u2022*]/.test(trimmed) || /@/.test(trimmed)) {
    return false;
  }
  if (/\|/.test(trimmed) && /(engineer|intern|full[- ]time|part[- ]time|software)/i.test(trimmed)) {
    return true;
  }
  return /^(software engineer|intern)\b/i.test(trimmed);
}

function isBulletLine(text: string): boolean {
  const trimmed = text.trim();
  if (/^[•\-\u2022*]/.test(trimmed)) {
    return true;
  }
  return /^(built|shipped|architected|engineered|implemented|redesigned|re-architected|scaled|migrated|added|rewrote|reverse-engineered|led|managed|mentored|headed|directed|coached|hired|staffed|supervised|oversaw)\b/i.test(
    trimmed,
  );
}

function isHeader(text: string): boolean {
  return (
    text.length < 42 &&
    /^(skills|experience|work experience|education|summary|projects|contact|languages|certifications|frameworks|databases)\b/i.test(
      text,
    )
  );
}

function isSkillsDump(text: string): boolean {
  if (/^(languages|frameworks|databases|payments|technologies)\b/i.test(text) && text.includes(",")) {
    return true;
  }
  return text.includes(",") && tokensIn(text).length >= 3;
}

export function analyzeDocument(lines: DocumentLine[]): DocumentAnalysis {
  const whole = lines.map((line) => line.text).join("\n");
  const leadership: LeadershipCount[] = LEADERSHIP_WORDS.map((word) => {
    const matches = whole.match(new RegExp(`\\b${word}\\b`, "gi"));
    return { word, count: matches?.length ?? 0 };
  }).filter((item) => item.count > 0);

  const jobs: JobBlock[] = [];
  let current: JobBlock | null = null;
  for (const line of lines) {
    if (isHeader(line.text) && /experience/i.test(line.text)) {
      current = null;
      continue;
    }
    if (isHeader(line.text) && !/experience/i.test(line.text)) {
      current = null;
      continue;
    }
    if (isRoleLine(line.text)) {
      current = { title: line.text, bullets: [] };
      jobs.push(current);
      continue;
    }
    if (current && isBulletLine(line.text) && !isSkillsDump(line.text)) {
      current.bullets.push(line);
    }
  }

  const listedSkills: string[] = [];
  const listedSeen = new Set<string>();
  const duplicateSkills: string[] = [];
  for (const line of lines) {
    if (!isSkillsDump(line.text) && !/^languages\b/i.test(line.text)) {
      continue;
    }
    const hits = tokensIn(line.text);
    for (const token of hits) {
      const pattern = token === "go" ? /\bgo\b/gi : new RegExp(`\\b${token.replace(".", "\\.")}\\b`, "gi");
      const count = line.text.match(pattern)?.length ?? 0;
      if (count >= 2 && !duplicateSkills.includes(token)) {
        duplicateSkills.push(token);
      }
      if (!listedSeen.has(token)) {
        listedSeen.add(token);
        listedSkills.push(token);
      }
    }
  }

  const inferredSkills = [...new Set(lines.filter((line) => !isSkillsDump(line.text)).flatMap((line) => tokensIn(line.text)))];
  const expectedSkills = expectedFromPersona();
  const unprovenSkills = listedSkills.filter((token) => !inferredSkills.includes(token));
  const missingExpected = expectedSkills.filter((token) => !listedSkills.includes(token) && !inferredSkills.includes(token));

  return {
    leadership,
    leadershipTotal: leadership.reduce((sum, item) => sum + item.count, 0),
    repeatedLeadership: leadership.filter((item) => item.count >= 3),
    jobs,
    denseJobs: jobs.filter((job) => job.bullets.length >= DENSE_BULLET_LIMIT),
    listedSkills,
    inferredSkills,
    expectedSkills,
    duplicateSkills,
    unprovenSkills,
    missingExpected,
  };
}

export function rewriteKindLabel(kind: RewriteKind): string {
  switch (kind) {
    case "split-block":
      return "Split this block";
    case "add-metric":
      return "Add a number";
    case "destaff":
      return "Name the teaching";
    case "destack-skills":
      return "Move skills into work";
    case "drop-bullet":
      return "Cut a bullet";
    case "rotate-verb":
      return "Rotate the verb";
    case "none":
      return "Keep";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

const REWRITE_PRIORITY: RewriteKind[] = [
  "destack-skills",
  "rotate-verb",
  "drop-bullet",
  "split-block",
  "destaff",
  "add-metric",
  "none",
];

export function overallRewrite(cards: SuggestionCard[]): RewriteKind {
  for (const kind of REWRITE_PRIORITY) {
    if (kind === "none") {
      return "none";
    }
    if (cards.some((card) => card.kind === kind)) {
      return kind;
    }
  }
  return "none";
}

export function rewriteLine(kind: RewriteKind): string {
  switch (kind) {
    case "split-block":
      return "Rewrite: split the long block.";
    case "add-metric":
      return "Rewrite: put a number on the unanchored lines.";
    case "destaff":
      return "Rewrite: name who you taught.";
    case "destack-skills":
      return "Rewrite: move listed skills next to the work.";
    case "drop-bullet":
      return "Rewrite: cut the extra bullets on the densest role.";
    case "rotate-verb":
      return "Rewrite: rotate the repeated leadership verb.";
    case "none":
      return "No rewrite from the page.";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function leadershipLine(analysis: DocumentAnalysis): string {
  if (analysis.leadershipTotal === 0) {
    return "No closed-set leadership verbs on the page.";
  }
  const noun = analysis.leadershipTotal === 1 ? "verb" : "verbs";
  const counts = analysis.leadership.map((item) => `${item.word} ×${item.count}`).join(", ");
  const repeat = analysis.repeatedLeadership[0];
  if (repeat) {
    return `${analysis.leadershipTotal} leadership ${noun} — ${counts}. “${repeat.word}” is the repeat; rotate later hits, do not invent adjectives.`;
  }
  return `${analysis.leadershipTotal} leadership ${noun} — ${counts}. No verb repeats three times.`;
}

export function jobsLine(analysis: DocumentAnalysis): string {
  const jobs = analysis.jobs.filter((job) => job.bullets.length > 0);
  if (jobs.length === 0) {
    return "No role blocks parsed.";
  }
  return jobs
    .map((job) => {
      const name = job.title.split("|")[0]?.trim() || "Role";
      const extra = job.bullets.length >= DENSE_BULLET_LIMIT ? "; cut some" : "";
      return `${name} ${job.bullets.length}${extra}`;
    })
    .join(" · ");
}

export function skillsLine(analysis: DocumentAnalysis): string {
  const parts = [
    `listed ${analysis.listedSkills.length || "none"}`,
    `inferred ${analysis.inferredSkills.length || "none"}`,
    `expected ${analysis.expectedSkills.join(", ") || "none"}`,
  ];
  if (analysis.duplicateSkills.length > 0) {
    parts.push(`repeat ${analysis.duplicateSkills.join(", ")}`);
  }
  if (analysis.unprovenSkills.length > 0) {
    parts.push(`unproven ${analysis.unprovenSkills.join(", ")}`);
  }
  if (analysis.missingExpected.length > 0) {
    parts.push(`missing ${analysis.missingExpected.join(", ")}`);
  }
  return parts.join(" · ");
}

function card(
  id: string,
  kind: RewriteKind,
  title: string,
  detail: string,
  line: DocumentLine | undefined,
  findingId?: string,
): SuggestionCard {
  return {
    id,
    kind,
    title,
    detail,
    quote: line?.text,
    findingId,
    box: line?.box ? padBox(line.box) : null,
  };
}

export function suggestionsFromAnalysis(lines: DocumentLine[], findings: OverlayFinding[]): SuggestionCard[] {
  const analysis = analyzeDocument(lines);
  const cards: SuggestionCard[] = [];
  const used = new Set<string>();

  function push(next: SuggestionCard) {
    if (used.has(next.id) || cards.length >= 10) {
      return;
    }
    used.add(next.id);
    cards.push(next);
  }

  for (const repeat of analysis.repeatedLeadership) {
    const line = lines.find((item) => new RegExp(`\\b${repeat.word}\\b`, "i").test(item.text));
    push(
      card(
        `rotate-${repeat.word}`,
        "rotate-verb",
        `“${repeat.word}” repeats ${repeat.count} times`,
        `Jev counted ${repeat.count} uses of “${repeat.word}”. Rotate later hits to “${ROTATE[repeat.word]}” — do not invent a new adjective.`,
        line,
      ),
    );
  }

  for (const job of analysis.denseJobs) {
    push(
      card(
        `drop-${job.title.slice(0, 24)}`,
        "drop-bullet",
        `${job.bullets.length} bullets on one role`,
        `“${job.title.split("|")[0]?.trim()}” has ${job.bullets.length} bullets. Keep the numbered ones; drop the rest.`,
        job.bullets[job.bullets.length - 1],
      ),
    );
  }

  if (analysis.duplicateSkills.length > 0) {
    const dump = lines.find((line) => isSkillsDump(line.text));
    push(
      card(
        "dup-skills",
        "destack-skills",
        "Skills list repeats a token",
        `Jev saw ${analysis.duplicateSkills.join(", ")} more than once in the dump. Keep one spelling.`,
        dump,
      ),
    );
  }

  if (analysis.unprovenSkills.length > 0) {
    const dump = lines.find((line) => isSkillsDump(line.text));
    push(
      card(
        "unproven-skills",
        "destack-skills",
        "Listed skills never appear in the work",
        `${analysis.unprovenSkills.join(", ")} sit in Skills but not in a role bullet. Put them next to the job, or drop them.`,
        dump,
      ),
    );
  }

  if (analysis.missingExpected.length > 0) {
    const experience = lines.find((line) => isHeader(line.text) && /experience/i.test(line.text));
    push(
      card(
        "missing-expected",
        "add-metric",
        "Persona tokens are absent",
        `${DEMO_PERSONA.title} expects ${analysis.missingExpected.join(", ")}. The page never uses them.`,
        experience,
      ),
    );
  }

  for (const finding of findings) {
    if (!finding.rewriteKind || finding.rewriteKind === "none") {
      continue;
    }
    push({
      id: `finding-${finding.id}`,
      kind: finding.rewriteKind,
      title: finding.title,
      detail: finding.detail,
      quote: finding.quote,
      findingId: finding.id,
      box: finding.box,
    });
  }

  return cards;
}

export function strongLine(lines: DocumentLine[]): string {
  const ranked = lines
    .filter((line) => line.text.length > 36)
    .map((line) => ({
      text: line.text,
      score: (/\d/.test(line.text) ? 2 : 0) + (/(built|shipped|scaled|cut |reduced)/i.test(line.text) ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score === 0) {
    return "No numbered proof line yet.";
  }
  return best.text.length > 88 ? `${best.text.slice(0, 88).trim()}…` : best.text;
}

export function weakLine(analysis: DocumentAnalysis, findings: OverlayFinding[]): string {
  if (analysis.repeatedLeadership[0]) {
    return `“${analysis.repeatedLeadership[0].word}” repeats ${analysis.repeatedLeadership[0].count} times.`;
  }
  if (analysis.denseJobs[0]) {
    return `${analysis.denseJobs[0].title.split("|")[0]?.trim()} is the densest role.`;
  }
  const missing = findings.find((item) => item.severity === "missing");
  if (missing) {
    return missing.title;
  }
  const risk = findings.find((item) => item.severity === "risk");
  if (risk) {
    return risk.title;
  }
  if (analysis.unprovenSkills.length > 0) {
    return `${analysis.unprovenSkills[0]} is listed and never proven.`;
  }
  return "The thin spot is still unanchored wording.";
}
