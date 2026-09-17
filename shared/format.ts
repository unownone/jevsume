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
