import { describe, expect, it } from "vitest";
import { mapListingFieldsToBuildoutProperty } from "./listingToBuildoutMap";

describe("mapListingFieldsToBuildoutProperty", () => {
  it("maps address, geo, and building SF", () => {
    const out = mapListingFieldsToBuildoutProperty({
      address: "123 Main St",
      city: "Irvine",
      state: "ca",
      zip: "92618",
      buildingSf: "12,500",
    });
    expect(out.address).toBe("123 Main St");
    expect(out.city).toBe("Irvine");
    expect(out.state).toBe("CA");
    expect(out.zip).toBe("92618");
    expect(out.building_size_sf).toBe(12500);
  });

  it("sets sale flag and price for sale transactions", () => {
    const out = mapListingFieldsToBuildoutProperty({
      transactionType: "Sale",
      askingPrice: "2,500,000",
      address: "1 Loop Dr",
    });
    expect(out.sale).toBe(true);
    expect(out.sale_price_dollars).toBe(2500000);
  });

  it("does not mark a sublease as a sale", () => {
    const out = mapListingFieldsToBuildoutProperty({
      transactionType: "Sublease",
      askingPrice: "2,500,000",
      address: "1 Loop Dr",
    });
    expect(out.sale).toBeUndefined();
    expect(out.sale_price_dollars).toBeUndefined();
  });

  it("merges narrative into site_description", () => {
    const out = mapListingFieldsToBuildoutProperty({
      comments: "Corner lot.",
      listingAgentName: "Jane Doe",
      leaseType: "NNN",
      rateSfMo: "1.25",
    });
    expect(String(out.site_description)).toContain("Corner lot");
    expect(String(out.site_description)).toContain("Jane Doe");
    expect(String(out.site_description)).toContain("NNN");
  });
});
