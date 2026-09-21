import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skill = readFileSync("skills/jevsume-resume/SKILL.md", "utf8");

describe("jevsume-resume skill", () => {
  it("matches the Agent Skills frontmatter contract", () => {
    expect(skill.startsWith("---\n")).toBe(true);
    expect(skill).toMatch(/^---\nname: jevsume-resume\n/);
    expect(skill).toMatch(/\ndescription: .{20,1024}\n---\n/);
    expect(skill).toContain("review_resume");
    expect(skill).toContain("list_job_lenses");
    expect(skill).toContain("jobLensId");
    expect(skill.length).toBeLessThan(8000);
  });
});
