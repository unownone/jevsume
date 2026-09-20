import type { VisitorRecordResult, VisitorStore } from "./types.ts";

export const VISITOR_COUNT_KEY = "count";

function visitorIdKey(visitorId: string): string {
  return `vid:${visitorId}`;
}

function parseCount(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class KvVisitorStore implements VisitorStore {
  constructor(
    private readonly kv: KVNamespace,
    private readonly seedCount?: () => Promise<number>,
  ) {}

  async record(visitorId: string): Promise<VisitorRecordResult> {
    const existing = await this.kv.get(visitorIdKey(visitorId));
    if (existing !== null) {
      return { uniqueVisitors: await this.count(), created: false };
    }
    const uniqueVisitors = (await this.count()) + 1;
    await Promise.all([
      this.kv.put(visitorIdKey(visitorId), "1"),
      this.kv.put(VISITOR_COUNT_KEY, String(uniqueVisitors)),
    ]);
    return { uniqueVisitors, created: true };
  }

  async count(): Promise<number> {
    const stored = parseCount(await this.kv.get(VISITOR_COUNT_KEY));
    if (stored !== null) {
      return stored;
    }
    const seeded = (await this.seedCount?.()) ?? 0;
    await this.kv.put(VISITOR_COUNT_KEY, String(seeded));
    return seeded;
  }
}
