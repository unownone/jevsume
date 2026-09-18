import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimitError, createPersona, generalReview } from "../src/lib/api.ts";

describe("API client rate limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws RateLimitError with restore time when a review is 429'd", async () => {
    const resetAt = "2026-09-17T21:50:00.000Z";
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            error: "Too many resume reviews from this network (10 per minute). Try again in 42s.",
            code: "rate_limited",
            checkpoint: "resumeReview",
            limit: 10,
            windowSeconds: 60,
            retryAfterSeconds: 42,
            resetAt,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
    );

    const error = await generalReview("resume").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({
      checkpoint: "resumeReview",
      resetAt,
      retryAfterSeconds: 42,
      limit: 10,
    });
  });

  it("throws RateLimitError when persona creation is 429'd", async () => {
    const resetAt = "2026-09-17T21:51:00.000Z";
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            error: "Too many persona creations",
            code: "rate_limited",
            checkpoint: "personaCreation",
            limit: 5,
            windowSeconds: 60,
            retryAfterSeconds: 18,
            resetAt,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
    );

    const error = await createPersona({
      title: "Staff",
      tags: [],
      jobDescription: "Go",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({
      checkpoint: "personaCreation",
      resetAt,
      retryAfterSeconds: 18,
    });
  });
});
