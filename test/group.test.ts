import { describe, expect, it } from "vitest";
import { extractRequirementCandidates, groupResumeText } from "../worker/ats/group.ts";

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
