import { describe, expect, it } from "vitest";
import { formatJevScore, scoreTone } from "../shared/format.ts";

describe("formatJevScore", () => {
  it("pads a 0–100 score as a two-or-three digit display value", () => {
    expect(formatJevScore(7)).toBe("07");
    expect(formatJevScore(84)).toBe("84");
    expect(formatJevScore(100)).toBe("100");
  });

  it("maps bands to tones for the orb", () => {
    expect(scoreTone(40)).toBe("low");
    expect(scoreTone(70)).toBe("mid");
    expect(scoreTone(90)).toBe("high");
  });
});
