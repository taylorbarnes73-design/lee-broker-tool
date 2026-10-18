import { describe, expect, it } from "vitest";
import { templateTransactionType } from "./voucherExcel";

describe("templateTransactionType", () => {
  it("writes a lease renewal with the template's Lease Renewal label", () => {
    expect(templateTransactionType("Renewal")).toBe("Lease Renewal");
    expect(templateTransactionType(" lease renewal ")).toBe("Lease Renewal");
  });

  it("writes a sublease with the template's SubLease label", () => {
    expect(templateTransactionType("Sublease")).toBe("SubLease");
  });

  it("leaves lease and sale labels unchanged", () => {
    expect(templateTransactionType("Lease")).toBe("Lease");
    expect(templateTransactionType("Sale")).toBe("Sale");
  });
});
