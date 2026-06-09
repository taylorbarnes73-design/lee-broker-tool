import { describe, expect, it } from "vitest";
import {
  mapContractExtractionToVoucherFields,
  validateQuickConvertUpload,
} from "@shared/quickConvert";
import {
  BUNDLED_LETTERHEAD_DOTX,
  resolveSofficePath,
  validatePdfBytes,
} from "./quickConvert";
import fs from "node:fs/promises";

describe("quickConvert service", () => {
  it("exposes bundled letterhead dotx template in repo", async () => {
    await expect(fs.access(BUNDLED_LETTERHEAD_DOTX)).resolves.toBeUndefined();
  });

  it("reports soffice availability without throwing", () => {
    expect(resolveSofficePath() === null || typeof resolveSofficePath() === "string").toBe(true);
  });

  it("reuses shared contract field mapping", () => {
    const fields = mapContractExtractionToVoucherFields({
      propAddress: "1 Main",
      propCity: "Newport Beach",
      propState: "CA",
      mlLessee: "Tenant",
    });
    expect(fields.address).toBe("1 Main");
    expect(fields.city).toBe("Newport Beach");
    expect(fields.clientName).toBe("Tenant");
  });

  it("validates upload constraints used by router", () => {
    expect(
      validateQuickConvertUpload({
        filename: "x.pdf",
        mimeType: "application/pdf",
        byteLength: 100,
      }).ok
    ).toBe(true);
  });

  it("rejects empty PDF buffers", async () => {
    const result = await validatePdfBytes(Buffer.alloc(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("empty");
  });

  it("rejects non-PDF buffers", async () => {
    const result = await validatePdfBytes(Buffer.from("hello"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("valid PDF");
  });

  it("accepts a minimal one-page PDF", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = Buffer.from(await doc.save());
    const result = await validatePdfBytes(bytes);
    expect(result.ok).toBe(true);
  });
});
