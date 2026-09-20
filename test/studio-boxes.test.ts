import { describe, expect, it } from "vitest";
import { formatJevScore } from "../shared/format.ts";
import { boxForNeedle, clusterLines, isPlausibleBox, padBox, unionBoxes } from "../src/studio/boxes.ts";
import { findingsFromGlyphs, linesFromGlyphs, reviewFromGlyphs, scoreFromFindings } from "../src/studio/findings.ts";
import type { GlyphBox } from "../src/studio/types.ts";

const glyphs: GlyphBox[] = [
  { page: 1, str: "Built", x: 10, y: 20, w: 8, h: 2 },
  { page: 1, str: "a Go + Kafka pipeline", x: 19, y: 20, w: 30, h: 2 },
  { page: 1, str: "handling 2M events/day", x: 50, y: 20, w: 28, h: 2 },
  { page: 1, str: "Education", x: 10, y: 80, w: 16, h: 2 },
];

function line(page: number, y: number, str: string, x = 8, w = 72, h = 1.4): GlyphBox {
  return { page, str, x, y, w, h };
}

function denseResume(): GlyphBox[] {
  const rows = [
    "Imon Kalyan Roy",
    "royimonroy@gmail.com | Kolkata, India",
    "Skills",
    "Languages Rust, Go, TypeScript, Python, Kafka, React, FastAPI, Docker, Kubernetes, GCP, AWS",
    "Work Experience",
    "Quillbot | Software Engineer | Payments & Growth | Full Time | Sep 2025 – Present",
    "Architected, built, and shipped Quillbot's in-house, event-driven credit platform to unify AP-product usage.",
    "Engineered the PostgreSQL · Redis backend with optimized queries, automated wallet assignment, and clock-driven credit-expiration jobs.",
    "Built Quillbot's first production payment service with processor-agnostic Next.js + BullMQ, cutting Chargebee cost 30%.",
    "Implemented stateless BullMQ reconciliation workers with smart retries for durable recurring-payment processing.",
    "Mable GmbH | Software Engineer 2 | Full Time | Jul 2023 – Sep 2025",
    "Built data ingestion and periodic processing pipelines in Go to load bulk historical order data into ArangoDB and ClickHouse in under 2 minutes.",
    "Redesigned the D.A.L library, enabling efficient, reproducible access to multiple databases across 7+ microservices and improving query performance by 25%.",
    "Re-architected identity logic into a unified system capable of linking cross-browser sessions in a distributed system, using graph views to reduce search operations by 80%.",
    "Reverse-engineered the Google Analytics API to build a server-side ad-triggering system processing thousands of events/sec.",
    "Managed a team of 2 engineers to implement and scale Mable's Shopware integration — from Shopware plugins and data-capture SDK to Go/Node.js pipeline microservices.",
    "Scaled Shopware integrations to over 1,000 rps, processing millions of analytics events/day for 30+ enterprise customers.",
    "Wizenoze | Software Engineer | Internship | Apr 2023 – Jul 2023",
    "Built Botsonic's user-facing analytics dashboard surfacing messages and tokens using Next.js and Python, adding UI and API-level data fetching that reduced query time by 40%.",
    "Copycat.dev | Software Engineer | Part Time | Jul 2022 – Apr 2023",
    "Shipped landing pages and component kits used by 12 paying teams without a named metric on conversion.",
  ];
  return rows.map((str, index) => line(1, 4 + index * 4.2, str));
}

describe("boxForNeedle", () => {
  it("unions consecutive glyphs that cover the needle", () => {
    const box = boxForNeedle(glyphs, "Built a Go + Kafka pipeline handling 2M events/day");
    expect(box).toEqual({ page: 1, x: 10, y: 20, w: 68, h: 2 });
  });

  it("does not grow the box backward into earlier lines", () => {
    const page: GlyphBox[] = [
      { page: 1, str: "Jane Doe", x: 10, y: 8, w: 20, h: 3 },
      { page: 1, str: "Summary", x: 10, y: 16, w: 12, h: 2 },
      { page: 1, str: "Distributed systems engineer who ships event-driven platforms.", x: 10, y: 20, w: 70, h: 4 },
    ];
    const box = boxForNeedle(page, "Distributed systems engineer who ships event-driven platforms");
    expect(box).toEqual({ page: 1, x: 10, y: 20, w: 70, h: 4 });
  });

  it("keeps a match on one line even if later glyphs sit far below", () => {
    const page: GlyphBox[] = [
      { page: 1, str: "event-driven", x: 10, y: 20, w: 20, h: 1.2 },
      { page: 1, str: "credit platform", x: 32, y: 20, w: 22, h: 1.2 },
      { page: 1, str: "footer noise event-driven leftover", x: 10, y: 90, w: 40, h: 1.2 },
    ];
    const box = boxForNeedle(page, "event-driven credit platform");
    expect(box?.y).toBe(20);
    expect(box?.h).toBeLessThan(3);
  });

  it("returns null when the needle is absent", () => {
    expect(boxForNeedle(glyphs, "Python")).toBeNull();
  });
});

