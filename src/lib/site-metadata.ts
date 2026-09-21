import type { SiteRouteId } from "./routes.ts";

export type PageMetadata = {
  title: string;
  description: string;
  ogTitle: string;
};

const DEFAULT: PageMetadata = {
  title: "Pro-sume — resume review with Jev",
  description:
    "Drop a resume, pick a job lens, and read typed JevScore findings on the page. Hosted MCP available without an API key.",
  ogTitle: "Pro-sume — resume review with Jev",
};

const BY_ROUTE: Partial<Record<SiteRouteId, PageMetadata>> = {
  landing: DEFAULT,
  review: {
    title: "Review studio — Pro-sume",
    description: "PDF-first resume review studio. Jev returns scores and notes; the UI keeps them on the page.",
    ogTitle: "Review studio — Pro-sume",
  },
  agents: {
    title: "MCP & agents — Pro-sume",
    description:
      "Connect Claude, Cursor, Codex, or any MCP client to hosted /mcp (no key) or local npx with your TypeSafe key.",
    ogTitle: "MCP setup — Pro-sume",
  },
  classic: {
    title: "Classic review — Pro-sume",
    description: "Text-first resume review with marked lines and Jev notes.",
    ogTitle: "Classic review — Pro-sume",
  },
};

export function metadataForRoute(route: SiteRouteId): PageMetadata {
  return BY_ROUTE[route] ?? DEFAULT;
}

export function applyPageMetadata(meta: PageMetadata): void {
  if (typeof window === "undefined") {
    return;
  }
  window.document.title = meta.title;
  const description = window.document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute("content", meta.description);
  }
  const ogTitle = window.document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute("content", meta.ogTitle);
  }
  const ogDescription = window.document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    ogDescription.setAttribute("content", meta.description);
  }
}
