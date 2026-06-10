import express from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  requireBundledAssetPath,
  requireCommissionVoucherTemplatePath,
  resolveBundledAssetPath,
} from "./lib/bundledAssets";
import { fillMarketingRequestPdf, resolveMarketingRequestTemplatePath } from "./services/marketingRequestPdf";

function isZipBuffer(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).toString("utf8") === "%PDF";
}

describe("bundled export assets", () => {
  it("resolves commission voucher, marketing PDF, and letterhead templates on disk", () => {
    const voucherPath = requireCommissionVoucherTemplatePath();
    expect(voucherPath).toMatch(/commission-voucher-template\.xlsm$/);
    expect(isZipBuffer(readFileSync(voucherPath))).toBe(true);

    const marketingPath = resolveMarketingRequestTemplatePath();
    expect(marketingPath).toMatch(/marketing-project-request-fillable\.pdf$/);
    expect(isPdfBuffer(readFileSync(marketingPath))).toBe(true);

    const letterheadPath = requireBundledAssetPath("templates/lanb-letterhead.dotx");
    expect(existsSync(letterheadPath)).toBe(true);
  });

  it("finds voucher template via dist/public after production build output", () => {
    const distTemplate = path.join(
      process.cwd(),
      "dist/public/templates/commission-voucher-template.xlsm"
    );
    if (!existsSync(distTemplate)) return;

    expect(resolveBundledAssetPath("templates/commission-voucher-template.xlsm")).toBe(
      distTemplate
    );
  });

  it("serves voucher template bytes with Excel MIME type (not SPA HTML)", async () => {
    const templatePath = requireCommissionVoucherTemplatePath();
    const app = express();
    app.get("/templates/commission-voucher-template.xlsm", (_req, res) => {
      res.setHeader("Content-Type", "application/vnd.ms-excel.sheet.macroEnabled.12");
      res.sendFile(templatePath);
    });

    const res = await request(app)
      .get("/templates/commission-voucher-template.xlsm")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"]).toLowerCase()).toContain(
      "application/vnd.ms-excel.sheet.macroenabled.12"
    );
    expect(isZipBuffer(res.body as Buffer)).toBe(true);
    expect((res.body as Buffer).subarray(0, 15).toString("utf8")).not.toContain("<!doctype");
  });
  it("fills marketing PDF template bytes directly", async () => {
    const bytes = await fillMarketingRequestPdf({
      requesterName: "Chris Barnett",
      email: "cbarnett@lee-associates.com",
      projectTitle: "Route test",
      requestType: "Flyer / brochure",
      priority: "Normal",
      objective: "Smoke test",
      dueDate: "2026-06-20",
    });
    expect(isPdfBuffer(Buffer.from(bytes))).toBe(true);
  });
});
