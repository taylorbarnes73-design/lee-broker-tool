import { describe, expect, it } from "vitest";
import { percentPointsToFraction } from "@shared/commissionPercent";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards the assets the native React voucher export depends on
 * (client/src/lib/voucherExcel.ts). Replaces the template/percent checks that
 * used to live in the now-removed broker_tool.html wiring test.
 */
describe("commission voucher Excel template", () => {
  const templatePath = resolve(process.cwd(), "client/public/templates/commission-voucher-template.xlsm");

  it("ships the macro-enabled .xlsm template for client-side export", () => {
    expect(existsSync(templatePath)).toBe(true);
    const bytes = readFileSync(templatePath);
    // ZIP local-file-header magic ("PK") — .xlsm is a ZIP container.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("contains a worksheet the cell-patcher can target", () => {
    // The patcher rewrites xl/worksheets/sheet1.xml in place; confirm it exists
    // in the package (stored as a path string inside the ZIP central directory).
    const raw = readFileSync(templatePath).toString("latin1");
    expect(raw).toContain("xl/worksheets/sheet1.xml");
  });
});

describe("voucher percent → Excel fraction", () => {
  // Voucher % fields are percent points. Excel percent cells (M43, K53) store the fraction.
  it("converts percent points, including 1%, into Excel fractions", () => {
    expect(percentPointsToFraction("6")).toBe(0.06);
    expect(percentPointsToFraction("50")).toBe(0.5);
    expect(percentPointsToFraction("1")).toBe(0.01);
    expect(percentPointsToFraction("0.75")).toBe(0.0075);
    expect(percentPointsToFraction("100")).toBe(1);
  });
});
