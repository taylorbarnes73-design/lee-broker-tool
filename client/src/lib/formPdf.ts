import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Generic sectioned PDF generator (pdf-lib) shared by the native broker forms
 * (Sign Orders, Listing Entry, …). Renders a branded header, a list of
 * label/value sections, and an optional table (e.g. participating agents).
 * Produced fully client-side; returns a Blob plus base64 for the
 * `email.sendToAdmin` pdfAttachment payload.
 */

export type PdfSection = {
  title: string;
  fields: Array<{ label: string; value: string }>;
};

export type PdfTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type GeneratedPdf = {
  blob: Blob;
  base64Data: string;
  filename: string;
  mimeType: "application/pdf";
};

export type SectionedPdfInput = {
  title: string;
  sections: PdfSection[];
  table?: PdfTable;
  propertyAddress: string;
  filenamePrefix: string;
};

const LEE_RED = rgb(0.596, 0, 0.18); // #98002E
const INK = rgb(0.188, 0.235, 0.259); // #303C42
const MUTED = rgb(0.49, 0.5, 0.51);
const RULE = rgb(0.83, 0.82, 0.79);

/** pdf-lib StandardFonts use WinAnsi; strip anything that can't encode. */
function ascii(text: string): string {
  return String(text ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildSectionedPdf(input: SectionedPdfInput): Promise<GeneratedPdf> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 54;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const sectionHeading = (text: string) => {
    ensureSpace(28);
    page.drawText(ascii(text).toUpperCase(), { x: MARGIN, y, size: 10.5, font: bold, color: INK });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE });
    y -= 16;
  };

  // Header
  page.drawText("Lee & Associates Newport Beach", { x: MARGIN, y, size: 13, font: bold, color: INK });
  y -= 16;
  page.drawText("Commercial Real Estate Services", { x: MARGIN, y, size: 9, font, color: MUTED });
  y -= 24;
  page.drawText(ascii(input.title), { x: MARGIN, y, size: 18, font: bold, color: LEE_RED });
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: LEE_RED });
  y -= 22;

  // Sections
  for (const section of input.sections) {
    const visible = section.fields.filter(f => String(f.value ?? "").trim());
    if (!visible.length) continue;
    sectionHeading(section.title);
    for (const f of visible) {
      const label = `${ascii(f.label)}: `;
      const labelW = bold.widthOfTextAtSize(label, 10);
      const valueLines = wrap(f.value, font, 10, CONTENT_W - labelW);
      ensureSpace(valueLines.length * 14);
      page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: INK });
      valueLines.forEach((ln, i) => {
        page.drawText(ln, { x: MARGIN + labelW, y: y - i * 14, size: 10, font, color: INK });
      });
      y -= valueLines.length * 14 + 4;
    }
    y -= 10;
  }

  // Optional table
  if (input.table && input.table.rows.length) {
    const { title, columns, rows } = input.table;
    sectionHeading(title);
    const colW = CONTENT_W / columns.length;
    columns.forEach((c, i) => {
      page.drawText(ascii(c), { x: MARGIN + i * colW, y, size: 9, font: bold, color: MUTED });
    });
    y -= 14;
    for (const row of rows) {
      ensureSpace(14);
      row.forEach((cell, i) => {
        page.drawText(ascii(cell) || "-", { x: MARGIN + i * colW, y, size: 10, font, color: INK });
      });
      y -= 14;
    }
    y -= 10;
  }

  // Footer on the last page
  const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  page.drawText(`Generated ${generated} · Lee & Associates Newport Beach`, {
    x: MARGIN,
    y: MARGIN - 18,
    size: 8,
    font,
    color: MUTED,
  });

  const bytes = await doc.save();
  // Copy into a plain ArrayBuffer so the Blob part type is satisfied under
  // strict lib.dom typings (pdf-lib returns Uint8Array<ArrayBufferLike>).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const safeAddress =
    ascii(input.propertyAddress).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") ||
    input.filenamePrefix;
  return {
    blob,
    base64Data: uint8ToBase64(bytes),
    filename: `${input.filenamePrefix}_${safeAddress}.pdf`,
    mimeType: "application/pdf",
  };
}
