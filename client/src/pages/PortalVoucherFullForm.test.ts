import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PortalVoucherFullForm submission handling", () => {
  it("checks the sendToAdmin result before showing voucher submission success", () => {
    const source = readFileSync(new URL("./PortalVoucherFullForm.tsx", import.meta.url), "utf8");

    expect(source).toContain("const result = await sendMut.mutateAsync({");
    expect(source).toContain("if (!result.success) {");
    expect(source).toContain('throw new Error(result.error || "The commission voucher could not be submitted.");');
  });
});
