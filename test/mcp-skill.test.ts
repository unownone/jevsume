import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const skillDir = "skills/jevsume-resume";
const skill = readFileSync(`${skillDir}/SKILL.md`, "utf8");

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

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

  it("stays self-contained when packaged on its own", () => {
    for (const file of markdownFiles(skillDir)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/<jevsume-host>|<your-worker>/);
      for (const [, target] of text.matchAll(/\]\(([^)#]+)\)/g)) {
        if (/^https?:/.test(target)) continue;
        const resolved = path.resolve(path.dirname(file), target);
        expect(resolved.startsWith(path.resolve(skillDir)), `${file} -> ${target}`).toBe(true);
        expect(() => readFileSync(resolved), `${file} -> ${target}`).not.toThrow();
      }
    }
  });

  it("discloses where resume text is sent", () => {
    expect(skill).toContain("https://resume.ikr.one/mcp");
    expect(skill).toMatch(/## Data handling/);
  });
});
