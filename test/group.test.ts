import { describe, expect, it } from "vitest";
import { buildProctorBlocks, extractRequirementCandidates, groupResumeText } from "../worker/ats/group.ts";

describe("groupResumeText", () => {
  it("groups canonical ATS headings and bullets", () => {
    const grouped = groupResumeText(`
Jane Doe
Summary
Staff engineer who ships distributed systems.
Experience
- Built an event bus that cut p99 latency 40%
- Led a team of 6
Skills
TypeScript, Go, Kafka
`);
    const kinds = grouped.sections.map((section) => section.kind);
    expect(kinds).toContain("summary");
    expect(kinds).toContain("experience");
    expect(kinds).toContain("skills");
    const experience = grouped.sections.find((section) => section.kind === "experience");
    expect(experience?.fragments.filter((fragment) => fragment.kind === "bullet")).toHaveLength(2);
  });

  it("puts untitled text into an other section", () => {
    const grouped = groupResumeText("Just a blob of resume words without headings.");
    expect(grouped.sections).toHaveLength(1);
    expect(grouped.sections[0]?.kind).toBe("other");
  });

  it("ignores empty input sections", () => {
    const grouped = groupResumeText("\n\n");
    expect(grouped.sections).toHaveLength(0);
  });

  it("anchors fragments and sections to character offsets in the grouped text", () => {
    const grouped = groupResumeText(`Jane Doe
Summary
Staff engineer who ships distributed systems.
Experience
- Built an event bus that cut p99 latency 40%
Skills
TypeScript, Go, Kafka`);
    const summary = grouped.sections.find((section) => section.kind === "summary");
    const experience = grouped.sections.find((section) => section.kind === "experience");
    const bullet = experience?.fragments.find((fragment) => fragment.kind === "bullet");
    expect(summary?.start).toBeGreaterThanOrEqual(0);
    expect(summary?.end).toBeGreaterThan(summary?.start ?? 0);
    expect(grouped.text.slice(summary!.start, summary!.end)).toContain(
      "Staff engineer who ships distributed systems.",
    );
    expect(bullet?.start).toBeGreaterThanOrEqual(0);
    expect(grouped.text.slice(bullet!.start, bullet!.end)).toContain(
      "Built an event bus that cut p99 latency 40%",
    );
    expect(bullet?.line).toBeGreaterThan(0);
  });

  it("promotes a leading name into a header and splits roles under experience", () => {
    const grouped = groupResumeText(`Jane Doe
roy@example.com
Experience
Acme | Software Engineer | Full Time
- Built a Kafka pipeline
Beta | Intern | Part Time
- Wrote Python jobs
Skills
Go, Kafka
`);
    expect(grouped.sections[0]?.kind).toBe("header");
    const blocks = buildProctorBlocks(`Jane Doe
roy@example.com
Experience
Acme | Software Engineer | Full Time
- Built a Kafka pipeline
Beta | Intern | Part Time
- Wrote Python jobs
Skills
Go, Kafka
`);
    expect(blocks.some((block) => block.kindHint === "header")).toBe(true);
    expect(blocks.filter((block) => block.kindHint === "job")).toHaveLength(2);
    expect(blocks.some((block) => block.kindHint === "skills")).toBe(true);
  });
});

describe("extractRequirementCandidates", () => {
  it("keeps unique JD lines long enough to be requirements", () => {
    const lines = extractRequirementCandidates(
      "We are hiring.\n- 5+ years of Go in production\n- 5+ years of Go in production\nPTO",
    );
    expect(lines).toContain("5+ years of Go in production");
    expect(lines.some((line) => line === "PTO")).toBe(false);
  });
});
