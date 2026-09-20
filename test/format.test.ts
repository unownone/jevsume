import { describe, expect, it } from "vitest";
import { formatJevScore, formatReviewCost, formatTokenCount, scoreTone } from "../shared/format.ts";
import { formatClockTime, formatRateLimitCopy, secondsUntil } from "../shared/rate-limit.ts";

describe("formatJevScore", () => {
  it("pads a 0–100 score as a two-or-three digit display value", () => {
    expect(formatJevScore(7)).toBe("07");
    expect(formatJevScore(84)).toBe("84");
    expect(formatJevScore(100)).toBe("100");
  });

  it("formats token counts with grouping", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(12840)).toBe("12,840");
  });

  it("formats estimated Jev input cost", () => {
    expect(formatReviewCost(0)).toBe("$0");
    expect(formatReviewCost(0.042)).toBe("$0.042");
  });

  it("maps bands to tones for the orb", () => {
    expect(scoreTone(40)).toBe("low");
    expect(scoreTone(70)).toBe("mid");
    expect(scoreTone(90)).toBe("high");
  });
});

describe("rate limit copy", () => {
  it("includes remaining wait and the clock time the limit restores", () => {
    const resetAt = "2026-09-17T21:50:00.000Z";
    const nowMs = Date.parse("2026-09-17T21:49:18.000Z");
    expect(secondsUntil(resetAt, nowMs)).toBe(42);
    const copy = formatRateLimitCopy({
      checkpoint: "resumeReview",
      limit: 10,
      resetAt,
      nowMs,
    });
    expect(copy).toContain("10 per minute");
    expect(copy).toContain("42s");
    expect(copy).toContain(formatClockTime(resetAt));
  });

  it("says the user can try again once the window has elapsed", () => {
    const resetAt = "2026-09-17T21:50:00.000Z";
    const copy = formatRateLimitCopy({
      checkpoint: "personaCreation",
      limit: 5,
      resetAt,
      nowMs: Date.parse(resetAt),
    });
    expect(copy).toContain("can try again");
  });
});
