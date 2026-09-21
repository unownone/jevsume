/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("SiteApp code splitting", () => {
  it("lazy-loads review and classic routes", () => {
    const source = readFileSync(path.join(process.cwd(), "src/SiteApp.tsx"), "utf8");
    expect(source).toContain('lazy(() => import("@/pages/ReviewStudioPage.tsx")');
    expect(source).toContain('lazy(() => import("@/pages/ClassicReviewPage.tsx")');
    expect(source).toContain("<Suspense");
  });
});
