import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { STUDIO_FORBIDDEN_PATTERNS, studioCopy } from "@/lib/site-copy.ts";

describe("review studio copy guardrails", () => {
  it("avoids unsupported marketing claims in studio copy", () => {
    const blob = JSON.stringify(studioCopy);
    for (const pattern of STUDIO_FORBIDDEN_PATTERNS) {
      expect(blob).not.toMatch(pattern);
    }
  });

  it("routes /review through StudioApp controller", () => {
    const page = readFileSync("src/pages/ReviewStudioPage.tsx", "utf8");
    const controller = readFileSync("src/studio/StudioApp.tsx", "utf8");
    expect(page).toContain("StudioApp");
    expect(controller).toContain("ReviewStudio");
  });
});
