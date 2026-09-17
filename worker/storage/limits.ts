export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(limit)));
}
