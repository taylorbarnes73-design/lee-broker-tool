import { describe, expect, it } from "vitest";
import { DEALIUS_RATE_PER_SF_MONTH, leasePartiesFromClientOpposite } from "./dealiusEntry";

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

describe("DEALIUS_RATE_PER_SF_MONTH", () => {
  it("uses 1 for monthly rent schedule", () => {
    expect(DEALIUS_RATE_PER_SF_MONTH).toBe(1);
  });
});
