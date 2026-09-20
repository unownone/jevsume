export type Severity = "works" | "partial" | "missing" | "risk";

export type Scene = "empty" | "loaded" | "reviewed";

export type PageBox = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GlyphBox = PageBox & {
  str: string;
};

export type OverlayFinding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  rewrite?: string;
  rewriteKind?: RewriteKind;
  quote?: string;
  needle: string;
  box: PageBox | null;
  origin: "jev" | "you";
  index: number;
};

export type ChatMessage = {
  id: string;
  from: "jev" | "you";
  text: string;
};

export type ScoreDimension = {
  id: string;
  label: string;
  score: number;
  max: number;
};

export type StudioScore = {
  value: number;
  verdict: string;
  noteCount: number;
  /** Parser/ATS readability. Not a claim that the resume is true. */
  validity: number;
  /** Share of bullets with a number or a named system. Honesty is not proctorable. */
  evidence: number;
  leadershipLine: string;
  jobsLine: string;
  skillsLine: string;
  rewriteLine: string;
  rewrite: RewriteKind;
  strong: string;
  weak: string;
  dimensions: ScoreDimension[];
  suggestions: SuggestionCard[];
};

export type PageMetrics = {
  page: number;
  width: number;
  height: number;
};

export type RewriteKind =
  | "split-block"
  | "add-metric"
  | "destaff"
  | "destack-skills"
  | "drop-bullet"
  | "rotate-verb"
  | "none";

export type SuggestionCard = {
  id: string;
  kind: RewriteKind;
  title: string;
  detail: string;
  quote?: string;
  findingId?: string;
  box: PageBox | null;
};

export type DocumentLine = {
  page: number;
  text: string;
  box: PageBox;
};
