export function formatJevScore(value: number): string {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  if (clamped >= 100) {
    return "100";
  }
  return String(clamped).padStart(2, "0");
}

export function scoreTone(value: number): "low" | "mid" | "high" {
  if (value < 55) {
    return "low";
  }
  if (value < 80) {
    return "mid";
  }
  return "high";
}

export function formatReviewCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) {
    return "$0";
  }
  if (usd >= 1) {
    return `$${usd.toFixed(2)}`;
  }
  let digits = 3;
  let value = usd.toFixed(digits);
  while (Number(value) === 0 && digits < 8) {
    digits += 1;
    value = usd.toFixed(digits);
  }
  return `$${value.replace(/0+$/, "").replace(/\.$/, "")}`;
}

export function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  return Math.round(value).toLocaleString("en-US");
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0 ms";
  }
  if (ms < 1) {
    return "<1 ms";
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}
