import { describe, expect, it } from "vitest";
import {
  inferPortalDealTransactionType,
  isSaleTransaction,
  isSubleaseTransaction,
  transactionDealNamePrefix,
} from "./transactionKind";

describe("transaction kind", () => {
  it("does not treat a sublease as a sale", () => {
    expect(isSubleaseTransaction("Sublease")).toBe(true);
    expect(isSubleaseTransaction("Sub-lease")).toBe(true);
    expect(isSaleTransaction("Sublease")).toBe(false);
    expect(isSaleTransaction("SubLease")).toBe(false);
    expect(inferPortalDealTransactionType("Sublease")).toBe("Lease");
    expect(transactionDealNamePrefix("Sublease")).toBe("Leased");
  });

  it("still classifies real sales", () => {
    expect(isSaleTransaction("Sale")).toBe(true);
    expect(isSaleTransaction("Sold")).toBe(true);
    expect(inferPortalDealTransactionType("Sale")).toBe("Sale");
    expect(transactionDealNamePrefix("Sale")).toBe("Sold");
    expect(transactionDealNamePrefix("Purchase")).toBe("Sold");
  });

  it("keeps lease, renewal, and consulting distinct from sales", () => {
    expect(inferPortalDealTransactionType("Lease")).toBe("Lease");
    expect(inferPortalDealTransactionType("Renewal")).toBe("Renewal");
    expect(inferPortalDealTransactionType("Consulting")).toBe("Consulting");
    expect(transactionDealNamePrefix("Lease")).toBe("Leased");
    expect(transactionDealNamePrefix("Renewal")).toBe("Renewed");
  });
});
