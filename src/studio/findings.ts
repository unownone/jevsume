import { clusterLines, isPlausibleBox, padBox, unionBoxes } from "./boxes.ts";
import {
  analyzeDocument,
  jobsLine,
  leadershipLine,
  overallRewrite,
  rewriteLine,
  skillsLine,
  strongLine,
  suggestionsFromAnalysis,
  weakLine,
} from "./analyze.ts";
import {
  hasJobTarget,
  jobTargetAsksMentorship,
  jobTargetLabel,
  jobTargetSeniority,
  resumeSeniority,
  seniorityMismatch,
  type JobTarget,
} from "../../shared/job-target.ts";
import type { DocumentLine, GlyphBox, OverlayFinding, PageBox, ScoreDimension, Severity, StudioScore } from "./types.ts";

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

function judge(line: DocumentLine, whole: string, target?: JobTarget): Omit<OverlayFinding, "id" | "origin" | "index"> | null {
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
    const wantsMentor = jobTargetAsksMentorship(target);
    return {
      severity: taught ? "works" : wantsMentor ? "missing" : "partial",
      title: taught ? "Mentorship is on the page" : wantsMentor ? "Staffing without teaching" : "Team size without teaching",
      detail: taught
        ? `“${clip(text, 70)}” names who grew. Keep it next to the team size.`
        : wantsMentor
          ? `“${clip(text, 70)}” names a team. ${jobTargetLabel(target)} wants someone who mentors seniors — say who, and what changed.`
          : `“${clip(text, 70)}” names a team. Say who you taught, or what changed because you led.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
      rewriteKind: taught ? "none" : "destaff",
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
      rewriteKind: "split-block",
      rewrite: clip(text, 110),
    };
  }

  if (/python|typescript|javascript|golang|\bgo\b|kafka|react|postgres|aws|docker/i.test(text) && text.includes(",")) {
    const lens = hasJobTarget(target)
      ? `${jobTargetLabel(target)} already named a few of these — put the rare ones next to the work.`
      : "Put the rare ones next to the work so a hiring lens can keep them.";
    return {
      severity: "partial",
      title: "Skills are a dump",
      detail: `“${clip(text, 70)}” is parseable and forgettable. ${lens}`,
      quote: text,
      needle: text.slice(0, 48),
      box,
      rewriteKind: "destack-skills",
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
      rewriteKind: severity === "works" ? "none" : "add-metric",
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

  if (!/mentor/i.test(whole) && /experience/i.test(text) && jobTargetAsksMentorship(target)) {
    return {
      severity: "missing",
      title: "Mentorship never appears",
      detail: `${jobTargetLabel(target)} asks for someone who mentors seniors. Nothing on the page says it.`,
      quote: text,
      needle: text.slice(0, 48),
      box,
    };
  }

  return null;
}

function personaGaps(
  lines: DocumentLine[],
  whole: string,
  usedY: Set<string>,
  target?: JobTarget,
): OverlayFinding[] {
  const extras: OverlayFinding[] = [];
  const experience = lines.find((line) => /experience/i.test(line.text) && line.text.length < 42) ?? lines[2];

  if (jobTargetAsksMentorship(target) && !/mentor|coached|mentees/i.test(whole) && experience?.box) {
    const key = `${experience.page}:${experience.box.y.toFixed(1)}:mentor`;
    if (!usedY.has(key)) {
      usedY.add(key);
      extras.push({
        id: "gap-mentor",
        origin: "jev",
        index: 0,
        severity: "missing",
        title: "Mentorship never appears",
        detail: `${jobTargetLabel(target)} asks for someone who mentors seniors. The page never says who you grew.`,
        quote: experience.text,
        needle: experience.text.slice(0, 48),
        box: padBox(experience.box),
        rewriteKind: "destaff",
        rewrite: "Mentored senior engineers on event-driven Go services already in production.",
      });
    }
  }

  if (hasJobTarget(target)) {
    const analysis = analyzeDocument(lines, target);
    if (analysis.missingExpected.length > 0) {
      const anchor =
        lines.find((line) => isHeaderish(line.text) && /skills/i.test(line.text)) ??
        experience ??
        lines[0];
      if (anchor?.box) {
        extras.push({
          id: "gap-keywords",
          origin: "jev",
          index: 0,
          severity: "missing",
          title: "Listing keywords are missing",
          detail: `${jobTargetLabel(target)} asks for ${analysis.missingExpected.join(", ")}. The page never uses them.`,
          quote: anchor.text,
          needle: anchor.text.slice(0, 48),
          box: padBox(anchor.box),
          rewriteKind: "add-metric",
        });
      }
    }

    const wanted = jobTargetSeniority(target);
    const found = resumeSeniority(whole);
    if (seniorityMismatch(wanted, found) && experience?.box) {
      extras.push({
        id: "gap-seniority",
        origin: "jev",
        index: 0,
        severity: "partial",
        title: "Seniority is below the listing",
        detail: `${jobTargetLabel(target)} reads as ${wanted}. The page reads as ${found}. Name the level you actually operated at.`,
        quote: experience.text,
        needle: experience.text.slice(0, 48),
        box: padBox(experience.box),
      });
    }

    for (const job of analysis.jobs) {
      const hay = `${job.title} ${job.bullets.map((bullet) => bullet.text).join(" ")}`.toLowerCase();
      const overlap = analysis.expectedSkills.filter((token) => hay.includes(token));
      if (analysis.expectedSkills.length >= 2 && overlap.length === 0 && job.bullets[0]?.box) {
        extras.push({
          id: `gap-role-${job.title.slice(0, 24)}`,
          origin: "jev",
          index: 0,
          severity: "partial",
          title: "This role is off-target",
          detail: `“${job.title.split("|")[0]?.trim()}” never names what ${jobTargetLabel(target)} asked for (${analysis.expectedSkills.slice(0, 4).join(", ")}).`,
          quote: job.bullets[0].text,
          needle: job.bullets[0].text.slice(0, 48),
          box: padBox(job.bullets[0].box),
        });
      }
    }
  }

  return extras;
}

function isHeaderish(text: string): boolean {
  return (
    text.length < 42 &&
    /^(skills|experience|work experience|education|summary|projects|contact|languages|certifications|frameworks|databases)\b/i.test(
      text,
    )
  );
}

function numberFindings(findings: OverlayFinding[]): OverlayFinding[] {
  return findings
    .sort((left, right) => {
      const page = (left.box?.page ?? 0) - (right.box?.page ?? 0);
      if (page !== 0) {
        return page;
      }
      const top = (left.box?.y ?? 0) - (right.box?.y ?? 0);
      if (top !== 0) {
        return top;
      }
      return (left.box?.x ?? 0) - (right.box?.x ?? 0);
    })
    .map((finding, index) => ({ ...finding, index: index + 1, id: `jev-${index + 1}` }));
}

function spreadCap(findings: OverlayFinding[], cap: number): OverlayFinding[] {
  if (findings.length <= cap) {
    return findings;
  }
  const head = Math.ceil(cap / 2);
  const tail = cap - head;
  return [...findings.slice(0, head), ...findings.slice(findings.length - tail)];
}

export function findingsFromGlyphs(glyphs: GlyphBox[], target?: JobTarget): OverlayFinding[] {
  return reviewFromGlyphs(glyphs, target).findings;
}

function clamp4(value: number): number {
  return Math.min(4, Math.max(0.4, value));
}

function verdictFor(dimensions: ScoreDimension[], findings: OverlayFinding[], target?: JobTarget): string {
  const missingKeywords = findings.some((item) => item.id.includes("keyword") || /listing keywords/i.test(item.title));
  const missingMentor = findings.some((item) => item.severity === "missing" && /mentor/i.test(item.detail));
  const weakest = dimensions.reduce((left, right) => (left.score <= right.score ? left : right));
  const metrics = dimensions.find((item) => item.id === "metrics");
  if (hasJobTarget(target) && missingKeywords) {
    return `${jobTargetLabel(target)} is the lens. Missing listing keywords are the first cut.`;
  }
  if (missingMentor) {
    return hasJobTarget(target)
      ? `Metrics land. Mentorship never appears — ${jobTargetLabel(target)} will notice.`
      : "Metrics land. Mentorship never appears on this page.";
  }
  if (weakest.id === "conciseness") {
    return "The parser can read it. Several blocks will flatten on the way through.";
  }
  if ((metrics?.score ?? 0) >= 3) {
    return hasJobTarget(target)
      ? `Numbers do the work. Tighten the lines that still miss ${jobTargetLabel(target)}.`
      : "Numbers do the work. Tighten the lines that still sell a vibe.";
  }
  return `${weakest.label} is the thin spot on this page.`;
}

export function scoreFromDocument(lines: DocumentLine[], findings: OverlayFinding[], target?: JobTarget): StudioScore {
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
  let value = Math.round(
    ((wording * 0.2 + conciseness * 0.15 + structure * 0.2 + metrics * 0.25 + ats * 0.2) / 4) * 100,
  );
  const analysis = analyzeDocument(lines, target);
  if (hasJobTarget(target) && analysis.expectedSkills.length > 0) {
    const hit = analysis.expectedSkills.length - analysis.missingExpected.length;
    const fit = hit / analysis.expectedSkills.length;
    value = Math.max(0, Math.min(100, Math.round(value * 0.75 + fit * 25)));
  }
  const validity = Math.round(((structure + ats) / 8) * 100);
  const evidenced = bullets.filter((line) => hasMetric(line.text) || /kafka|\bgo\b|postgres|redis|aws/i.test(line.text)).length;
  const evidence = Math.round((evidenced / pool) * 100);
  const suggestions = suggestionsFromAnalysis(lines, findings, target);
  const rewrite = overallRewrite(suggestions);
  const targeted = hasJobTarget(target);
  const targetFit = targeted
    ? analysis.expectedSkills.length > 0
      ? `${analysis.expectedSkills.length - analysis.missingExpected.length} of ${analysis.expectedSkills.length} listing skills on the page`
      : "Rated against this listing — no closed-set skills extracted"
    : undefined;
  return {
    value,
    verdict: verdictFor(dimensions, findings, target),
    noteCount: findings.length,
    validity,
    evidence,
    leadershipLine: leadershipLine(analysis),
    jobsLine: jobsLine(analysis),
    skillsLine: skillsLine(analysis),
    rewriteLine: rewriteLine(rewrite),
    rewrite,
    strong: strongLine(lines),
    weak: weakLine(analysis, findings),
    dimensions,
    suggestions,
    targetLabel: targeted ? jobTargetLabel(target) : undefined,
    targetFit,
  };
}

export function scoreFromFindings(findings: OverlayFinding[]): StudioScore {
  return scoreFromDocument([], findings);
}

const WAITING_LEADERSHIP = "Waiting on section scores.";
const WAITING_JOBS = "Roles appear as they score.";
const WAITING_SKILLS = "Skills score after the dump is judged.";
const WAITING_REWRITE = "Suggestions arrive with recover points.";
const WAITING_VERDICT = "Jev is scoring each section.";

function walkScoreNodes(nodes: StudioScore["hierarchy"] | undefined): NonNullable<StudioScore["hierarchy"]> {
  const out: NonNullable<StudioScore["hierarchy"]> = [];
  const visit = (node: NonNullable<StudioScore["hierarchy"]>[number]) => {
    out.push(node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const node of nodes ?? []) {
    visit(node);
  }
  return out;
}

export function fillWaitingJudgeLines(score: StudioScore): StudioScore {
  const nodes = walkScoreNodes(score.hierarchy);
  const scoredJobs = nodes.filter((node) => node.kind === "job" && node.status === "scored");
  const skills = nodes.find((node) => node.kind === "skills");
  const verbDims = scoredJobs.flatMap((node) =>
    (node.dimensions ?? []).filter((dim) => /action verbs/i.test(dim.label)),
  );

  let { leadershipLine, jobsLine, skillsLine, rewriteLine } = score;

  if (leadershipLine === WAITING_LEADERSHIP && verbDims.length > 0) {
    const avg = verbDims.reduce((sum, dim) => sum + dim.score, 0) / verbDims.length;
    const thin = verbDims.filter((dim) => dim.max > 0 && dim.score / dim.max < 0.75).length;
    leadershipLine = `Action verbs ${avg.toFixed(1)} / 4 across ${verbDims.length} scored role${
      verbDims.length === 1 ? "" : "s"
    }${thin > 0 ? ` · ${thin} still thin` : ""}.`;
  }

  if (jobsLine === WAITING_JOBS && scoredJobs.length > 0) {
    jobsLine = scoredJobs
      .map((job) => `${job.title} ${Math.round(job.contribution ?? 0)}/${job.weight ?? 0}`)
      .join(" · ");
  }

  if (skillsLine === WAITING_SKILLS && skills?.status === "scored") {
    const dims = skills.dimensions ?? [];
    const dump = dims.find((dim) => /dump/i.test(dim.label));
    const proven = dims.find((dim) => /proven/i.test(dim.label));
    const bits = [`${Math.round(skills.contribution ?? 0)} / ${skills.weight ?? 0}`];
    if (dump) {
      bits.push(`${dump.label} ${dump.score.toFixed(1)}/${dump.max}`);
    }
    if (proven) {
      bits.push(`${proven.label} ${proven.score.toFixed(1)}/${proven.max}`);
    }
    skillsLine = bits.join(" · ");
  }

  const recover = (score.suggestions ?? []).reduce((sum, card) => sum + (card.recoverPoints ?? 0), 0);
  if (rewriteLine === WAITING_REWRITE && score.suggestions.length > 0) {
    rewriteLine = `${score.suggestions.length} suggestion${score.suggestions.length === 1 ? "" : "s"} · recover ${recover} point${
      recover === 1 ? "" : "s"
    }.`;
  }

  return { ...score, leadershipLine, jobsLine, skillsLine, rewriteLine };
}

export function decorateStudioScore(
  score: StudioScore,
  lines: DocumentLine[],
  findings: OverlayFinding[],
  target?: JobTarget,
): StudioScore {
  let next = fillWaitingJudgeLines(score);
  if (lines.length === 0) {
    return next;
  }
  const fromPage = scoreFromDocument(lines, findings, target);
  const rewrite = next.suggestions.length > 0 ? overallRewrite(next.suggestions) : fromPage.rewrite;
  return {
    ...next,
    verdict: next.verdict === WAITING_VERDICT ? fromPage.verdict : next.verdict,
    leadershipLine:
      next.leadershipLine === WAITING_LEADERSHIP ? fromPage.leadershipLine : next.leadershipLine,
    jobsLine: next.jobsLine === WAITING_JOBS ? fromPage.jobsLine : next.jobsLine,
    skillsLine: next.skillsLine === WAITING_SKILLS ? fromPage.skillsLine : next.skillsLine,
    rewriteLine: next.rewriteLine === WAITING_REWRITE ? rewriteLine(rewrite) : next.rewriteLine,
    rewrite,
    strong: next.strong === "—" ? fromPage.strong : next.strong,
    weak: next.weak === "—" ? fromPage.weak : next.weak,
    targetFit: next.targetFit ?? fromPage.targetFit,
  };
}

export function reviewFromGlyphs(glyphs: GlyphBox[], target?: JobTarget): { findings: OverlayFinding[]; score: StudioScore } {
  const lines = linesFromGlyphs(glyphs);
  const whole = lines.map((line) => line.text).join("\n");
  const usedY = new Set<string>();
  const findings: OverlayFinding[] = [];

  const ordered = [...lines].sort((left, right) => left.page - right.page || left.box.y - right.box.y);

  for (const line of ordered) {
    const key = `${line.page}:${line.box.y.toFixed(1)}`;
    if (usedY.has(key)) {
      continue;
    }
    const judged = judge(line, whole, target);
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

  for (const extra of personaGaps(lines, whole, usedY, target)) {
    const isMentor = /mentor/i.test(`${extra.title} ${extra.detail}`);
    if (isMentor && findings.some((item) => /mentor/i.test(`${item.title} ${item.detail}`))) {
      continue;
    }
    findings.push(extra);
  }

  const numbered = numberFindings(spreadCap(findings, FINDING_CAP));
  return {
    findings: numbered,
    score: scoreFromDocument(lines, numbered, target),
  };
}
