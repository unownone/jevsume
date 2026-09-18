export const RATE_LIMIT_CHECKPOINTS = {
  resumeReview: {
    limit: 10,
    windowMs: 60_000,
    label: "resume reviews",
  },
  personaCreation: {
    limit: 5,
    windowMs: 60_000,
    label: "persona creations",
  },
} as const;

export type RateLimitCheckpoint = keyof typeof RATE_LIMIT_CHECKPOINTS;

export type RateLimitErrorBody = {
  error: string;
  code: "rate_limited";
  checkpoint: RateLimitCheckpoint;
  limit: number;
  windowSeconds: number;
  retryAfterSeconds: number;
  resetAt: string;
};

export function rateLimitTitle(checkpoint: RateLimitCheckpoint): string {
  switch (checkpoint) {
    case "resumeReview":
      return "Resume review limit";
    case "personaCreation":
      return "Persona creation limit";
    default: {
      const _exhaustive: never = checkpoint;
      return _exhaustive;
    }
  }
}

export function secondsUntil(resetAt: string, nowMs = Date.now()): number {
  const resetMs = Date.parse(resetAt);
  if (Number.isNaN(resetMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((resetMs - nowMs) / 1000));
}

export function formatClockTime(resetAt: string): string {
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) {
    return resetAt;
  }
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatRateLimitCopy(input: {
  checkpoint: RateLimitCheckpoint;
  limit: number;
  resetAt: string;
  nowMs?: number;
}): string {
  const checkpoint = RATE_LIMIT_CHECKPOINTS[input.checkpoint];
  const seconds = secondsUntil(input.resetAt, input.nowMs ?? Date.now());
  const when = formatClockTime(input.resetAt);
  if (seconds <= 0) {
    return `Your ${checkpoint.label} limit has reset. You can try again.`;
  }
  return `Too many ${checkpoint.label} from this network (${input.limit} per minute). Try again in ${seconds}s — restores at ${when}.`;
}

export function isRateLimitCheckpoint(value: unknown): value is RateLimitCheckpoint {
  return typeof value === "string" && Object.hasOwn(RATE_LIMIT_CHECKPOINTS, value);
}

export function isRateLimitErrorBody(value: unknown): value is RateLimitErrorBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    body.code === "rate_limited" &&
    isRateLimitCheckpoint(body.checkpoint) &&
    typeof body.error === "string" &&
    typeof body.resetAt === "string" &&
    typeof body.retryAfterSeconds === "number" &&
    typeof body.limit === "number"
  );
}
