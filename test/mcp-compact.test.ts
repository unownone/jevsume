import { describe, expect, it } from "vitest";
import type { ReviewResponse } from "../packages/jev/types.ts";
import { compactReview, MAX_FINDINGS, MAX_SUGGESTIONS } from "../mcp/compact.ts";

function sampleReview(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    mode: "job",
    jevScore: { value: 71, breakdown: [{ key: "experience", score01: 0.7, weight: 1 }], confidence: null },
    validity: 80,
    evidence: 62,
    dimensions: [{ id: "experience", label: "Experience", score: 40, max: 50 }],
    sections: [],
    hierarchy: [
      {
        id: "experience",
        kind: "experience",
        title: "Experience",
        level: 1,
        parentId: null,
        text: "secret resume blob",
        start: 0,
        end: 10,
        line: 1,
        weight: 100,
        score01: 0.7,
        contribution: 70,
        status: "scored",
        dimensions: [],
        children: [],
      },
    ],
    findings: [
      {
        id: "f1",
        severity: "works",
        title: "Clear header",
        detail: "Name is parseable",
        span: { start: 0, end: 4, sectionId: "h", fragmentId: "h-body", line: 1 },
      },
      {
        id: "f2",
        severity: "missing",
        title: "No Kafka",
        detail: "Listing asks for production Kafka",
        span: { start: 5, end: 8, sectionId: "h", fragmentId: "h-body", line: 2 },
      },
      {
        id: "f3",
        severity: "partial",
        title: "Metrics thin",
        detail: "One number in the latest role",
        span: { start: 8, end: 10, sectionId: "h", fragmentId: "h-body", line: 3 },
      },
    ],
    suggestions: [
      { id: "s1", text: "Name the Kafka cluster and daily volume.", recoverPoints: 6 },
      { id: "s2", text: "Add a mentorship line." },
    ],
    requirements: [
      { id: "r1", text: "Production Kafka", category: "must_have", noul: 0.9, verdict: "missing" },
      { id: "r2", text: "Go services", category: "must_have", noul: 0.8, verdict: "works" },
    ],
    provider: "mock",
    resumeText: "THIS MUST NOT LEAK",
    persona: { id: "preset:swe-staff", title: "Staff Backend Engineer", isDefault: false },
    telemetry: {
      serverMs: 12,
      inputTokens: 99,
      outputTokens: 12,
      totalTokens: 111,
      costUsd: 0.01,
      requestCount: 3,
    },
    ...overrides,
  };
}

describe("compactReview", () => {
  it("drops resume text, hierarchy, telemetry, and passing requirements", () => {
    const compact = compactReview(sampleReview());
    const encoded = JSON.stringify(compact);
    expect(encoded).not.toContain("THIS MUST NOT LEAK");
    expect(encoded).not.toContain("secret resume blob");
    expect(encoded).not.toContain("inputTokens");
    expect(compact.score).toBe(71);
    expect(compact.validity).toBe(80);
    expect(compact.evidence).toBe(62);
    expect(compact.mode).toBe("job");
    expect(compact.lens).toEqual({ id: "preset:swe-staff", title: "Staff Backend Engineer" });
    expect(compact.findings.map((item) => item.sev)).toEqual(["missing", "partial"]);
    expect(compact.suggestions).toEqual([
      { text: "Name the Kafka cluster and daily volume.", recover: 6 },
      { text: "Add a mentorship line." },
    ]);
    expect(compact.gaps).toEqual([{ text: "Production Kafka", verdict: "missing" }]);
    expect("hierarchy" in compact).toBe(false);
    expect("resumeText" in compact).toBe(false);
  });

  it("keeps works findings only when nothing else is actionable", () => {
    const compact = compactReview(
      sampleReview({
        findings: [
          {
            id: "ok",
            severity: "works",
            title: "Holds together",
            detail: "No hard gaps",
            span: { start: 0, end: 1, sectionId: "h", fragmentId: "h-body", line: 1 },
          },
        ],
        suggestions: [],
        requirements: [],
      }),
    );
    expect(compact.findings).toEqual([{ sev: "works", title: "Holds together", detail: "No hard gaps" }]);
  });

  it("caps findings and suggestions", () => {
    const findings = Array.from({ length: MAX_FINDINGS + 3 }, (_, index) => ({
      id: `f${index}`,
      severity: "risk" as const,
      title: `Risk ${index}`,
      detail: "x",
      span: { start: 0, end: 1, sectionId: "h", fragmentId: "h-body", line: 1 },
    }));
    const suggestions = Array.from({ length: MAX_SUGGESTIONS + 2 }, (_, index) => ({
      id: `s${index}`,
      text: `Fix ${index}`,
    }));
    const compact = compactReview(sampleReview({ findings, suggestions }));
    expect(compact.findings).toHaveLength(MAX_FINDINGS);
    expect(compact.suggestions).toHaveLength(MAX_SUGGESTIONS);
  });
});
