import { describe, expect, it } from "vitest";
import { formatJevScore } from "../shared/format.ts";
import { boxForNeedle, boxesForLedgerRange, clusterLines, isPlausibleBox, padBox, unionBoxes } from "../src/studio/boxes.ts";
import {
  decorateStudioScore,
  findingsFromGlyphs,
  linesFromGlyphs,
  reviewFromGlyphs,
  scoreFromFindings,
} from "../src/studio/findings.ts";
import type { GlyphBox, StudioScore } from "../src/studio/types.ts";

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

  it("can pin the last visual occurrence instead of the first", () => {
    const page: GlyphBox[] = [
      { page: 1, str: "Led the payments cutover.", x: 8, y: 18, w: 70, h: 1.4 },
      { page: 1, str: "Led hiring after the cutover.", x: 8, y: 72, w: 70, h: 1.4 },
    ];
    expect(boxForNeedle(page, "Led", { occurrence: "first" })?.y).toBe(18);
    expect(boxForNeedle(page, "Led", { occurrence: "last" })?.y).toBe(72);
  });

  it("intersects a flattened ledger span with the runs it actually covers", () => {
    const ledger = [
      { flatStart: 0, flatEnd: 8, page: 1, str: "Jane Doe", box: { page: 1, x: 10, y: 4, w: 20, h: 2 } },
      { flatStart: 9, flatEnd: 14, page: 1, str: "Skills", box: { page: 1, x: 10, y: 78, w: 12, h: 1.4 } },
      {
        flatStart: 15,
        flatEnd: 40,
        page: 1,
        str: "Go, Kafka, TypeScript",
        box: { page: 1, x: 10, y: 82, w: 60, h: 1.4 },
      },
    ];
    const box = unionBoxes(boxesForLedgerRange(ledger, 15, 40));
    expect(box?.y).toBe(82);
    expect(box?.y).toBeGreaterThan(70);
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

  it("keeps full-width line-tight resume rows", () => {
    expect(isPlausibleBox({ page: 1, x: 1.2, y: 22, w: 96.4, h: 1.5 })).toBe(true);
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
    const { findings, score } = reviewFromGlyphs(denseResume(), {
      jobTitle: "Staff Backend Engineer",
      jobText: "- Production Kafka\n- Mentors senior engineers\n- Event-driven services in Go",
    });
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
    expect(score.validity).toBeGreaterThanOrEqual(0);
    expect(score.validity).toBeLessThanOrEqual(100);
    expect(score.evidence).toBeGreaterThanOrEqual(0);
    expect(score.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(score.strong.length).toBeGreaterThan(8);
    expect(score.weak.length).toBeGreaterThan(8);
    expect(score.leadershipLine.length).toBeGreaterThan(8);
    expect(score.jobsLine).toMatch(/Quillbot|Mable/);
    expect(score.skillsLine).toMatch(/listed|inferred/);
    expect(score.rewriteLine.length).toBeGreaterThan(8);
    expect(["destack-skills", "rotate-verb", "drop-bullet", "split-block", "destaff", "add-metric", "none"]).toContain(
      score.rewrite,
    );
  });

  it("does not fall back to Jane Doe demo copy", () => {
    const findings = findingsFromGlyphs(denseResume());
    expect(findings.some((item) => /jane doe|distributed systems engineer who ships/i.test(`${item.title} ${item.detail} ${item.quote ?? ""}`))).toBe(
      false,
    );
  });

  it("keeps a general review off a hardcoded job persona", () => {
    const { findings, score } = reviewFromGlyphs(denseResume());
    expect(findings.some((item) => /staff backend engineer/i.test(`${item.title} ${item.detail}`))).toBe(false);
    expect(score.targetLabel).toBeUndefined();
  });

  it("rates the page against pasted job text", () => {
    const { findings, score } = reviewFromGlyphs(denseResume(), {
      jobTitle: "Staff Backend Engineer",
      company: "Acme",
      jobText: "- Production Kafka\n- Mentors senior engineers\n- Terraform and AWS",
    });
    expect(score.targetLabel).toMatch(/Staff Backend Engineer/);
    expect(score.targetFit).toMatch(/listing skills/i);
    expect(findings.some((item) => item.severity === "missing" && /mentor/i.test(item.detail))).toBe(true);
    expect(score.skillsLine).toMatch(/kafka|aws|terraform/i);
  });
});

describe("document analysis", () => {
  it("counts repeated leadership verbs and dense jobs", () => {
    const { score } = reviewFromGlyphs([
      line(1, 4, "Work Experience"),
      line(1, 8, "Acme | Software Engineer | Full Time"),
      line(1, 12, "Led the payments team through a Kafka cutover."),
      line(1, 16, "Led the data team on the same Kafka cutover."),
      line(1, 20, "Led the platform team after the Kafka cutover."),
      line(1, 24, "Led on-call for the Kafka cutover."),
      line(1, 28, "Led docs for the Kafka cutover."),
      line(1, 32, "Led hiring for the Kafka cutover."),
      line(1, 36, "Skills"),
      line(1, 40, "Go, Go, Kafka, TypeScript"),
    ]);
    expect(score.suggestions.some((item) => item.kind === "rotate-verb")).toBe(true);
    expect(score.suggestions.some((item) => item.kind === "drop-bullet")).toBe(true);
    expect(score.suggestions.some((item) => item.kind === "destack-skills")).toBe(true);
    expect(score.weak.toLowerCase()).toMatch(/led|dense|repeat/);
    expect(score.leadershipLine).toMatch(/led ×6/);
    expect(score.jobsLine).toMatch(/cut some/);
    expect(score.rewrite).toBe("destack-skills");
    expect(score.rewriteLine).toMatch(/skills/i);
    const rotate = score.suggestions.find((item) => item.kind === "rotate-verb");
    expect(rotate?.box?.y).toBeGreaterThan(20);
    const destack = score.suggestions.find((item) => item.kind === "destack-skills");
    expect(destack?.box?.y).toBeGreaterThan(30);
  });

  it("pins skills and later leadership hits to the bottom of the page", () => {
    const { score } = reviewFromGlyphs([
      line(1, 4, "Imon Kalyan Roy"),
      line(1, 8, "Staff Software Engineer"),
      line(1, 12, "Work Experience"),
      line(1, 16, "Acme | Software Engineer | Full Time"),
      line(1, 20, "Led the first payments cutover on Kafka."),
      line(1, 24, "Led the second payments cutover on Kafka."),
      line(1, 28, "Led hiring for the payments cutover."),
      line(1, 32, "Led docs for the payments cutover."),
      line(1, 36, "Built Go, Kafka, and TypeScript services with a named metric of 2M events."),
      line(1, 80, "Skills"),
      line(1, 84, "Go, Go, Kafka, TypeScript, Python"),
    ]);
    const destack = score.suggestions.find((item) => item.kind === "destack-skills");
    expect(destack?.box?.y).toBeGreaterThan(70);
    const rotate = score.suggestions.find((item) => item.kind === "rotate-verb");
    expect(rotate?.box?.y).toBeGreaterThan(24);
  });

  it("parses wide role rows and does not count wrapped continuations as extra bullets", () => {
    const { score } = reviewFromGlyphs([
      line(1, 4, "Work Experience", 6, 22),
      line(1, 8, "QuillBot | Software Engineer | Payments & Growth | Full Time", 2, 96),
      line(1, 12, "• Architected, built, and shipped QuillBot’s credit platform: Kafka", 2, 96),
      line(1, 16, "consumers evaluate rate cards and pricing across wallets.", 4, 88),
      line(1, 20, "• Engineered the PostgreSQL + Redis backend at 10M+ records/day.", 2, 96),
      line(1, 24, "Mable GmbH | Full Time Jul 2023 – Sep 2025", 2, 96),
      line(1, 28, "Software Engineer 2 Feb 2025 – Sep 2025", 2, 96),
      line(1, 32, "• Built data ingestion pipelines in Go into ArangoDB.", 2, 96),
      line(1, 36, "Skills", 6, 14),
      line(1, 40, "Frameworks/Technologies Kafka, NestJS, Terraform, Kubernetes, FastAPI", 2, 96),
    ]);
    expect(score.jobsLine).toMatch(/QuillBot 2/);
    expect(score.jobsLine).toMatch(/Software Engineer 2/);
    expect(score.jobsLine).not.toMatch(/cut some/);
    expect(score.skillsLine).toMatch(/kafka/i);
    expect(score.skillsLine).not.toMatch(/missing kafka/);
  });

  it("fills live-score waiting copy from the page instead of leaving dashes", () => {
    const glyphs = denseResume();
    const { findings } = reviewFromGlyphs(glyphs);
    const live: StudioScore = {
      value: 72,
      verdict: "Jev is scoring each section.",
      noteCount: 21,
      validity: 40,
      evidence: 55,
      leadershipLine: "Waiting on section scores.",
      jobsLine: "Roles appear as they score.",
      skillsLine: "Skills score after the dump is judged.",
      rewriteLine: "Suggestions arrive with recover points.",
      rewrite: "none",
      strong: "—",
      weak: "—",
      dimensions: [
        { id: "header", label: "Header", score: 4, max: 8 },
        { id: "skills", label: "Skills", score: 17, max: 21 },
        { id: "experience", label: "Experience", score: 46, max: 60 },
        { id: "education", label: "Education", score: 10, max: 11 },
      ],
      suggestions: [],
    };
    const next = decorateStudioScore(live, linesFromGlyphs(glyphs), findings);
    expect(next.leadershipLine).not.toBe("Waiting on section scores.");
    expect(next.jobsLine).not.toBe("Roles appear as they score.");
    expect(next.skillsLine).not.toBe("Skills score after the dump is judged.");
    expect(next.rewriteLine).not.toBe("Suggestions arrive with recover points.");
    expect(next.strong).not.toBe("—");
    expect(next.weak).not.toBe("—");
    expect(next.dimensions).toEqual(live.dimensions);
    expect(next.value).toBe(72);
    expect(next.noteCount).toBe(21);
  });

  it("fills waiting judge lines from scored hierarchy even when glyph lines are empty", () => {
    const live: StudioScore = {
      value: 61,
      verdict: "Jev is scoring each section.",
      noteCount: 12,
      validity: 40,
      evidence: 55,
      leadershipLine: "Waiting on section scores.",
      jobsLine: "Roles appear as they score.",
      skillsLine: "Skills score after the dump is judged.",
      rewriteLine: "Suggestions arrive with recover points.",
      rewrite: "none",
      strong: "—",
      weak: "—",
      dimensions: [],
      suggestions: [
        {
          id: "s1",
          kind: "add-metric",
          title: "Raise dump vs evidence",
          detail: "Recover 6",
          recoverPoints: 6,
          box: null,
        },
      ],
      hierarchy: [
        {
          id: "skills",
          title: "Skills",
          kind: "skills",
          weight: 18,
          score01: 0.5,
          contribution: 9,
          status: "scored",
          dimensions: [
            { id: "dump", label: "Dump vs evidence", score: 2.1, max: 4 },
            { id: "proven", label: "Proven in work", score: 2.4, max: 4 },
          ],
          children: [],
        },
        {
          id: "experience",
          title: "Experience",
          kind: "experience",
          weight: 53,
          score01: 0.6,
          contribution: 32,
          status: "pending",
          children: [
            {
              id: "quillbot",
              title: "QuillBot",
              kind: "job",
              weight: 12,
              score01: 0.67,
              contribution: 8,
              status: "scored",
              dimensions: [{ id: "verbs", label: "Action verbs", score: 3.2, max: 4 }],
              children: [],
            },
          ],
        },
      ],
    };
    const next = decorateStudioScore(live, [], []);
    expect(next.leadershipLine).toMatch(/Action verbs/i);
    expect(next.jobsLine).toMatch(/QuillBot/);
    expect(next.jobsLine).not.toBe("Roles appear as they score.");
    expect(next.skillsLine).toMatch(/Dump vs evidence|Proven in work/i);
    expect(next.rewriteLine).toMatch(/recover 6/i);
  });

  it("keeps adding scored roles instead of freezing after the first job", () => {
    const first = decorateStudioScore(
      {
        value: 20,
        verdict: "Jev is scoring each section.",
        noteCount: 2,
        validity: 10,
        evidence: 10,
        leadershipLine: "Waiting on section scores.",
        jobsLine: "Roles appear as they score.",
        skillsLine: "Skills score after the dump is judged.",
        rewriteLine: "Suggestions arrive with recover points.",
        rewrite: "none",
        strong: "—",
        weak: "—",
        dimensions: [],
        suggestions: [],
        hierarchy: [
          {
            id: "experience",
            title: "Experience",
            kind: "experience",
            weight: 53,
            score01: null,
            contribution: null,
            status: "pending",
            children: [
              {
                id: "quillbot",
                title: "QuillBot",
                kind: "job",
                weight: 12,
                score01: 0.67,
                contribution: 8,
                status: "scored",
                dimensions: [{ id: "verbs", label: "Action verbs", score: 3.2, max: 4 }],
                children: [],
              },
              {
                id: "mable",
                title: "Mable GmbH",
                kind: "job",
                weight: 10,
                score01: null,
                contribution: null,
                status: "pending",
                children: [],
              },
            ],
          },
        ],
      },
      [],
      [],
    );
    expect(first.jobsLine).toBe("QuillBot 8/12");

    const second = decorateStudioScore(
      {
        ...first,
        hierarchy: [
          {
            id: "experience",
            title: "Experience",
            kind: "experience",
            weight: 53,
            score01: 0.6,
            contribution: 32,
            status: "pending",
            children: [
              {
                id: "quillbot",
                title: "QuillBot",
                kind: "job",
                weight: 12,
                score01: 0.67,
                contribution: 8,
                status: "scored",
                dimensions: [{ id: "verbs", label: "Action verbs", score: 3.2, max: 4 }],
                children: [],
              },
              {
                id: "mable",
                title: "Mable GmbH",
                kind: "job",
                weight: 10,
                score01: 0.5,
                contribution: 5,
                status: "scored",
                dimensions: [{ id: "verbs", label: "Action verbs", score: 2.1, max: 4 }],
                children: [],
              },
            ],
          },
        ],
      },
      [],
      [],
    );
    expect(second.jobsLine).toMatch(/QuillBot 8\/12/);
    expect(second.jobsLine).toMatch(/Mable GmbH 5\/10/);
    expect(second.leadershipLine).toMatch(/2 scored roles/);
  });
});
