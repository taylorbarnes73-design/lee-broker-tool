import { describe, expect, it } from "vitest";
import { buildCompSubmissionRecord } from "./compFormRecord";

describe("buildCompSubmissionRecord", () => {
  it("stores the state and zip the broker entered on a lease comp", () => {
    const record = buildCompSubmissionRecord({
      vals: {
        "c-address": "1 E Washington St",
        "c-city": "Phoenix",
        "c-state": "AZ",
        "c-zip": "85004",
        "c-leased-sf": "10000",
        "c-rent-sf": "1.25",
      },
      isSale: false,
      sourceFallback: "Taylor Barnes",
    });

    expect(record.state).toBe("AZ");
    expect(record.zipCode).toBe("85004");
    expect(record.city).toBe("Phoenix");
    expect(record.leasedSqFt).toBe("10000");
  });

  it("stores the state and zip on a sale comp", () => {
    const record = buildCompSubmissionRecord({
      vals: {
        "c-address": "100 S Virginia St",
        "c-city": "Reno",
        "c-state": "NV",
        "c-zip": "89501",
        "cs-sell-price": "8200000",
        "cs-bldg-sf": "52000",
      },
      isSale: true,
      sourceFallback: "Taylor Barnes",
    });

    expect(record.state).toBe("NV");
    expect(record.zipCode).toBe("89501");
    expect(record.salePrice).toBe("8200000");
    expect(record.salePricePerSqFt).toBe("157.69");
  });

  it("keeps California as the default when state is blank and still stores zip", () => {
    const record = buildCompSubmissionRecord({
      vals: {
        "c-address": "1450 Von Karman Ave",
        "c-city": "Irvine",
        "c-zip": "92618",
      },
      isSale: false,
      sourceFallback: "Taylor Barnes",
    });

    expect(record.state).toBe("CA");
    expect(record.zipCode).toBe("92618");
  });
});
