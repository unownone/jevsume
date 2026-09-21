/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("design tokens", () => {
  it("keeps shadcn muted surface separate from legacy muted text color", () => {
    const css = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
    expect(css).toContain("--muted: #1b1b24");
    expect(css).toContain("--text-muted: #c4bba8");
    expect(css).not.toMatch(/--muted: #c4bba8/);
  });
});
