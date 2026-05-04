import { describe, expect, it } from "vitest";
import {
  abbreviateRentTypeForReport,
  buildLeaseReportCard,
  buildSaleReportCard,
  formatParkingRatioDisplay,
  formatRentAdjustmentsDisplay,
  formatSaleTransactionTypeDisplay,
  normalizeLeaseCompRecord,
  normalizeSaleCompRecord,
} from "../shared/comp-data";

describe("comp data normalization", () => {
  it("normalizes lease workbook rows into report-ready records", () => {
    const record = normalizeLeaseCompRecord(
      {
        ihlcID: 1001,
        office: "LeeIrvine",
        streetNumber1: "2100",
        streetName: "Howell",
        streetSuffix: "Ave",
        city: "Anaheim",
        state: "CA",
        market: "Orange County",
        subMarket: "NOC",
        projectName: "Stadium Landing",
        propertyType: "Indust",
        propertySubType: "Dist",
        buildingClass: "A",
        spaceType: "Direct-New",
        multiTenant: "N",
        yearBuilt: 2025,
        dhDoors: 10,
        glDoors: 1,
        clearHeight: 36,
        amperage: 2000,
        parkingRatio: "1.0:1",
        sprinklers: "Y",
        rail: "N",
        yard: "Y",
        POL: "N",
        listBroker: "Voit",
        procBroker: "None",
        source: "West",
        verifiedBy: "West",
        lastUpdated: "2026-03-25T00:00:00.000Z",
        monthsOnMarket: 14,
        transactionDate: "2026-02-10T00:00:00.000Z",
        occupancyDate: "2026-09-01T00:00:00.000Z",
        expirationDate: "2032-02-28T00:00:00.000Z",
        leasedSqFt: 4000,
        rentPerSqFt: 2,
        rentType: "NNN",
        termInMonths: 66,
        effectiveRent: 2.01,
        freeRentMonths: 6,
        tia: "$5.00/Ft.",
        options: "WND",
        rentAdjustments: "4.0%",
        lessee: "Hyper Solutions, Inc.",
        lessor: "Pacific Industrial",
        comments: "Brand new complex",
        buildingSqFt: 100784,
        officeSqFt: 4000,
        NNNCharges: 0.4,
        landSqFt: 238709,
      },
      "LeeIrvine_LeaseComps"
    );

    expect(record.address).toBe("2100 Howell Ave");
    expect(record.transactionDate).toBe("2026-02-10");
    expect(record.sprinklers).toBe("Yes");
    expect(record.multiTenant).toBe("No");

    const card = buildLeaseReportCard(record);
    expect(card.fields["Rent/SqFt"]).toContain("NNN");
    expect(card.fields["Land"]).toBe("238,709");
    expect(card.fields["Options/Rent Adj"]).toContain("WND");
    expect(card.fields["Trans. Date"]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(card.fields["Yr Built"]).toBe("2025");
  });

  it("joins two street numbers with a dash in the address", () => {
    const record = normalizeLeaseCompRecord(
      {
        ihlcID: 2,
        office: "LeeIrvine",
        streetNumber1: "4210",
        streetNumber2: "4212",
        streetName: "Newport",
        streetSuffix: "Blvd",
        city: "Costa Mesa",
        state: "CA",
        zipCode: "92627",
        market: "OC",
        subMarket: "Coast",
        propertyType: "Indust",
        buildingClass: "B",
        listBroker: "Lee",
        procBroker: "Lee",
        source: "Internal",
        verifiedBy: "Test",
        lastUpdated: "2026-01-01",
        transactionDate: "2026-01-15",
        lessee: "T",
        lessor: "L",
        comments: "",
        buildingSqFt: 10000,
      },
      "LeeIrvine_LeaseComps"
    );
    expect(record.address).toBe("4210-4212 Newport Blvd");
  });

  it("normalizes sale workbook rows into report-ready records", () => {
    const record = normalizeSaleCompRecord(
      {
        ihscID: 214644,
        office: "LeeIrvine",
        streetNumber1: "3080",
        streetName: "Airway",
        streetSuffix: "Ave",
        suite: "#109",
        city: "Costa Mesa",
        state: "CA",
        market: "Orange County",
        subMarket: "Airport Area",
        propertyType: "Indust",
        propertySubType: "Flex",
        buildingClass: "A",
        yearBuilt: 2021,
        dhDoors: 0,
        glDoors: 32,
        clearHeight: 24,
        amperage: 100,
        sprinklers: "Y",
        rail: "N",
        yard: "N",
        multiTenant: "N",
        listBroker: "Lee & Associates - NB - Brian Garbutt",
        source: "Metropolis",
        verifiedBy: "Metropolis",
        lastUpdated: "2026-03-05T00:00:00.000Z",
        monthsOnMarket: 4,
        transactionDate: "2026-03-03T00:00:00.000Z",
        buildingSqFt: 78738,
        landSqFt: 174240,
        officeSqFt: 1143,
        salePrice: 1150000,
        salePricePerSqFt: 14.61,
        transactionType: "User",
        buyer: "Shamel Bersiek & Sandra Abraha",
        buyerPriorLocation: "",
        seller: "Rodrigues Family Trust",
        comments: "High-end car storage condominium.",
      },
      "LeeIrvine_SalesComps"
    );

    expect(record.address).toBe("3080 Airway Ave #109");
    expect(record.salePrice).toBe(1150000);
    expect(record.sprinklers).toBe("Yes");

    const card = buildSaleReportCard(record);
    expect(card.fields["Sale Price"]).toContain("$1,150,000");
    expect(card.fields["Buyer"]).toContain("Shamel");
    expect(card.fields["Trans. Date"]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(card.fields["Trans. Type"]).toBe("User");
  });

  it("formats rent adjustment decimals as percentages and normalizes parking display", () => {
    expect(formatRentAdjustmentsDisplay("0.03")).toBe("3.0%");
    expect(formatRentAdjustmentsDisplay("3% annual")).toBe("3% annual");
    expect(formatParkingRatioDisplay("2/1000")).toBe("2.0:1,000");
    expect(formatSaleTransactionTypeDisplay("Investor")).toBe("Investment");
    expect(formatSaleTransactionTypeDisplay("Owner/User")).toBe("User");
    expect(abbreviateRentTypeForReport("Full Service Gross")).toBe("FSG");
  });
});
