export const SKILL_PROFICIENCIES = ["unspecified", "familiar", "working", "proficient", "expert"] as const;
export type SkillProficiency = (typeof SKILL_PROFICIENCIES)[number];

export type JobSkillExpectation = "expected" | "good_to_have";

export type JobSkill = {
  id: string;
  name: string;
  expectation: JobSkillExpectation;
  proficiency: SkillProficiency;
};

/** Parsed listing, stored on the persona. */
export type JobDescriptionSections = {
  expected: string[];
  goodToHave: string[];
  skills: JobSkill[];
};

export type SkillAlignment = "aligned" | "partial" | "missing";
export type SkillEvidenceSource = "resume_line" | "other_experience" | "listed_only" | "absent";

export type ComparedSkill = {
  id: string;
  name: string;
  expectation: JobSkillExpectation;
  expectedProficiency: SkillProficiency;
  shownProficiency: SkillProficiency;
  alignment: SkillAlignment;
  source: SkillEvidenceSource;
  resumeLine?: string;
};

/** Comparison of one resume against stored job sections. */
export type JobComparison = {
  expected: string[];
  goodToHave: string[];
  skillAlignment: ComparedSkill[];
  skillProficiency: ComparedSkill[];
  skillsValidated: ComparedSkill[];
  otherExperiences: ComparedSkill[];
  missingSkills: string[];
  availableSkills: string[];
  skillGap: ComparedSkill[];
};

const EMPTY_SECTIONS: JobDescriptionSections = { expected: [], goodToHave: [], skills: [] };

const GOOD_HEADING = /nice to have|good to have|preferred|bonus|plus|optional/i;
const EXPECTED_HEADING = /requirement|qualification|must|what you.?ll|you have|expected|responsibilit/i;
const GOOD_LINE = /\b(preferred|nice to have|bonus|a plus|optional)\b/i;
const PROFICIENCY_RANK: Record<SkillProficiency, number> = {
  unspecified: 0,
  familiar: 1,
  working: 2,
  proficient: 3,
  expert: 4,
};

export function emptyJobSections(): JobDescriptionSections {
  return { expected: [], goodToHave: [], skills: [] };
}

export function isJobDescriptionSections(value: unknown): value is JobDescriptionSections {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<JobDescriptionSections>;
  return Array.isArray(record.expected) && Array.isArray(record.goodToHave) && Array.isArray(record.skills);
}

export function parseStoredSections(raw: string | null | undefined): JobDescriptionSections {
  if (!raw) {
    return emptyJobSections();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isJobDescriptionSections(parsed) ? parsed : emptyJobSections();
  } catch {
    return emptyJobSections();
  }
}

function cleanLine(line: string): string {
  return line.replace(/^\s*[-*•–·]\s+/, "").replace(/\s+/g, " ").trim();
}

function headingBucket(line: string): JobSkillExpectation | null {
  const trimmed = line.replace(/:+$/, "").trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return null;
  }
  if (GOOD_HEADING.test(trimmed) && !/[.!?].{12,}/.test(trimmed)) {
    return "good_to_have";
  }
  if (EXPECTED_HEADING.test(trimmed) && !/[.!?].{12,}/.test(trimmed)) {
    return "expected";
  }
  return null;
}

function proficiencyFrom(text: string): SkillProficiency {
  const years = text.match(/(\d+)\+?\s*(?:years|yrs)/i);
  if (years) {
    const count = Number(years[1]);
    if (count >= 8) return "expert";
    if (count >= 5) return "proficient";
    if (count >= 3) return "working";
    if (count >= 1) return "familiar";
  }
  if (/\b(expert|mastery|deep expertise)\b/i.test(text)) return "expert";
  if (/\b(proficient|advanced|strong)\b/i.test(text)) return "proficient";
  if (/\b(working knowledge|hands-on|production)\b/i.test(text)) return "working";
  if (/\b(familiar|exposure|knowledge of)\b/i.test(text)) return "familiar";
  return "unspecified";
}

