import { describe, expect, it } from "vitest";
import {
  compareResumeToJob,
  jobMatchScoreValue,
  parseJobDescriptionSections,
  sectionsFromRequirements,
} from "../packages/jev/job-sections.ts";

const listing = `Requirements
- 5+ years of TypeScript in production services
- Kubernetes experience
Nice to have
- Familiar with Kafka
`;

describe("parseJobDescriptionSections", () => {
  it("splits expected, good to have, and proficiency", () => {
    const sections = parseJobDescriptionSections(listing);
    expect(sections.expected.some((line) => /TypeScript/i.test(line))).toBe(true);
    expect(sections.goodToHave.some((line) => /Kafka/i.test(line))).toBe(true);
    const typescript = sections.skills.find((skill) => /typescript/i.test(skill.name));
    expect(typescript?.expectation).toBe("expected");
    expect(typescript?.proficiency).toBe("proficient");
    const kafka = sections.skills.find((skill) => /kafka/i.test(skill.name));
    expect(kafka?.expectation).toBe("good_to_have");
    expect(kafka?.proficiency).toBe("familiar");
  });

  it("keeps Jev categories when requirements exist", () => {
    const sections = sectionsFromRequirements(listing, [
      { text: "TypeScript in production", category: "must_have" },
      { text: "Kafka is a plus", category: "nice_to_have" },
    ]);
    expect(sections.expected).toEqual(["TypeScript in production"]);
    expect(sections.goodToHave).toEqual(["Kafka is a plus"]);
    expect(sections.skills.length).toBeGreaterThan(0);
  });
});

describe("compareResumeToJob", () => {
  it("validates skills from resume lines and reports the gap", () => {
    const sections = parseJobDescriptionSections(listing);
    const comparison = compareResumeToJob(
      {
        text: "Skills\nTypeScript, React\nExperience\n- Shipped TypeScript services for 6 years",
        sections: [
          {
            kind: "skills",
            text: "TypeScript, React",
            fragments: [{ kind: "paragraph", text: "TypeScript, React" }],
          },
          {
            kind: "experience",
            text: "Shipped TypeScript services for 6 years",
            fragments: [{ kind: "bullet", text: "Shipped TypeScript services for 6 years" }],
          },
        ],
      },
      sections,
    );
    expect(comparison.skillsValidated.some((skill) => /typescript/i.test(skill.name))).toBe(true);
    expect(comparison.availableSkills).toEqual(expect.arrayContaining(["TypeScript", "React"]));
    expect(comparison.missingSkills.some((name) => /kubernetes/i.test(name))).toBe(true);
    expect(comparison.skillGap.some((skill) => /kubernetes/i.test(skill.name))).toBe(true);
    expect(jobMatchScoreValue(comparison)).toBeGreaterThan(0);
    expect(jobMatchScoreValue(comparison)).toBeLessThan(100);
  });
});
