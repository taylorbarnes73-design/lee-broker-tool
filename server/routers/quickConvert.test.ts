import { describe, expect, it } from "vitest";
import { quickConvertRouter } from "./quickConvert";
import { isQuickConvertKind } from "@shared/quickConvert";

describe("quickConvert router", () => {
  it("registers status and process procedures", () => {
    const names = Object.keys(quickConvertRouter._def.procedures);
    expect(names).toContain("status");
    expect(names).toContain("processUploaded");
    expect(names).toContain("processStoredFile");
  });

  it("accepts known conversion kinds", () => {
    expect(isQuickConvertKind("to_pdf")).toBe(true);
    expect(isQuickConvertKind("letterhead")).toBe(true);
    expect(isQuickConvertKind("lease_to_voucher")).toBe(true);
  });
});
