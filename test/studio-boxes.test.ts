import { describe, expect, it } from "vitest";
import { boxForNeedle, padBox, unionBoxes } from "../src/studio/boxes.ts";
import type { GlyphBox } from "../src/studio/types.ts";

const glyphs: GlyphBox[] = [
  { page: 1, str: "Built", x: 10, y: 20, w: 8, h: 2 },
  { page: 1, str: "a Go + Kafka pipeline", x: 19, y: 20, w: 30, h: 2 },
  { page: 1, str: "handling 2M events/day", x: 50, y: 20, w: 28, h: 2 },
  { page: 1, str: "Education", x: 10, y: 80, w: 16, h: 2 },
];

describe("boxForNeedle", () => {
  it("unions consecutive glyphs that cover the needle", () => {
    const box = boxForNeedle(glyphs, "Built a Go + Kafka pipeline handling 2M events/day");
    expect(box).toEqual({ page: 1, x: 10, y: 20, w: 68, h: 2 });
  });

  it("returns null when the needle is absent", () => {
    expect(boxForNeedle(glyphs, "Python")).toBeNull();
  });
});

describe("unionBoxes", () => {
  it("returns null for an empty list", () => {
    expect(unionBoxes([])).toBeNull();
  });
});

describe("padBox", () => {
  it("keeps the box on the page", () => {
    const padded = padBox({ page: 1, x: 0, y: 0, w: 10, h: 10 }, 2, 2);
    expect(padded.x).toBe(0);
    expect(padded.y).toBe(0);
  });
});
