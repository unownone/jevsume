import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ExtractResult = {
  text: string;
  source: "pdf" | "docx" | "paste";
  filename?: string;
};

export async function extractFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const text = await extractPdf(await file.arrayBuffer());
    return { text, source: "pdf", filename: file.name };
  }
  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: result.value, source: "docx", filename: file.name };
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return { text: await file.text(), source: "paste", filename: file.name };
  }
  throw new Error("Use a PDF, DOCX, or plain-text file — or paste the text.");
}

async function extractPdf(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(line);
  }
  return pages.join("\n");
}