describe("unionBoxes", () => {
  it("returns null for an empty list", () => {
    expect(unionBoxes([])).toBeNull();
  });
});

describe("padBox", () => {
  it("keeps the box on the page", () => {
    const padded = padBox({ page: 1, x: 0, y: 0, w: 10, h: 10 }, 2, 2);
    expect(padded.x).toBe(0);
    expect(padded.y).toBe(0);
    expect(padded.h).toBeLessThanOrEqual(3.8);
  });
});

describe("isPlausibleBox", () => {
  it("rejects page-covering rectangles", () => {
    expect(isPlausibleBox({ page: 1, x: 4, y: 2, w: 90, h: 70 })).toBe(false);
  });
});

describe("clusterLines", () => {
  it("groups glyphs that share a baseline", () => {
    const lines = clusterLines(glyphs);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.map((item) => item.str).join(" ")).toContain("Kafka");
  });

  it("does not glue consecutive resume bullets into one box", () => {
    const lines = clusterLines(denseResume().slice(6, 9));
    expect(lines).toHaveLength(3);
  });
});

describe("findingsFromGlyphs", () => {
  it("writes several notes that quote the actual page", () => {
    const page: GlyphBox[] = [
      { page: 1, str: "Imon Kalyan Roy", x: 20, y: 4, w: 30, h: 2 },
      { page: 1, str: "Skills", x: 6, y: 12, w: 10, h: 1.4 },
      { page: 1, str: "Rust, Go, TypeScript, Python, Kafka, React, FastAPI", x: 18, y: 12, w: 55, h: 1.4 },
      { page: 1, str: "Experience", x: 6, y: 18, w: 14, h: 1.4 },
      {
        page: 1,
        str: "Built and shipped an event-driven credit platform to unify AP-product usage; Kafka consumers evaluate rate cards and cut p99 40%.",
        x: 8,
        y: 22,
        w: 70,
        h: 1.6,
      },
      {
        page: 1,
        str: "Led 6 engineers on a TypeScript control plane used by 30 product teams without naming a mentee.",
        x: 8,
        y: 28,
        w: 72,
        h: 1.6,
      },
      {
        page: 1,
        str: "Architected built and shipped the first production payment service with processor-agnostic Next.js BullMQ platform decoupling payments from Chargebee and supporting Razorpay subscription lifecycle management and recurring billing plus a second sentence that keeps going until the parser gives up on the block.",
        x: 8,
        y: 36,
        w: 74,
        h: 1.8,
      },
    ];
    const findings = findingsFromGlyphs(page);
    expect(findings.length).toBeGreaterThanOrEqual(5);
    expect(findings.every((item) => item.box && isPlausibleBox(item.box))).toBe(true);
    expect(findings.some((item) => item.quote?.includes("Kafka"))).toBe(true);
    expect(findings.some((item) => item.severity === "risk")).toBe(true);
    const score = scoreFromFindings(findings);
    expect(score.value).toBeGreaterThan(10);
    expect(score.dimensions).toHaveLength(5);
  });

  it("ignores implausible line boxes", () => {
    const lines = linesFromGlyphs([{ page: 1, str: "huge", x: 0, y: 0, w: 99, h: 80 }]);
    expect(lines).toHaveLength(0);
  });

  it("returns a dense set of line-tight notes on a real resume page", () => {
    const { findings, score } = reviewFromGlyphs(denseResume());
    expect(findings.length).toBeGreaterThanOrEqual(15);
    expect(findings.every((item) => item.box && isPlausibleBox(item.box))).toBe(true);
    expect(findings.every((item) => (item.box?.h ?? 99) <= 4.2)).toBe(true);
    expect(findings.some((item) => item.quote?.includes("ClickHouse"))).toBe(true);
    expect(findings.some((item) => item.quote?.includes("Quillbot"))).toBe(true);
    expect(findings.some((item) => item.severity === "missing" && /mentor/i.test(item.detail))).toBe(true);
    expect(findings.some((item) => /kafka/i.test(`${item.quote ?? ""} ${item.detail}`))).toBe(true);
    expect(Number.isInteger(score.value)).toBe(true);
    expect(score.value).toBeGreaterThanOrEqual(20);
    expect(score.value).toBeLessThanOrEqual(100);
    expect(formatJevScore(score.value)).not.toContain(".");
    expect(score.verdict.length).toBeGreaterThan(12);
    expect(score.noteCount).toBe(findings.length);
    expect(score.dimensions).toHaveLength(5);
  });

  it("does not fall back to Jane Doe demo copy", () => {
    const findings = findingsFromGlyphs(denseResume());
    expect(findings.some((item) => /jane doe|distributed systems engineer who ships/i.test(`${item.title} ${item.detail} ${item.quote ?? ""}`))).toBe(
      false,
    );
  });
});
