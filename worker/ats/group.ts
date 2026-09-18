import type { GroupedResume, ResumeFragment, ResumeSection, SectionKind } from "../../packages/jev/types.ts";

const HEADING_MAP: { pattern: RegExp; kind: SectionKind; heading: string }[] = [
  { pattern: /^(summary|profile|objective)\b/i, kind: "summary", heading: "Summary" },
  {
    pattern: /^(experience|work experience|employment|professional experience)\b/i,
    kind: "experience",
    heading: "Experience",
  },
  { pattern: /^(education|academics)\b/i, kind: "education", heading: "Education" },
  {
    pattern: /^(skills|technical skills|core competencies)\b/i,
    kind: "skills",
    heading: "Skills",
  },
  { pattern: /^(projects|selected projects)\b/i, kind: "projects", heading: "Projects" },
];

const BULLET = /^\s*[-*•–·]\s+/;

function classifyHeading(line: string): { kind: SectionKind; heading: string } | null {
  const trimmed = line.trim().replace(/:+$/, "");
  if (trimmed.length === 0 || trimmed.length > 48) {
    return null;
  }
  for (const entry of HEADING_MAP) {
    if (entry.pattern.test(trimmed)) {
      return { kind: entry.kind, heading: entry.heading };
    }
  }
  return null;
}

function fragmentKind(line: string): ResumeFragment["kind"] {
  if (BULLET.test(line)) {
    return "bullet";
  }
  return "paragraph";
}

function cleanLine(line: string): string {
  return line.replace(BULLET, "").trim();
}

export function groupResumeText(text: string): GroupedResume {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const textBody = normalized.trim();
  const lines = textBody.length === 0 ? [] : textBody.split("\n");
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  let sectionIndex = 0;
  let fragmentIndex = 0;

  const startSection = (heading: string, kind: SectionKind): ResumeSection => {
    sectionIndex += 1;
    const section: ResumeSection = {
      id: `s${sectionIndex}`,
      heading,
      kind,
      text: "",
      fragments: [],
      start: 0,
      end: 0,
      line: 1,
    };
    sections.push(section);
    return section;
  };

  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const start = offset;
    const end = offset + raw.length;
    const line = index + 1;
    offset = end + (index < lines.length - 1 ? 1 : 0);

    const heading = classifyHeading(raw);
    if (heading) {
      current = startSection(heading.heading, heading.kind);
      fragmentIndex = 0;
      current.fragments.push({
        id: `${current.id}-h`,
        text: heading.heading,
        kind: "heading",
        start,
        end,
        line,
      });
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    if (!current) {
      current = startSection("Overview", "other");
    }

    fragmentIndex += 1;
    const kind = fragmentKind(raw);
    current.fragments.push({
      id: `${current.id}-f${fragmentIndex}`,
      text: cleanLine(raw),
      kind,
      start,
      end,
      line,
    });
  }

  for (const section of sections) {
    section.text = section.fragments
      .filter((fragment) => fragment.kind !== "heading")
      .map((fragment) => fragment.text)
      .join("\n");
    if (section.fragments.length > 0) {
      section.start = Math.min(...section.fragments.map((fragment) => fragment.start));
      section.end = Math.max(...section.fragments.map((fragment) => fragment.end));
      section.line = section.fragments[0]?.line ?? 1;
    }
  }

  return { text: textBody, sections };
}

export function extractRequirementCandidates(jobDescription: string, limit = 24): string[] {
  const lines = jobDescription
    .replace(/\r\n/g, "\n")
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^\s*[-*•–·]\s+/, "").trim())
    .filter((line) => line.length >= 12);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(line);
    if (unique.length >= limit) {
      break;
    }
  }
  return unique;
}
