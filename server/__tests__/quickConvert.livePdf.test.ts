/**
 * Live PDF validation for Quick Convert (optional).
 *
 * Run when API keys are configured:
 *   QUICK_CONVERT_LIVE_PDF=1 corepack pnpm test server/__tests__/quickConvert.livePdf.test.ts
 *
 * PDF paths (override with env):
 *   QUICK_CONVERT_LEASE_PDF
 *   QUICK_CONVERT_EXCLUSIVE_PDF
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapContractExtractionToVoucherFields,
  normalizeSignExtractFields,
} from "@shared/quickConvert";
import { contractsRouter } from "../routers/contracts";
import { aiAssistRouter } from "../routers/aiAssist";

const live = process.env.QUICK_CONVERT_LIVE_PDF === "1";
const leasePdf =
  process.env.QUICK_CONVERT_LEASE_PDF ||
  "/Users/taylorbarnes/Downloads/KAEV Corporation,- 2961 W MacArthur - Multi Tenant Lease Gross.pdf";
const exclusivePdf =
  process.env.QUICK_CONVERT_EXCLUSIVE_PDF ||
  "/Users/taylorbarnes/Downloads/16520 Bake Pkwy Ste 115 - Exclusive Right to Represent Owner.pdf";

function localUploadUrl(absPath: string, basename: string): string {
  const dir = path.join(process.cwd(), "local-uploads", "quick-convert-live");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, basename);
  writeFileSync(dest, readFileSync(absPath));
  return `/local-uploads/quick-convert-live/${basename}`;
}

async function callContractExtract(pdfUrl: string) {
  const procedure = contractsRouter._def.procedures.extractContract;
  const resolver = (procedure as { _def: { resolver: (opts: { input: unknown; ctx: unknown }) => unknown } })
    ._def.resolver;
  return resolver({
    input: { pdfUrl, contractType: "Lease Agreement" },
    ctx: {},
  }) as Promise<{ success: boolean; data: Record<string, unknown> | null; error: string | null }>;
}

async function callSignExtract(fileUrl: string) {
  const caller = aiAssistRouter.createCaller({} as never);
  return caller.extractDocument({
    fileUrl,
    mimeType: "application/pdf",
    tab: "sign",
  });
}

describe.skipIf(!live)("quickConvert live PDF extraction", () => {
  it("extractContract + voucher mapping on KAEV lease PDF", async () => {
    const pdfUrl = localUploadUrl(leasePdf, "kaev-lease.pdf");
    const result = await callContractExtract(pdfUrl);
    expect(result.success, result.error ?? "extract failed").toBe(true);
    expect(result.data).toBeTruthy();
    const mapped = mapContractExtractionToVoucherFields(result.data!);
    expect(mapped.city).toMatch(/Santa Ana/i);
    expect(mapped.lesseeName).toMatch(/KAEV/i);
    expect(mapped.commencementDate).toBe("2026-05-01");
  }, 120_000);

  it("extractDocument(sign) + normalize on Bake exclusive PDF", async () => {
    const fileUrl = localUploadUrl(exclusivePdf, "bake-exclusive.pdf");
    const result = await callSignExtract(fileUrl);
    expect(result.success, result.error ?? "extract failed").toBe(true);
    const mapped = normalizeSignExtractFields((result.fields || {}) as Record<string, unknown>);
    expect(mapped.city).toMatch(/Irvine/i);
    expect(mapped.propertyAddress).toMatch(/16520/i);
    expect(mapped.requestedBy).toMatch(/Madigan/i);
  }, 120_000);
});
