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
  dimensions: ScoreDimension[];
};

export type PageMetrics = {
  page: number;
  width: number;
  height: number;
};
