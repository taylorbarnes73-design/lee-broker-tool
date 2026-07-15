import { describe, expect, it } from "vitest";
import {
  __dealiusInternals,
  buildDealEntryFromSubmissionPayload,
  DEALIUS_RATE_PER_SF_MONTH,
  leasePartiesFromClientOpposite,
} from "./dealiusEntry";

describe("leasePartiesFromClientOpposite", () => {
  it("maps tenant rep client to lessee and opposite to lessor", () => {
    const parties = leasePartiesFromClientOpposite({
      repTypeID: 3,
      clientCo: "Acme Tenant LLC",
      oppositeCo: "Big Landlord LLC",
      clientID: 101,
      oppositeID: 202,
      clientContactID: 1001,
      oppositeContactID: 2002,
    });
    expect(parties).toMatchObject({
      lesseeID: 101,
      lessorID: 202,
      lesseeCo: "Acme Tenant LLC",
      lessorCo: "Big Landlord LLC",
      lesseeContactID: 1001,
      lessorContactID: 2002,
    });
  });

  it("maps landlord rep client to lessor and opposite to lessee", () => {
    const parties = leasePartiesFromClientOpposite({
      repTypeID: 4,
      clientCo: "Big Landlord LLC",
      oppositeCo: "Acme Tenant LLC",
      clientID: 202,
      oppositeID: 101,
      clientContactID: 2002,
      oppositeContactID: 1001,
    });
    expect(parties).toMatchObject({
      lesseeID: 101,
      lessorID: 202,
      lesseeCo: "Acme Tenant LLC",
      lessorCo: "Big Landlord LLC",
      lesseeContactID: 1001,
      lessorContactID: 2002,
    });
  });
});

describe("native voucher party normalization", () => {
  it("maps a nested tenant-rep voucher to the tenant client and landlord opposite party", () => {
    const entry = buildDealEntryFromSubmissionPayload({
      formData: {
        txnType: "Lease",
        repType: "Tenant Rep",
        address: "1 Main St",
        city: "Irvine",
        zip: "92618",
        dealSf: "2500",
        lsCompany: "Big Landlord LLC",
        lbCompany: "Acme Tenant LLC",
        lCommRate: "5",
        rentRows: [{ months: 12, monthly: 7500, free: false }],
      },
    });

    expect(__dealiusInternals.normalizeDealEntry(entry)).toMatchObject({
      repTypeID: 3,
      clientCo: "Acme Tenant LLC",
      oppositeCo: "Big Landlord LLC",
      address: "1 Main St",
      city: "Irvine",
      zip: "92618",
      sqft: 2500,
      feePercent: 5,
      rentRows: [{ months: 12, monthly: 7500, free: false }],
    });
  });
});

describe("DEALIUS_RATE_PER_SF_MONTH", () => {
  it("uses 1 for monthly rent schedule", () => {
    expect(DEALIUS_RATE_PER_SF_MONTH).toBe(1);
  });
});