function skillNamesFrom(line: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const name = raw.replace(/[().]/g, "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 40) return;
    if (/^(and|or|with|the|a|an|of|in|to|for|our|you|your)$/i.test(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  };

  const list = line.match(
    /(?:experience (?:with|in)|proficien(?:t|cy) (?:in|with)|knowledge of|familiar with|skills?:)\s+([^.;]+)/i,
  );
  if (list?.[1]) {
    for (const part of list[1].split(/,|\/|\band\b|\bor\b/i)) {
      push(part);
    }
  }

  for (const match of line.matchAll(/\b([A-Z][A-Za-z0-9+.#]{1,24}(?:\s+[A-Z][A-Za-z0-9+.#]{1,24})?)\b/g)) {
    const token = match[1] ?? "";
    if (/^(The|And|With|Our|You|Your|This|What|Must|Nice|Good|Preferred)$/.test(token)) continue;
    push(token);
  }

  for (const match of line.matchAll(
    /\b(typescript|javascript|python|golang|kubernetes|postgres|postgresql|kafka|react|aws|gcp|azure|sql|graphql|docker|redis|java|rust|swift|kotlin)\b/gi,
  )) {
    push(match[1] ?? "");
  }
  return names;
}

export function parseJobDescriptionSections(jobDescription: string): JobDescriptionSections {
  const lines = jobDescription.replace(/\r\n/g, "\n").split("\n");
  const expected: string[] = [];
  const goodToHave: string[] = [];
  const skills: JobSkill[] = [];
  const seenSkills = new Set<string>();
  let bucket: JobSkillExpectation = "expected";

  const pushLine = (text: string, expectation: JobSkillExpectation) => {
    const target = expectation === "good_to_have" ? goodToHave : expected;
    if (target.some((item) => item.toLowerCase() === text.toLowerCase())) return;
    target.push(text);
    for (const name of skillNamesFrom(text)) {
      const key = name.toLowerCase();
      if (seenSkills.has(key)) continue;
      seenSkills.add(key);
      skills.push({
        id: `sk${skills.length + 1}`,
        name,
        expectation,
        proficiency: proficiencyFrom(text),
      });
    }
  };

  for (const raw of lines) {
    const text = cleanLine(raw);
    if (!text) continue;
    const heading = headingBucket(text);
    if (heading && text.length < 48 && !text.includes(".")) {
      bucket = heading;
      continue;
    }
    if (text.length < 8) continue;
    const expectation = GOOD_LINE.test(text) ? "good_to_have" : bucket;
    pushLine(text, expectation);
  }

  return { expected, goodToHave, skills };
}

type RequirementSlice = {
  text: string;
  category: string;
};

type ResumeSlice = {
  text: string;
  sections: Array<{
    kind: string;
    text: string;
    fragments: Array<{ kind: string; text: string }>;
  }>;
};

export function sectionsFromRequirements(
  jobDescription: string,
  requirements: RequirementSlice[],
): JobDescriptionSections {
  const parsed = parseJobDescriptionSections(jobDescription);
  if (requirements.length === 0) return parsed;

  const expected: string[] = [];
  const goodToHave: string[] = [];
  for (const requirement of requirements) {
    if (requirement.category === "nice_to_have") {
      goodToHave.push(requirement.text);
    } else if (requirement.category === "must_have" || requirement.category === "responsibility") {
      expected.push(requirement.text);
    }
  }
  const base = expected.length + goodToHave.length > 0 ? { ...parsed, expected, goodToHave } : parsed;
  if (base.skills.length > 0) return base;
  return parseJobDescriptionSections([...base.expected, ...base.goodToHave].join("\n"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(haystack: string, skill: string): boolean {
  const pattern = new RegExp(`(?:^|[^a-z0-9+#])${escapeRegExp(skill.toLowerCase())}(?:$|[^a-z0-9+#])`, "i");
  return pattern.test(haystack.toLowerCase());
}

type ResumeHit = { line: string; source: Exclude<SkillEvidenceSource, "absent"> };

function findHit(resume: ResumeSlice, skill: string): ResumeHit | null {
  const order: Array<{ kind: string; source: ResumeHit["source"] }> = [
    { kind: "job", source: "resume_line" },
    { kind: "experience", source: "resume_line" },
    { kind: "projects", source: "resume_line" },
    { kind: "skills", source: "listed_only" },
    { kind: "summary", source: "other_experience" },
    { kind: "accolades", source: "other_experience" },
    { kind: "education", source: "other_experience" },
    { kind: "other", source: "other_experience" },
    { kind: "header", source: "other_experience" },
  ];
  for (const bucket of order) {
    for (const section of resume.sections) {
      if (section.kind !== bucket.kind) continue;
      for (const fragment of section.fragments) {
        if (fragment.kind === "heading") continue;
        if (mentions(fragment.text, skill)) {
          return { line: fragment.text, source: bucket.source };
        }
      }
      if (mentions(section.text, skill)) {
        const line = section.text.split("\n").find((item) => mentions(item, skill)) ?? section.text;
        return { line, source: bucket.source };
      }
    }
  }
  if (mentions(resume.text, skill)) {
    const line = resume.text.split("\n").find((item) => mentions(item, skill));
    return line ? { line: line.trim(), source: "other_experience" } : null;
  }
  return null;
}

function shownProficiency(line: string | undefined, source: SkillEvidenceSource): SkillProficiency {
  if (!line || source === "absent") return "unspecified";
  const fromLine = proficiencyFrom(line);
  if (fromLine !== "unspecified") return fromLine;
  if (source === "resume_line") return "working";
  if (source === "listed_only") return "familiar";
  return "familiar";
}

function alignmentFor(
  source: SkillEvidenceSource,
  expected: SkillProficiency,
  shown: SkillProficiency,
): SkillAlignment {
  if (source === "absent") return "missing";
  if (source === "listed_only") return "partial";
  if (expected === "unspecified") return "aligned";
  const gap = PROFICIENCY_RANK[expected] - PROFICIENCY_RANK[shown];
  if (gap <= 0) return "aligned";
  if (gap === 1) return "partial";
  return "partial";
}

export function availableSkillsFromResume(resume: ResumeSlice): string[] {
  const skills = resume.sections.filter((section) => section.kind === "skills");
  const names: string[] = [];
  const seen = new Set<string>();
  const source = skills.length > 0 ? skills.map((section) => section.text).join("\n") : resume.text;
  for (const name of skillNamesFrom(source)) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function compareResumeToJob(resume: ResumeSlice, sections: JobDescriptionSections): JobComparison {
  const compared: ComparedSkill[] = sections.skills.map((skill) => {
    const hit = findHit(resume, skill.name);
    const source: SkillEvidenceSource = hit?.source ?? "absent";
    const shown = shownProficiency(hit?.line, source);
    const item: ComparedSkill = {
      id: skill.id,
      name: skill.name,
      expectation: skill.expectation,
      expectedProficiency: skill.proficiency,
      shownProficiency: shown,
      alignment: alignmentFor(source, skill.proficiency, shown),
      source,
    };
    if (hit?.line) item.resumeLine = hit.line;
    return item;
  });

  const skillGap = compared.filter(
    (skill) =>
      skill.expectation === "expected" &&
      (skill.alignment === "missing" ||
        (skill.expectedProficiency !== "unspecified" &&
          PROFICIENCY_RANK[skill.shownProficiency] < PROFICIENCY_RANK[skill.expectedProficiency])),
  );

  return {
    expected: sections.expected,
    goodToHave: sections.goodToHave,
    skillAlignment: compared.filter((skill) => skill.alignment !== "missing"),
    skillProficiency: compared,
    skillsValidated: compared.filter((skill) => skill.source === "resume_line"),
    otherExperiences: compared.filter((skill) => skill.source === "other_experience"),
    missingSkills: compared.filter((skill) => skill.alignment === "missing").map((skill) => skill.name),
    availableSkills: availableSkillsFromResume(resume),
    skillGap,
  };
}

export function jobMatchScoreValue(comparison: JobComparison): number {
  const expected = comparison.skillProficiency.filter((skill) => skill.expectation === "expected");
  const pool = expected.length > 0 ? expected : comparison.skillProficiency;
  if (pool.length === 0) {
    const lines = comparison.expected.length;
    return lines > 0 ? 0 : 0;
  }
  const covered = pool.reduce((sum, skill) => {
    if (skill.alignment === "aligned") return sum + 1;
    if (skill.alignment === "partial") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((covered / pool.length) * 100);
}

export function sectionsOrEmpty(sections: JobDescriptionSections | undefined): JobDescriptionSections {
  return sections ?? EMPTY_SECTIONS;
}
