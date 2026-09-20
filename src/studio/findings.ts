import { clusterLines, isPlausibleBox, padBox, unionBoxes } from "./boxes.ts";
import { DEMO_PERSONA } from "./demo.ts";
import type { GlyphBox, OverlayFinding, PageBox, ScoreDimension, Severity, StudioScore } from "./types.ts";

export type DocumentLine = {
  page: number;
  text: string;
  box: NonNullable<ReturnType<typeof unionBoxes>>;
};

const FINDING_CAP = 28;

export function linesFromGlyphs(glyphs: GlyphBox[]): DocumentLine[] {
  return clusterLines(glyphs)
    .map((items) => {
      const box = unionBoxes(items);
      return {
        page: items[0]?.page ?? 1,
        text: items
          .map((item) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        box,
      };
    })
    .filter((line): line is DocumentLine => Boolean(line.text.length > 0 && line.box && isPlausibleBox(line.box)));
}

function clip(text: string, max = 88): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max).trim()}…`;
}

function hasMetric(text: string): boolean {
  return /\d+(\.\d+)?%|\$\d|\b\d{1,3}(,\d{3})+\b|\b\d+\s?(k|m|ms|hrs?|minutes?|sec|rps)\b|\b\d{2,}\+?\b/i.test(
    text,
  );
}

function looksLikeHeader(text: string): boolean {
  return (
    text.length < 42 &&
    /^(skills|experience|work experience|education|summary|projects|contact|languages|certifications|frameworks|databases)\b/i.test(
      text,
    )
  );
}

function isNoise(text: string): boolean {
  if (text.length < 6) {
    return true;
  }
  if (/@/.test(text) && text.length < 88) {
    return true;
  }
  if (/https?:\/\//i.test(text)) {
    return true;
  }
  if (/^\+?\d[\d\s().-]{8,}$/.test(text)) {
    return true;
  }
  return false;
}

function hasVerb(text: string): boolean {
  return /built|shipped|designed|scaled|reduced|cut |architected|engineered|implemented|redesigned|reverse-engineered/i.test(
    text,
  );
}

function boxed(line: DocumentLine): PageBox | null {
  return padBox(line.box);
}

function judge(line: DocumentLine, whole: string): Omit<OverlayFinding, "id" | "origin" | "index"> | null {
  const text = line.text;
  const box = boxed(line);
  if (!box || isNoise(text)) {
    return null;
  }

  if (looksLikeHeader(text)) {
    return {
      severity: "works",
      title: "Parser found a heading",
      detail: `“${text}” is a clean section break. An ATS will keep it; don’t bury the next lines under it.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  if (/led |mentor|managed |hired |staffed /i.test(text)) {
    const taught = /mentor|coached|mentees|grew engineers/i.test(text);
    return {
      severity: taught ? "works" : "missing",
      title: taught ? "Mentorship is on the page" : "Staffing without teaching",
      detail: taught
        ? `“${clip(text, 70)}” names who grew. Keep it next to the team size.`
        : `“${clip(text, 70)}” names a team. ${DEMO_PERSONA.title} wants someone who mentors seniors — say who, and what changed.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
      rewrite: taught ? undefined : "Mentored 2 senior engineers on the Shopware pipeline; both shipped unattended after a quarter.",
    };
  }

  if (hasMetric(text) && text.length > 24) {
    return {
      severity: "works",
      title: "This line carries a number",
      detail: `Jev kept “${clip(text, 64)}”. Volume, percent, or money is what both a parser and a hiring lens hold onto.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  if (text.length > 140) {
    return {
      severity: "risk",
      title: "This block will flatten",
      detail: `This run is ${text.length} characters with no break. A parser concatenates it; a recruiter skims past it. Split the claim from the proof.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
      rewrite: clip(text, 110),
    };
  }

  if (/python|typescript|javascript|golang|\bgo\b|kafka|react|postgres|aws|docker/i.test(text) && text.includes(",")) {
    return {
      severity: "partial",
      title: "Skills are a dump",
      detail: `“${clip(text, 70)}” is parseable and forgettable. ${DEMO_PERSONA.title} already asked for a few of these — put the rare ones next to the work.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  if (text.length > 36 && text.length <= 140) {
    const severity: Severity = hasVerb(text) ? "works" : "partial";
    return {
      severity,
      title: severity === "works" ? "A verb a parser can use" : "Specific, but unanchored",
      detail:
        severity === "works"
          ? `“${clip(text, 70)}” leads with an action. Keep the number on the same line.`
          : `“${clip(text, 70)}” reads, but it doesn’t say at what scale. Add one metric or one named system.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  if (line.box.y < 10 && text.length > 4 && !/@/.test(text) && !looksLikeHeader(text)) {
    return {
      severity: "works",
      title: "Name is on the page",
      detail: `“${text}” sits where a parser expects a candidate name. Don’t hide it in a header image.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  if (!/mentor/i.test(whole) && /experience/i.test(text)) {
    return {
      severity: "missing",
      title: "Mentorship never appears",
      detail: `${DEMO_PERSONA.title} asks for someone who mentors seniors. Nothing on the page says it.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  return null;
}

function personaGaps(lines: DocumentLine[], whole: string, usedY: Set<string>): OverlayFinding[] {
  const extras: OverlayFinding[] = [];
  const experience = lines.find((line) => /experience/i.test(line.text) && line.text.length < 42) ?? lines[2];
  if (!/mentor|coached|mentees/i.test(whole) && experience?.box) {
    const key = `${experience.page}:${experience.box.y.toFixed(1)}:mentor`;
    if (!usedY.has(key)) {
      usedY.add(key);
      extras.push({
        id: "gap-mentor",
        origin: "jev",
        index: 0,
        severity: "missing",
        title: "Mentorship never appears",
        detail: `${DEMO_PERSONA.title} asks for someone who mentors seniors. The page never says who you grew.`,
        quote: experience.text,
        needle: experience.text.slice(0, 48),
        box: padBox(experience.box),
        rewrite: "Mentored senior engineers on event-driven Go services already in production.",
      });
    }
  }
  return extras;
}

function numberFindings(findings: OverlayFinding[]): OverlayFinding[] {
  return findings
    .sort((left, right) => {
      const top = (left.box?.y ?? 0) - (right.box?.y ?? 0);
      if (top !== 0) {
        return top;
      }
      return (left.box?.x ?? 0) - (right.box?.x ?? 0);
    })
    .map((finding, index) => ({ ...finding, index: index + 1, id: `jev-${index + 1}` }));
}

export function findingsFromGlyphs(glyphs: GlyphBox[]): OverlayFinding[] {
  return reviewFromGlyphs(glyphs).findings;
}

function clamp4(value: number): number {
  return Math.min(4, Math.max(0.4, value));
}

function verdictFor(dimensions: ScoreDimension[], findings: OverlayFinding[]): string {
  const missingMentor = findings.some((item) => item.severity === "missing" && /mentor/i.test(item.detail));
  const weakest = dimensions.reduce((left, right) => (left.score <= right.score ? left : right));
  const metrics = dimensions.find((item) => item.id === "metrics");
  if (missingMentor) {
    return "Metrics land. Mentorship never appears — this persona will notice.";
  }
  if (weakest.id === "conciseness") {
    return "The parser can read it. Several blocks will flatten on the way through.";
  }
  if ((metrics?.score ?? 0) >= 3) {
    return "Numbers do the work. Tighten the lines that still sell a vibe.";
  }
  return `${weakest.label} is the thin spot on this page.`;
}

export function scoreFromDocument(lines: DocumentLine[], findings: OverlayFinding[]): StudioScore {
  const bullets = lines.filter((line) => line.text.length > 36);
  const pool = Math.max(1, bullets.length);
  const risks = findings.filter((item) => item.severity === "risk").length;
  const missing = findings.filter((item) => item.severity === "missing").length;
  const headers = lines.filter((line) => looksLikeHeader(line.text)).length;
  const wording = clamp4((bullets.filter((line) => hasVerb(line.text)).length / pool) * 4);
  const conciseness = clamp4(4 - risks * 0.7);
  const structure = clamp4(1.4 + headers * 0.5 - missing * 0.45);
  const metrics = clamp4((bullets.filter((line) => hasMetric(line.text)).length / pool) * 4);
  const ats = clamp4(3.2 - risks * 0.55 + (headers > 1 ? 0.5 : 0) - missing * 0.2);
  const dimensions: ScoreDimension[] = [
    { id: "wording", label: "Wording", score: wording, max: 4 },
    { id: "conciseness", label: "Conciseness", score: conciseness, max: 4 },
    { id: "structure", label: "Structure", score: structure, max: 4 },
    { id: "metrics", label: "Metrics", score: metrics, max: 4 },
    { id: "ats", label: "ATS parse", score: ats, max: 4 },
  ];
  const value = Math.round(
    ((wording * 0.2 + conciseness * 0.15 + structure * 0.2 + metrics * 0.25 + ats * 0.2) / 4) * 100,
  );
  return {
    value,
    verdict: verdictFor(dimensions, findings),
    noteCount: findings.length,
    dimensions,
  };
}

export function scoreFromFindings(findings: OverlayFinding[]): StudioScore {
  return scoreFromDocument([], findings);
}

export function reviewFromGlyphs(glyphs: GlyphBox[]): { findings: OverlayFinding[]; score: StudioScore } {
  const lines = linesFromGlyphs(glyphs);
  const whole = lines.map((line) => line.text).join("\n");
  const usedY = new Set<string>();
  const findings: OverlayFinding[] = [];

  const ordered = [...lines].sort((left, right) => left.page - right.page || left.box.y - right.box.y);

  for (const line of ordered) {
    if (findings.length >= FINDING_CAP) {
      break;
    }
    const key = `${line.page}:${line.box.y.toFixed(1)}`;
    if (usedY.has(key)) {
      continue;
    }
    const judged = judge(line, whole);
    if (!judged?.box) {
      continue;
    }
    usedY.add(key);
    findings.push({
      ...judged,
      id: `jev-${findings.length + 1}`,
      origin: "jev",
      index: findings.length + 1,
    });
  }

  if (findings.length < FINDING_CAP) {
    for (const extra of personaGaps(lines, whole, usedY)) {
      if (findings.length >= FINDING_CAP) {
        break;
      }
      const already = findings.some((item) => /mentor/i.test(`${item.title} ${item.detail}`));
      if (already) {
        continue;
      }
      findings.push(extra);
    }
  }

  const numbered = numberFindings(findings);
  return {
    findings: numbered,
    score: scoreFromDocument(lines, numbered),
  };
}
