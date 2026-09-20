import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET } from "../shared/resume-presets.ts";
import { pdfFromResumeText } from "../src/studio/resume-pdf.ts";

describe("pdfFromResumeText", () => {
  it("builds a parseable one-page PDF that keeps the candidate name", () => {
    const bytes = pdfFromResumeText(DEFAULT_PRESET.resumeText);
    const ascii = new TextDecoder("latin1").decode(bytes);
    expect(ascii.startsWith("%PDF-1.4")).toBe(true);
    expect(ascii).toContain("%%EOF");
    expect(ascii).toContain("Jane Doe");
    expect(ascii).toContain("/Type /Page");
  });

  it("escapes PDF string syntax in resume copy", () => {
    const bytes = pdfFromResumeText("Ada (Lane)\nEngineer\n\nSummary\nShips (and) reviews.");
    const ascii = new TextDecoder("latin1").decode(bytes);
    expect(ascii).toContain("Ada \\(Lane\\)");
    expect(ascii).toContain("Ships \\(and\\) reviews.");
  });
});
