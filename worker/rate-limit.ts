import {
  formatRateLimitCopy,
  RATE_LIMIT_CHECKPOINTS,
  type RateLimitCheckpoint,
} from "../shared/rate-limit.ts";

export type RateLimitDecision =
  | {
      ok: true;
      checkpoint: RateLimitCheckpoint;
      limit: number;
      remaining: number;
      resetAt: string;
    }
  | {
      ok: false;
      checkpoint: RateLimitCheckpoint;
      limit: number;
      remaining: 0;
      retryAfterSeconds: number;
      resetAt: string;
    };

export type RateLimiter = {
  consume(checkpoint: RateLimitCheckpoint, ip: string): RateLimitDecision;
};

export class RateLimitedError extends Error {
  readonly status = 429 as const;

  constructor(readonly decision: Extract<RateLimitDecision, { ok: false }>) {
    super(
      formatRateLimitCopy({
        checkpoint: decision.checkpoint,
        limit: decision.limit,
        resetAt: decision.resetAt,
        nowMs: Date.parse(decision.resetAt) - decision.retryAfterSeconds * 1000,
      }),
    );
    this.name = "RateLimitedError";
  }
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  consume(checkpoint: RateLimitCheckpoint, ip: string): RateLimitDecision {
    const config = RATE_LIMIT_CHECKPOINTS[checkpoint];
    const now = this.now();
    const key = `${checkpoint}:${ip}`;
    const cutoff = now - config.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((stamp) => stamp > cutoff);

    if (recent.length >= config.limit) {
      const resetAtMs = (recent[0] ?? now) + config.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
      this.hits.set(key, recent);
      return {
        ok: false,
        checkpoint,
        limit: config.limit,
        remaining: 0,
        retryAfterSeconds,
        resetAt: new Date(resetAtMs).toISOString(),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return {
      ok: true,
      checkpoint,
      limit: config.limit,
      remaining: config.limit - recent.length,
      resetAt: new Date((recent[0] ?? now) + config.windowMs).toISOString(),
    };
  }
}
