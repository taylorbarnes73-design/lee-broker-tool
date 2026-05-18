import { describe, expect, it } from "vitest";
import { parseListingFormPdfBuffer } from "./listingFormPdf";
import { extractPdfPlainText } from "./pdfTextScrape";

describe("parseListingFormPdfBuffer - invalid input handling", () => {
  it("rejects an empty buffer with a clear error", async () => {
    await expect(parseListingFormPdfBuffer(Buffer.alloc(0))).rejects.toThrow(/empty/i);
  });

  it("rejects a non-PDF buffer (e.g. HTML) without crashing the parser", async () => {
    const html = Buffer.from("<html><body>not a pdf</body></html>", "utf8");
    await expect(parseListingFormPdfBuffer(html)).rejects.toThrow(/PDF/i);
  });

  it("rejects a buffer with the wrong magic bytes", async () => {
    const xlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); // ZIP/xlsx header
    await expect(parseListingFormPdfBuffer(xlsx)).rejects.toThrow(/PDF/i);
  });
});

describe("extractPdfPlainText - invalid input handling", () => {
  it("rejects an empty buffer", async () => {
    await expect(extractPdfPlainText(Buffer.alloc(0))).rejects.toThrow(/empty/i);
  });

  it("rejects a non-PDF buffer", async () => {
    const html = Buffer.from("<html></html>", "utf8");
    await expect(extractPdfPlainText(html)).rejects.toThrow(/PDF/i);
  });
});
