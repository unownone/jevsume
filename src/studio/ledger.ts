import { clusterLines, unionBoxes } from "./boxes.ts";
import type { GlyphBox, LedgerRun, PageBox } from "./types.ts";

export type FlattenedPage = {
  text: string;
  ledger: LedgerRun[];
  glyphs: GlyphBox[];
};

export function flattenGlyphs(glyphs: GlyphBox[]): FlattenedPage {
  const visual = [...glyphs].sort((left, right) => left.page - right.page || left.y - right.y || left.x - right.x);
  const lines = clusterLines(visual);
  const ledger: LedgerRun[] = [];
  const parts: string[] = [];
  let cursor = 0;
  let lastPage = 1;
  for (const line of lines) {
    const page = line[0]?.page ?? lastPage;
    if (parts.length > 0) {
      const sep = page !== lastPage ? "\n" : "\n";
      parts.push(sep);
      ledger.push({
        page,
        str: sep,
        flatStart: cursor,
        flatEnd: cursor + sep.length,
        box: null,
      });
      cursor += sep.length;
    }
    lastPage = page;
    const tokens = line.map((item) => item.str.replace(/\s+/g, " ").trim()).filter(Boolean);
    for (let index = 0; index < tokens.length; index += 1) {
      if (index > 0) {
        parts.push(" ");
        ledger.push({
          page,
          str: " ",
          flatStart: cursor,
          flatEnd: cursor + 1,
          box: null,
        });
        cursor += 1;
      }
      const token = tokens[index] ?? "";
      const glyph = line[index];
      parts.push(token);
      ledger.push({
        page,
        str: token,
        flatStart: cursor,
        flatEnd: cursor + token.length,
        box: glyph
          ? { page: glyph.page, x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h }
          : null,
      });
      cursor += token.length;
    }
  }
  return {
    text: parts.join(""),
    ledger,
    glyphs: visual,
  };
}

export function boxForSpan(ledger: LedgerRun[], start: number, end: number): PageBox | null {
  const hits: PageBox[] = [];
  for (const run of ledger) {
    if (!run.box || run.flatEnd <= start || run.flatStart >= end) {
      continue;
    }
    hits.push(run.box);
  }
  return unionBoxes(hits);
}
