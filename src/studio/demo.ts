import type { OverlayFinding } from "./types.ts";

export const DEMO_PERSONA = {
  title: "Staff Backend Engineer",
  summary: "Event-driven services in Go, Kafka in production, and someone who sets direction for seniors.",
};

export const DEMO_JOB_LISTING = {
  jobTitle: "Staff Backend Engineer",
  company: "Acme",
  jobUrl: "",
  jobText: `Staff Backend Engineer
Acme is hiring someone who already owns event-driven services.

Requirements
- 5+ years building event-driven services in Go
- Production Kafka or equivalent streaming experience
- Mentors senior engineers and sets technical direction
- Comfortable with Terraform and AWS
`,
};

export const DEMO_FINDINGS: OverlayFinding[] = [
  {
    id: "summary-stake",
    severity: "partial",
    title: "Summary sells a vibe",
    detail:
      "The parser keeps “distributed systems” and “event-driven”. A hiring lens wants a stake: what you own, at what scale.",
    rewrite:
      "Staff engineer for event-driven platforms: Go, Kafka, and p99 latency work on systems that already run in production.",
    needle: "Distributed systems engineer who ships event-driven platforms",
    box: null,
    origin: "jev",
    index: 1,
  },
  {
    id: "pipeline-proof",
    severity: "works",
    title: "The pipeline line is proof",
    detail: "Volume, stack, and a 40% p99 cut. This is the fragment both an ATS and a human keep.",
    needle: "Built a Go + Kafka pipeline handling 2M events/day",
    box: null,
    origin: "jev",
    index: 2,
  },
  {
    id: "rust-hotpath",
    severity: "partial",
    title: "The metric floats",
    detail: "18% is real. The line never says what the hot path was, so the number has nothing to hang on.",
    rewrite: "Cut AWS spend 18% by rewriting the Kafka consumer hot path in Rust.",
    needle: "Reduced AWS spend 18%",
    box: null,
    origin: "jev",
    index: 3,
  },
  {
    id: "mentorship-gap",
    severity: "missing",
    title: "Mentorship never appears",
    detail:
      "This persona asks for someone who mentors seniors. “Led 6 engineers” is staffing, not teaching. The page never says which.",
    needle: "Led 6 engineers on a TypeScript control plane",
    box: null,
    origin: "jev",
    index: 4,
  },
];
