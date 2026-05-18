/**
 * Best-effort field extraction when a PDF has no AcroForm fields (e.g. flat listing agreement).
 * Used to augment listing-form parsing or recover when form parsing yields little data.
 */

export type PdfTextScrapePatch = Record<string, unknown>;

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function num(raw: unknown): number | null {
  const value = str(raw);
  if (!value) return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export async function extractPdfPlainText(buffer: Buffer, maxChars = 80_000): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("PDF buffer is empty.");
  }
  const header = buffer.slice(0, 5).toString("latin1");
  if (!header.startsWith("%PDF-")) {
    throw new Error("File does not appear to be a valid PDF (missing %PDF header).");
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const text = str(textResult.text).replace(/\s+/g, " ");
    return text.slice(0, maxChars);
  } finally {
    await parser.destroy?.();
  }
}

/**
 * Pull address / city / zip from common "City, ST 12345" patterns and standalone street lines.
 */
export function heuristicsFromPdfText(text: string): { patch: PdfTextScrapePatch; hints: { looksListingDoc: boolean; textSample: string } } {
  const patch: PdfTextScrapePatch = {};
  const upper = text.toUpperCase();

  const csz =
    text.match(
      /([0-9]{1,5}\s+[^,\n]{3,80}?)\s*,\s*([A-Za-z][A-Za-z\s]{2,40}?)\s*,\s*(CA|California)\s+(\d{5}(?:-\d{4})?)/i
    ) ||
    text.match(
      /([0-9]{1,5}\s+[^,\n]{3,80}?)\s*,\s*([A-Za-z][A-Za-z\s]{2,40}?)\s+(CA|California)\s+(\d{5}(?:-\d{4})?)/i
    );

  if (csz) {
    patch.address = csz[1].replace(/\s+/g, " ").trim();
    patch.city = csz[2].replace(/\s+/g, " ").trim();
    patch.zip = csz[4].replace(/\D/g, "").slice(0, 5);
  } else {
    const cityStateZip = text.match(
      /\b([A-Za-z][A-Za-z\s]{2,40}?)\s*,\s*(CA|California)\s+(\d{5}(?:-\d{4})?)\b/i
    );
    if (cityStateZip) {
      patch.city = cityStateZip[1].replace(/\s+/g, " ").trim();
      patch.zip = cityStateZip[3].replace(/\D/g, "").slice(0, 5);
    }
    const street = text.match(
      /\b(\d{1,5}\s+[NSEW]?\s*[A-Za-z0-9.\s]{3,60}?(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Road|Rd\.?|Way|Lane|Ln\.?|Court|Ct\.?))\b/i
    );
    if (street && !patch.address) patch.address = street[1].replace(/\s+/g, " ").trim();
  }

  const feeMatch = text.match(/(?:commission|broker(?:'|’)?s? fee)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (feeMatch) {
    const pct = num(feeMatch[1]);
    if (pct != null && pct > 0) {
      patch.feePercent = pct <= 1 ? pct * 100 : pct;
      patch.commissionRate = String(patch.feePercent);
    }
  }

  const lessor = text.match(/(?:lessor|sublessor|landlord)\s*[:#]?\s*([^\n]{3,120}?)(?=\s{2,}|\s+lessee|\s+tenant|$)/i);
  const lessee = text.match(/(?:lessee|tenant)\s*[:#]?\s*([^\n]{3,120}?)(?=\s{2,}|\s+lessor|\s+landlord|$)/i);
  if (lessor) patch.lessorName = lessor[1].replace(/\s+/g, " ").trim();
  if (lessee) patch.lesseeName = lessee[1].replace(/\s+/g, " ").trim();
  if (patch.lessorName || patch.lesseeName) {
    patch.clientCo = str(patch.lessorName);
    patch.oppositeCo = str(patch.lesseeName);
  }

  const start = text.match(/(?:commencement|start)\s*date\s*[:#]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  const end = text.match(/(?:expiration|expiry|end)\s*date\s*[:#]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (start) patch.startDate = start[1];
  if (end) patch.endDate = end[1];

  const looksListingDoc =
    /listing agreement|exclusive agency|exclusive right to (?:lease|sell)|listing brokerage/i.test(text) ||
    (upper.includes("FOR LEASE") && upper.includes("PREMISES"));

  return {
    patch,
    hints: { looksListingDoc, textSample: text.slice(0, 280) },
  };
}

/** Merge scraped fields without overwriting non-empty destination keys (except _debug/meta). */
export function mergeScrapePatches(base: PdfTextScrapePatch, extra: PdfTextScrapePatch): PdfTextScrapePatch {
  const out: PdfTextScrapePatch = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (key.startsWith("_")) {
      out[key] = value;
      continue;
    }
    const current = out[key];
    const empty =
      current === undefined ||
      current === null ||
      current === "" ||
      (Array.isArray(current) && current.length === 0);
    if (empty && value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}
