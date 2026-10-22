import { describe, expect, it } from "vitest";
import { __dealiusInternals, validateDealEntryForDealiusPush, validateListingEntryForDealiusPush } from "./dealiusEntry";
import { validateVoucherPayloadForDealiusPush } from "./dealiusPush";

const { normalizeDealEntry } = __dealiusInternals;

describe("validateVoucherPayloadForDealiusPush", () => {
  it("passes when address, city, zip, fee, and rent rows exist for lease", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      clientCo: "Client LLC",
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
      clientCo: "Client LLC",
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
      clientCo: "Client LLC",
      transactionType: "Lease",
      feePercent: 5,
      rentRows: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes("rent"))).toBe(true);
  });

  it("treats a sublease as a lease and requires the rent schedule", () => {
    const missingRent = validateDealEntryForDealiusPush({
      address: "100 Industrial Way",
      city: "Irvine",
      zip: "92618",
      clientCo: "Tenant Co",
      transactionType: "Sublease",
      repTypeID: 3,
      feePercent: 6,
      rentRows: [],
    });
    expect(missingRent.ok).toBe(false);
    if (!missingRent.ok) expect(missingRent.errors.some(error => error.includes("rent"))).toBe(true);

    const normalized = normalizeDealEntry({
      address: "100 Industrial Way",
      city: "Irvine",
      zip: "92618",
      clientCo: "Tenant Co",
      oppositeCo: "Landlord LLC",
      transactionType: "Sublease",
      repTypeID: 3,
      feePercent: 6,
      rentRows: [{ months: 60, monthly: 18750, free: false }],
    });
    expect(normalized.isSale).toBe(false);
    expect(normalized.isLease).toBe(true);
    expect(normalized.dealTypeID).toBe(1);
    expect(normalized.repTypeID).toBe(3);
    expect(normalized.dealName.startsWith("Leased:")).toBe(true);
  });

  it("does not require rent rows for sale-like deals", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1 Main",
      city: "Irvine",
      zip: "92618",
      clientCo: "Client LLC",
      transactionType: "Sale",
      representationType: "Seller Rep",
      feePercent: 3,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("validateDealEntryForDealiusPush", () => {
  it("accepts a full address string when city and zip are embedded", () => {
    const r = validateDealEntryForDealiusPush({
      dealName: "Leased: 1 Main St",
      address: "1 Main St, Irvine CA 92618",
      clientCo: "Client LLC",
      transactionType: "Lease",
      feePercent: "6",
      rentRows: [{ months: "12", monthly: "1000", free: false }],
    });

    expect(r).toEqual({ ok: true });
  });

  it("accepts referred deals without rent rows and uses the referral amount path", () => {
    const r = validateVoucherPayloadForDealiusPush({
      address: "1652 Deere Ave.",
      city: "Irvine",
      zip: "92606",
      clientCo: "SEBCO",
      transactionType: "Referral",
      repTypeID: 5,
      sqft: 15802,
      paymentAmount: 10307.88,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("validateListingEntryForDealiusPush", () => {
  it("passes when a listing has property identity and square footage", () => {
    const r = validateListingEntryForDealiusPush({
      listingName: "For Lease: 1 Main St",
      address: "1 Main St",
      city: "Irvine",
      zip: "92618",
      propertyType: "Office",
      sqft: "2400",
    });

    expect(r).toEqual({ ok: true });
  });

  it("fails when listing square footage is missing", () => {
    const r = validateListingEntryForDealiusPush({
      listingName: "For Lease: 1 Main St",
      address: "1 Main St",
      city: "Irvine",
      zip: "92618",
      propertyType: "Office",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes("square footage"))).toBe(true);
  });
});
