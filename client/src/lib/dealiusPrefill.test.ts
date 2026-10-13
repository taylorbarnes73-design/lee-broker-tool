import { describe, expect, it } from "vitest";
import { buildInitialEntry } from "../components/DealiusSubmissionWorkspace";

function submission(payload: Record<string, unknown>) {
  return {
    id: 42,
    formType: "voucher",
    status: "pending",
    reference: "123 Main, Irvine",
    submittedBy: "Taylor Barnes",
    submittedByEmail: "tbarnes@lee-associates.com",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    payload,
  };
}

describe("buildInitialEntry portal voucher prefill", () => {
  it("keeps city, fee, tenant representation, and the real rent schedule from a portal lease voucher", () => {
    const entry = buildInitialEntry(
      submission({
        propertyAddress: "123 Main, 100, Irvine, CA, 92618",
        sections: [
          {
            title: "Deal Information",
            fields: [
              { label: "Transaction Type", value: "Lease" },
              { label: "Representation", value: "Tenant Rep" },
              { label: "Address", value: "123 Main, 100, Irvine, CA, 92618" },
              { label: "Deal SF", value: "10000" },
            ],
          },
          {
            title: "Lessor & Lessee",
            fields: [
              { label: "Lessor", value: "Owner LLC / Jane Owner" },
              { label: "Lessee", value: "Tenant Inc / Bob Tenant" },
            ],
          },
          {
            title: "Lease Terms",
            fields: [
              { label: "Start Date", value: "2026-07-01" },
              { label: "End Date", value: "2027-06-30" },
              { label: "Occupancy Date", value: "2026-07-01" },
              { label: "Term (months)", value: "12" },
              { label: "Rate/SF/Mo", value: "$1.50" },
            ],
          },
          {
            title: "Rent Schedule",
            fields: [
              { label: "Row 1", value: "$0.00 × 2 months @ 6%" },
              { label: "Row 2", value: "$15,000.00 × 10 months @ 6%" },
            ],
          },
          {
            title: "Commission & Invoice",
            fields: [{ label: "Commission Rate", value: "6%" }],
          },
        ],
        formData: {
          txnType: "Lease",
          repType: "Tenant Rep",
          address: "123 Main",
          suite: "100",
          city: "Irvine",
          state: "CA",
          zip: "92618",
          dealSf: "10000",
          lsCompany: "Owner LLC",
          lbCompany: "Tenant Inc",
          lStart: "2026-07-01",
          lEnd: "2027-06-30",
          lOcc: "2026-07-01",
          lTerm: "12",
          lRate: "1.50",
          sPrice: "",
          sCommPct: "",
        },
      }),
    );

    expect(entry.address).toBe("123 Main");
    expect(entry.city).toBe("Irvine");
    expect(entry.zip).toBe("92618");
    expect(entry.suite).toBe("100");
    expect(entry.repTypeID).toBe("3");
    expect(entry.clientCo).toBe("Tenant Inc");
    expect(entry.oppositeCo).toBe("Owner LLC");
    expect(entry.feePercent).toBe("6");
    expect(entry.startDate).toBe("2026-07-01");
    expect(entry.endDate).toBe("2027-06-30");
    expect(entry.term).toBe("12");
    expect(entry.rentRows).toEqual([
      { months: "2", monthly: "0", free: true },
      { months: "10", monthly: "15000", free: false },
    ]);
  });

  it("uses structured rent rows and the lease commission rate stored on new submissions", () => {
    const entry = buildInitialEntry(
      submission({
        sections: [
          {
            title: "Rent Schedule",
            fields: [{ label: "Row 1", value: "$15,000.00 × 12 months @ 6%" }],
          },
        ],
        formData: {
          txnType: "Lease",
          repType: "Landlord Rep",
          address: "500 Industrial",
          city: "Santa Ana",
          zip: "92705",
          lsCompany: "Owner LLC",
          lbCompany: "Tenant Inc",
          lCommRate: "5",
          rentRows: [
            { monthly: 0, months: 1, commPct: "5" },
            { monthly: 12000, months: 11, commPct: "5" },
          ],
        },
      }),
    );

    expect(entry.repTypeID).toBe("4");
    expect(entry.clientCo).toBe("Owner LLC");
    expect(entry.oppositeCo).toBe("Tenant Inc");
    expect(entry.feePercent).toBe("5");
    expect(entry.rentRows).toEqual([
      { months: "1", monthly: "0", free: true },
      { months: "11", monthly: "12000", free: false },
    ]);
  });

  it("prefills a portal sale voucher with price, fee, and seller representation", () => {
    const entry = buildInitialEntry(
      submission({
        sections: [
          {
            title: "Deal Information",
            fields: [{ label: "Transaction Type", value: "Sale" }],
          },
          {
            title: "Sale Terms",
            fields: [{ label: "Sale Price", value: "$2,500,000.00" }],
          },
        ],
        formData: {
          txnType: "Sale",
          repType: "Seller Rep",
          address: "9 Broker Way",
          city: "Irvine",
          zip: "92612",
          lsCompany: "Seller Co",
          lbCompany: "Buyer Co",
          sPrice: "2500000",
          sCommPct: "4",
        },
      }),
    );

    expect(entry.transactionType).toBe("Sale");
    expect(entry.repTypeID).toBe("2");
    expect(entry.clientCo).toBe("Seller Co");
    expect(entry.oppositeCo).toBe("Buyer Co");
    expect(entry.city).toBe("Irvine");
    expect(entry.zip).toBe("92612");
    expect(entry.totalConsideration).toBe("2500000");
    expect(entry.feePercent).toBe("4");
    expect(entry.rentRows).toEqual([]);
  });

  it("still derives one rent row from term, rate, and size when the payload has no portal schedule", () => {
    const entry = buildInitialEntry(
      submission({
        transactionType: "Lease",
        repTypeID: 4,
        clientCo: "Owner LLC",
        address: "1 Imported St",
        city: "Irvine",
        zip: "92618",
        lTerm: 12,
        lRate: 1.5,
        sqft: 10000,
      }),
    );

    expect(entry.rentRows).toEqual([{ months: "12", monthly: "15000", free: false }]);
  });

  it("does not invent a full-term rent row when the portal voucher left the schedule blank", () => {
    const entry = buildInitialEntry(
      submission({
        sections: [
          {
            title: "Lease Terms",
            fields: [
              { label: "Term (months)", value: "12" },
              { label: "Rate/SF/Mo", value: "$1.50" },
            ],
          },
        ],
        formData: {
          txnType: "Lease",
          repType: "Landlord Rep",
          address: "500 Industrial",
          city: "Santa Ana",
          zip: "92705",
          dealSf: "10000",
          lsCompany: "Owner LLC",
          lTerm: "12",
          lRate: "1.50",
          lCommRate: "6",
        },
      }),
    );

    expect(entry.feePercent).toBe("6");
    expect(entry.term).toBe("12");
    expect(entry.rentRows).toEqual([]);
  });

  it("does not treat the lessor as the client when the voucher is tenant rep and the lessee is blank", () => {
    const entry = buildInitialEntry(
      submission({
        sections: [
          {
            title: "Lessor & Lessee",
            fields: [{ label: "Lessor", value: "Owner LLC" }],
          },
        ],
        formData: {
          txnType: "Lease",
          repType: "Tenant Rep",
          address: "123 Main",
          city: "Irvine",
          zip: "92618",
          lsCompany: "Owner LLC",
          lbCompany: "",
        },
      }),
    );

    expect(entry.repTypeID).toBe("3");
    expect(entry.clientCo).toBe("");
    expect(entry.oppositeCo).toBe("Owner LLC");
  });

  it("does not replace an explicit Dealius client or representation already stored on the submission", () => {
    const entry = buildInitialEntry(
      submission({
        repTypeID: 4,
        clientCo: "Imported Landlord LLC",
        oppositeCo: "Imported Tenant LLC",
        feePercent: 6,
        city: "Irvine",
        zip: "92618",
        address: "1 Imported St",
        formData: {
          txnType: "Lease",
          repType: "Tenant Rep",
          address: "123 Main",
          city: "Santa Ana",
          zip: "92705",
          lsCompany: "Owner LLC",
          lbCompany: "Tenant Inc",
          lCommRate: "5",
        },
      }),
    );

    expect(entry.repTypeID).toBe("4");
    expect(entry.clientCo).toBe("Imported Landlord LLC");
    expect(entry.oppositeCo).toBe("Imported Tenant LLC");
    expect(entry.address).toBe("1 Imported St");
    expect(entry.city).toBe("Irvine");
    expect(entry.feePercent).toBe("6");
  });
});
