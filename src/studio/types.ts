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
  needle: string;
  box: PageBox | null;
  origin: "jev" | "you";
};

export type ChatMessage = {
  id: string;
  from: "jev" | "you";
  text: string;
};

export type PageMetrics = {
  page: number;
  width: number;
  height: number;
};
