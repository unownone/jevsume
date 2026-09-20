import type { GlyphBox, PageBox } from "./types.ts";

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

export function boxForNeedle(glyphs: GlyphBox[], needle: string): PageBox | null {
  const target = needle.toLowerCase().replace(/\s+/g, " ").trim();
  if (!target) {
    return null;
  }
  const pages = new Map<number, GlyphBox[]>();
  for (const glyph of glyphs) {
    const list = pages.get(glyph.page) ?? [];
    list.push(glyph);
    pages.set(glyph.page, list);
  }
  for (const [, items] of pages) {
    const parts = items.map((item) => item.str.replace(/\s+/g, " ").trim());
    const haystack = parts.join(" ").toLowerCase();
    const startAt = haystack.indexOf(target);
    if (startAt === -1) {
      continue;
    }
    const endAt = startAt + target.length;
    const covered: GlyphBox[] = [];
    let cursor = 0;
    for (let index = 0; index < items.length; index += 1) {
      const length = parts[index]?.length ?? 0;
      const start = cursor;
      const end = cursor + length;
      if (end > startAt && start < endAt) {
        const item = items[index];
        if (item) {
          covered.push(item);
        }
      }
      cursor = end + 1;
    }
    const box = unionBoxes(covered);
    if (box) {
      return box;
    }
  }
  return null;
}

export function padBox(box: PageBox, dx = 0.6, dy = 0.35): PageBox {
  return {
    page: box.page,
    x: Math.max(0, box.x - dx),
    y: Math.max(0, box.y - dy),
    w: Math.min(100 - Math.max(0, box.x - dx), box.w + dx * 2),
    h: Math.min(100 - Math.max(0, box.y - dy), box.h + dy * 2),
  };
}
