import { describe, expect, it } from "vitest";
import { estimateInputCostUsd, INPUT_TOKEN_USD_PER_MILLION } from "../packages/jev/cost.ts";
import { formatReviewCost, formatDurationMs } from "../shared/format.ts";

describe("input token cost", () => {
  it("prices input tokens at $0.042 per million", () => {
    expect(INPUT_TOKEN_USD_PER_MILLION).toBe(0.042);
    expect(estimateInputCostUsd(1_000_000)).toBe(0.042);
    expect(estimateInputCostUsd(0)).toBe(0);
    expect(estimateInputCostUsd(250_000)).toBeCloseTo(0.0105, 10);
  });
});

describe("quiet telemetry copy", () => {
  it("formats small costs without rounding them to zero dollars", () => {
    expect(formatReviewCost(0)).toBe("$0");
    expect(formatReviewCost(0.042)).toBe("$0.042");
    expect(formatReviewCost(0.000042)).toMatch(/^\$0\.0000/);
  });

  it("formats durations in milliseconds or seconds", () => {
    expect(formatDurationMs(48)).toBe("48 ms");
    expect(formatDurationMs(1500)).toBe("1.5 s");
  });
});
