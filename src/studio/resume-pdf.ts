const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const BODY_SIZE = 11;
const NAME_SIZE = 16;
const LINE_GAP = 4;
const MAX_LINE_WIDTH = PAGE_WIDTH - MARGIN * 2;

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text: string, fontSize: number): string[] {
  const width = Math.max(24, Math.floor(MAX_LINE_WIDTH / (fontSize * 0.5)));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let current = words[0] ?? "";
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (next.length <= width) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  lines.push(current);
  return lines;
}

function objectsToPdf(objects: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const header = "%PDF-1.4\n";
  const chunks: Uint8Array[] = [encoder.encode(header)];
  const offsets = [0];
  let cursor = header.length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(cursor);
    const body = `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    const bytes = encoder.encode(body);
    chunks.push(bytes);
    cursor += bytes.length;
  }
  const xrefStart = cursor;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let index = 1; index <= objects.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }
  const xref = `${xrefLines.join("\n")}\n`;
  chunks.push(encoder.encode(xref));
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(encoder.encode(trailer));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function pdfFromResumeText(text: string): Uint8Array {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  type Run = { text: string; size: number; font: "/F1" | "/F2" };
  const runs: Run[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index] ?? "";
    if (index === 0) {
      for (const wrapped of wrapLine(line, NAME_SIZE)) {
        runs.push({ text: wrapped, size: NAME_SIZE, font: "/F2" });
      }
      continue;
    }
    if (line.trim() === "") {
      runs.push({ text: "", size: BODY_SIZE, font: "/F1" });
      continue;
    }
    const heading = /^(summary|experience|skills|education|projects|contact)\b/i.test(line.trim());
    const size = heading ? 12 : BODY_SIZE;
    const font = heading || index === 1 ? "/F2" : "/F1";
    for (const wrapped of wrapLine(line, size)) {
      runs.push({ text: wrapped, size, font });
    }
  }

  const pages: Run[][] = [];
  let current: Run[] = [];
  let y = PAGE_HEIGHT - MARGIN;
  for (const run of runs) {
    const height = run.size + LINE_GAP;
    if (y - height < MARGIN) {
      pages.push(current);
      current = [];
      y = PAGE_HEIGHT - MARGIN;
    }
    current.push(run);
    y -= height;
  }
  if (current.length > 0 || pages.length === 0) {
    pages.push(current);
  }

  const pageCount = pages.length;
  const objects: string[] = [];
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  const pageIds = pages.map((_, index) => 3 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`);

  const fontRomanId = 3 + pageCount * 2;
  const fontBoldId = fontRomanId + 1;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageId = pageIds[pageIndex] ?? 3;
    const contentId = pageId + 1;
    const ops: string[] = ["BT", `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`];
    let lastFont = "";
    let lastSize = 0;
    let first = true;
    for (const run of pages[pageIndex] ?? []) {
      const fontCmd = `${run.font} ${run.size} Tf`;
      if (fontCmd !== `${lastFont} ${lastSize} Tf`) {
        ops.push(fontCmd);
        lastFont = run.font;
        lastSize = run.size;
      }
      if (!first) {
        ops.push(`0 -${run.size + LINE_GAP} Td`);
      }
      first = false;
      ops.push(`(${escapePdf(run.text)}) Tj`);
    }
    ops.push("ET");
    const stream = `${ops.join("\n")}\n`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRomanId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }

  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>`);
  return objectsToPdf(objects);
}

export function pdfBufferFromResumeText(text: string): ArrayBuffer {
  const bytes = pdfFromResumeText(text);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
