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
  consume(
    checkpoint: RateLimitCheckpoint,
    ip: string,
  ): RateLimitDecision | Promise<RateLimitDecision>;
};

export const RATE_LIMIT_BINDING_NAMES = {
  resumeReview: "RATE_LIMIT_RESUME_REVIEW",
  personaCreation: "RATE_LIMIT_PERSONA_CREATION",
  resumeStore: "RATE_LIMIT_RESUME_STORE",
  visitorRecord: "RATE_LIMIT_VISITOR",
} as const satisfies Record<RateLimitCheckpoint, keyof CloudflareBindings>;

function isRateLimitBinding(value: unknown): value is RateLimit {
  return (
    typeof value === "object" &&
    value !== null &&
    "limit" in value &&
    typeof (value as RateLimit).limit === "function"
  );
}

/**
 * Prefer the Workers Rate Limiting binding (shared per Cloudflare location)
 * so limits survive isolate recycling. Fall back to in-memory when unbound.
 */
export class EnvRateLimiter implements RateLimiter {
  constructor(
    private readonly env: object,
    private readonly fallback: RateLimiter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async consume(checkpoint: RateLimitCheckpoint, ip: string): Promise<RateLimitDecision> {
    const binding = Reflect.get(this.env, RATE_LIMIT_BINDING_NAMES[checkpoint]);
    if (!isRateLimitBinding(binding)) {
      return this.fallback.consume(checkpoint, ip);
    }
    const config = RATE_LIMIT_CHECKPOINTS[checkpoint];
    const { success } = await binding.limit({ key: ip });
    const now = this.now();
    const resetAt = new Date(now + config.windowMs).toISOString();
    if (!success) {
      return {
        ok: false,
        checkpoint,
        limit: config.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(config.windowMs / 1000)),
        resetAt,
      };
    }
    return {
      ok: true,
      checkpoint,
      limit: config.limit,
      remaining: config.limit,
      resetAt,
    };
  }
}

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
