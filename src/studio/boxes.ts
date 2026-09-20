import type { GlyphBox, LedgerRun, PageBox } from "./types.ts";

export function unionBoxes(boxes: PageBox[]): PageBox | null {
  if (boxes.length === 0) {
    return null;
  }
  const page = boxes[0]?.page ?? 1;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const box of boxes) {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  }
  return {
    page,
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
  };
}

export function isPlausibleGlyph(box: PageBox): boolean {
  return (
    box.w >= 0.12 &&
    box.w <= 90 &&
    box.h >= 0.25 &&
    box.h <= 5 &&
    box.x >= -2 &&
    box.x <= 102 &&
    box.y >= -2 &&
    box.y <= 102
  );
}

export function isPlausibleBox(box: PageBox): boolean {
  return box.w >= 0.4 && box.w <= 98 && box.h >= 0.35 && box.h <= 4.2 && box.x >= -1 && box.x <= 99 && box.y >= -1 && box.y <= 99;
}

function medianY(items: GlyphBox[]): number {
  const values = items.map((item) => item.y).sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)] ?? 0;
}

export function clusterLines(items: GlyphBox[]): GlyphBox[][] {
  const sorted = [...items].sort((left, right) => left.page - right.page || left.y - right.y || left.x - right.x);
  const lines: GlyphBox[][] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const seed = last?.[0];
    const baseline = last ? medianY(last) : item.y;
    const lineHeight = seed ? Math.max(item.h, seed.h) : item.h;
    const tolerance = Math.max(0.55, lineHeight * 0.65);
    if (last && seed && item.page === seed.page && Math.abs(item.y - baseline) < tolerance) {
      last.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

export type NeedleOptions = {
  occurrence?: "first" | "last";
  minY?: number;
  maxY?: number;
};

function haystackHit(haystack: string, target: string, occurrence: "first" | "last"): number {
  if (occurrence === "last") {
    return haystack.lastIndexOf(target);
  }
  return haystack.indexOf(target);
}

export function boxForNeedle(glyphs: GlyphBox[], needle: string, options: NeedleOptions = {}): PageBox | null {
  const target = needle.toLowerCase().replace(/\s+/g, " ").trim();
  if (!target) {
    return null;
  }
  const occurrence = options.occurrence ?? "first";
  const pages = new Map<number, GlyphBox[]>();
  for (const glyph of glyphs) {
    if (options.minY !== undefined && glyph.y < options.minY) {
      continue;
    }
    if (options.maxY !== undefined && glyph.y > options.maxY) {
      continue;
    }
    const list = pages.get(glyph.page) ?? [];
    list.push(glyph);
    pages.set(glyph.page, list);
  }
  const pageEntries = [...pages.entries()].sort((left, right) => left[0] - right[0]);
  if (occurrence === "last") {
    pageEntries.reverse();
  }
  for (const [, items] of pageEntries) {
    const visual = [...items].sort((left, right) => left.y - right.y || left.x - right.x);
    const parts = visual.map((item) => item.str.replace(/\s+/g, " ").trim());
    const haystack = parts.join(" ").toLowerCase();
    const startAt = haystackHit(haystack, target, occurrence);
    if (startAt === -1) {
      continue;
    }
    const endAt = startAt + target.length;
    const covered: GlyphBox[] = [];
    let cursor = 0;
    for (let index = 0; index < visual.length; index += 1) {
      const length = parts[index]?.length ?? 0;
      const start = cursor;
      const end = cursor + length;
      if (end > startAt && start < endAt) {
        const item = visual[index];
        if (item) {
          covered.push(item);
        }
      }
      cursor = end + 1;
    }
    const lines = clusterLines(covered);
    const ranked = [...lines].sort((left, right) => right.length - left.length);
    const box = unionBoxes(ranked[0] ?? []);
    if (box && isPlausibleBox(box)) {
      return box;
    }
  }
  return null;
}

export function boxesForLedgerRange(ledger: LedgerRun[], start: number, end: number): PageBox[] {
  if (!(end > start)) {
    return [];
  }
  const hits: PageBox[] = [];
  for (const run of ledger) {
    if (run.flatEnd <= start || run.flatStart >= end) {
      continue;
    }
    if (!run.box) {
      continue;
    }
    hits.push(run.box);
  }
  return hits;
}

export function padBox(box: PageBox, dx = 0.45, dy = 0.22): PageBox {
  const padded = {
    page: box.page,
    x: Math.max(0, box.x - dx),
    y: Math.max(0, box.y - dy),
    w: Math.min(100 - Math.max(0, box.x - dx), box.w + dx * 2),
    h: Math.min(100 - Math.max(0, box.y - dy), box.h + dy * 2),
  };
  return {
    ...padded,
    h: Math.min(padded.h, 3.8),
  };
}
