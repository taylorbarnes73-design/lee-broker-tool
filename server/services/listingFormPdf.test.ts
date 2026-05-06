import { describe, expect, it } from "vitest";
import { listingFormPatchFromParsed, parseListingFormFields } from "./listingFormPdf";

describe("parseListingFormFields", () => {
  it("maps retail listing form spaces into listing/property payload fields", () => {
    const parsed = parseListingFormFields(
      {
        Lease: "On",
        NNN: "On",
        "Property Name": "Village Center",
        Address: "25290 Marguerite Pkwy",
        City: "Mission Viejo",
        State: "CA",
        Zip: "92692",
        "GLABldg SF": "9,900",
        "Year Built": "1975",
        SF: "$2.95",
        "Listing Agents 1": "Shannon Zacher",
        "Listing Agents 2": "Brian Barson",
        Email: "szacher@lee-associates.com bbarson@lee-associates.com",
        "SUITE Row1": "E",
        "AVAIL SFRow1": "2,000",
        "LEASE RATESFRow1": "$2.95 + NNN",
        "DATE AVAILRow1": "Now",
        "SUITE Row2": "F-1",
        "AVAIL SFRow2": "1,650",
        "LEASE RATESFRow2": "$2.95 + NNN",
      },
      "RETAIL LISTING ENTRY FORM"
    );

    expect(parsed.propertyType).toBe("Retail");
    expect(parsed.transactionType).toBe("Lease");
    expect(parsed.address).toBe("25290 Marguerite Pkwy");
    expect(parsed.sqft).toBe(3650);
    expect(parsed.totalBldgSF).toBe(9900);
    expect(parsed.leaseType).toBe("NNN");
    expect(parsed.spaces).toHaveLength(2);
    expect(parsed.spaces[0]).toMatchObject({ suite: "E", sqft: 2000, askingRate: 2.95 });

    const patch = listingFormPatchFromParsed(parsed);
    expect(patch.listingTransaction).toBe("lease");
    expect(patch.suite).toBe("E, F-1");
    expect(patch.brokers).toEqual([
      { name: "Shannon Zacher", pct: 100, lead: true },
      { name: "Brian Barson", pct: "", lead: false },
    ]);
  });

  it("maps industrial sale input forms to property creation fields", () => {
    const parsed = parseListingFormFields(
      {
        Sale: "On",
        "Sale Price": "3,775,000",
        SF_2: "320",
        Address: "2401-2413 S Broadway",
        City: "Santa Ana",
        Zip: "92707",
        Size: "11,452",
        Office: "2000",
        "Year Built": "1985",
        "Listing Agents 1": "Charlie Winn",
      },
      "INDUSTRIAL LISTING ENTRY FORM"
    );

    expect(parsed.propertyType).toBe("Industrial");
    expect(parsed.transactionType).toBe("Sale");
    expect(parsed.listingTransaction).toBe("sale");
    expect(parsed.askingPrice).toBe(3775000);
    expect(parsed.spaces).toEqual([{ suite: "", sqft: 11452 }]);

    const patch = listingFormPatchFromParsed(parsed);
    expect(patch.totalBldgSF).toBe(11452);
    expect(patch.askingPrice).toBe(3775000);
  });
});
