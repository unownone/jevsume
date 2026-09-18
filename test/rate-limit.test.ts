import { describe, expect, it } from "vitest";
import { RATE_LIMIT_CHECKPOINTS } from "../shared/rate-limit.ts";
import { MemoryRateLimiter } from "../worker/rate-limit.ts";

describe("MemoryRateLimiter", () => {
  it("denies the 11th resume review from the same IP and reports when the window restores", () => {
    let now = 1_700_000_000_000;
    const limiter = new MemoryRateLimiter(() => now);
    const ip = "203.0.113.10";

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit; i += 1) {
      const allowed = limiter.consume("resumeReview", ip);
      expect(allowed.ok).toBe(true);
    }

    const denied = limiter.consume("resumeReview", ip);
    expect(denied.ok).toBe(false);
    if (denied.ok) {
      throw new Error("expected denial");
    }
    expect(denied.retryAfterSeconds).toBe(60);
    expect(denied.resetAt).toBe(new Date(now + 60_000).toISOString());
    expect(denied.limit).toBe(10);
    expect(denied.checkpoint).toBe("resumeReview");
  });

  it("allows another resume review after the oldest hit leaves the one-minute window", () => {
    let now = 1_700_000_000_000;
    const limiter = new MemoryRateLimiter(() => now);
    const ip = "203.0.113.10";

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit; i += 1) {
      limiter.consume("resumeReview", ip);
    }

    now += 20_000;
    const stillDenied = limiter.consume("resumeReview", ip);
    expect(stillDenied.ok).toBe(false);
    if (stillDenied.ok) {
      throw new Error("expected denial");
    }
    expect(stillDenied.retryAfterSeconds).toBe(40);

    now += 40_001;
    const restored = limiter.consume("resumeReview", ip);
    expect(restored.ok).toBe(true);
  });

  it("tracks IPs independently and does not share budget across checkpoints", () => {
    const limiter = new MemoryRateLimiter(() => 1_700_000_000_000);

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.resumeReview.limit; i += 1) {
      expect(limiter.consume("resumeReview", "203.0.113.10").ok).toBe(true);
    }
    expect(limiter.consume("resumeReview", "203.0.113.10").ok).toBe(false);
    expect(limiter.consume("resumeReview", "198.51.100.8").ok).toBe(true);

    for (let i = 0; i < RATE_LIMIT_CHECKPOINTS.personaCreation.limit; i += 1) {
      expect(limiter.consume("personaCreation", "203.0.113.10").ok).toBe(true);
    }
    expect(limiter.consume("personaCreation", "203.0.113.10").ok).toBe(false);
  });
});
