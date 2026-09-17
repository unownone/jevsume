import { describe, expect, it } from "vitest";
import { buildAnnotatedSegments } from "../src/lib/annotate.ts";

describe("buildAnnotatedSegments", () => {
  it("splits resume text into marked segments bound to finding ids", () => {
    const text = "Alpha line\nBeta metric 40%\nGamma close";
    const segments = buildAnnotatedSegments(text, [
      { id: "metrics", start: 11, end: 26 },
    ]);
    expect(segments.map((segment) => segment.text)).toEqual([
      "Alpha line\n",
      "Beta metric 40%",
      "\nGamma close",
    ]);
    expect(segments[1]?.findingIds).toEqual(["metrics"]);
    expect(segments[0]?.findingIds).toEqual([]);
  });

  it("keeps overlapping findings on the shared passage", () => {
    const text = "abcdefghij";
    const segments = buildAnnotatedSegments(text, [
      { id: "a", start: 2, end: 8 },
      { id: "b", start: 4, end: 10 },
    ]);
    const overlap = segments.find((segment) => segment.start === 4 && segment.end === 8);
    expect(overlap?.findingIds).toEqual(["a", "b"]);
    expect(overlap?.text).toBe("efgh");
  });
});
