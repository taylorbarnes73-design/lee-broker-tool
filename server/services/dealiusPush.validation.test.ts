import { describe, expect, it } from "vitest";
import { validateVoucherPayloadForDealiusPush } from "./dealiusPush";

describe("validateVoucherPayloadForDealiusPush", () => {
  it("passes when address, city, zip, fee, and rent rows exist for lease", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      representationType: "Tenant Rep",
      feePercent: 6,
      rentRows: [{ months: 12, monthly: 1000, free: false }],
    });
    expect(r).toEqual({ ok: true });
  });

  it("fails when fee is missing", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      representationType: "Tenant Rep",
      rentRows: [{ months: 12, monthly: 1000, free: false }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes("fee"))).toBe(true);
  });

  it("fails lease-like when rent schedule is empty", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      transactionType: "Lease",
      feePercent: 5,
      rentRows: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes("rent"))).toBe(true);
  });

  it("does not require rent rows for sale-like deals", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      transactionType: "Sale",
      representationType: "Seller Rep",
      feePercent: 3,
    });
    expect(r).toEqual({ ok: true });
  });
});
