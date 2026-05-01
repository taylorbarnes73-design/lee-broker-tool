import { describe, expect, it } from "vitest";
import { mergeVoucherFromContractExtraction } from "@shared/contractIntake";

const baseDate = new Date("2026-05-01T07:00:00.000Z");

describe("mergeVoucherFromContractExtraction", () => {
  it("creates a current contract revision and populates voucher fields", () => {
    const payload = mergeVoucherFromContractExtraction({
      payload: { body: "original" },
      contractType: "Lease Agreement",
      now: baseDate,
      pdf: { url: "https://cdn.example.com/lease.pdf", fileKey: "lease.pdf", filename: "lease.pdf" },
      contract: {
        propAddress: "123 Main St",
        propCity: "Newport Beach",
        propState: "CA",
        propZip: "92660",
        party1Name: "Owner LLC",
        mlLessee: "Tenant Inc",
        termStart: "2026-06-01",
        termEnd: "2031-05-31",
        commAmount: "6%",
      },
    });

    expect(payload).toMatchObject({
      body: "original",
      address: "123 Main St",
      city: "Newport Beach",
      state: "CA",
      zip: "92660",
      propertyAddress: "123 Main St, Newport Beach, CA 92660",
      lessorName: "Owner LLC",
      lesseeName: "Tenant Inc",
      commencementDate: "2026-06-01",
      expirationDate: "2031-05-31",
      feePercent: 6,
      commissionRate: "6",
    });
    expect((payload.aiExtract as any).contract).toMatchObject({
      revisionId: "2026-05-01T07:00:00.000Z-1",
      currentRevisionId: "2026-05-01T07:00:00.000Z-1",
      revisionNumber: 1,
      extractedAt: "2026-05-01T07:00:00.000Z",
      contractType: "Lease Agreement",
      pdf: { filename: "lease.pdf" },
    });
    expect((payload.aiExtract as any).contract.revisions).toHaveLength(1);
  });

  it("replaces values that came from the previous contract revision", () => {
    const first = mergeVoucherFromContractExtraction({
      payload: {},
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T07:00:00.000Z"),
      pdf: { filename: "first.pdf" },
      contract: {
        propAddress: "123 Main St",
        propCity: "Newport Beach",
        propState: "CA",
        propZip: "92660",
        termStart: "2026-06-01",
        termEnd: "2031-05-31",
        commAmount: "6%",
      },
    });

    const second = mergeVoucherFromContractExtraction({
      payload: first,
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T08:00:00.000Z"),
      pdf: { filename: "second.pdf" },
      contract: {
        propAddress: "456 Harbor Blvd",
        propCity: "Costa Mesa",
        propState: "CA",
        propZip: "92627",
        termStart: "2026-07-01",
        termEnd: "2031-06-30",
        commAmount: "5%",
      },
    });

    expect(second).toMatchObject({
      address: "456 Harbor Blvd",
      city: "Costa Mesa",
      zip: "92627",
      propertyAddress: "456 Harbor Blvd, Costa Mesa, CA 92627",
      commencementDate: "2026-07-01",
      expirationDate: "2031-06-30",
      feePercent: 5,
      commissionRate: "5",
    });
    expect((second.aiExtract as any).contract.currentRevisionId).toBe("2026-05-01T08:00:00.000Z-2");
    expect((second.aiExtract as any).contract.revisions.map((r: any) => r.pdf.filename)).toEqual([
      "first.pdf",
      "second.pdf",
    ]);
  });

  it("preserves manually edited voucher values across a new contract revision", () => {
    const first = mergeVoucherFromContractExtraction({
      payload: {},
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T07:00:00.000Z"),
      contract: {
        propAddress: "123 Main St",
        propCity: "Newport Beach",
        propState: "CA",
        propZip: "92660",
        commAmount: "6%",
      },
    });

    const edited = {
      ...first,
      address: "Manual Address",
      feePercent: 7,
      commissionRate: "7",
    };
    const second = mergeVoucherFromContractExtraction({
      payload: edited,
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T08:00:00.000Z"),
      contract: {
        propAddress: "456 Harbor Blvd",
        propCity: "Costa Mesa",
        propState: "CA",
        propZip: "92627",
        commAmount: "5%",
      },
    });

    expect(second.address).toBe("Manual Address");
    expect(second.feePercent).toBe(7);
    expect(second.commissionRate).toBe("7");
    expect(second.city).toBe("Costa Mesa");
  });

  it("removes stale values from an earlier full revision when the new revision omits them", () => {
    const first = mergeVoucherFromContractExtraction({
      payload: {},
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T07:00:00.000Z"),
      contract: {
        propAddress: "123 Main St",
        propCity: "Newport Beach",
        propState: "CA",
        propZip: "92660",
        commAmount: "6%",
      },
    });

    const second = mergeVoucherFromContractExtraction({
      payload: first,
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T08:00:00.000Z"),
      contract: {
        propAddress: "123 Main St",
        propCity: "Newport Beach",
        propState: "CA",
        propZip: "92660",
      },
    });

    expect(second.feePercent).toBeUndefined();
    expect(second.commissionRate).toBeUndefined();
  });

  it("migrates a legacy single contract extraction into revision history", () => {
    const merged = mergeVoucherFromContractExtraction({
      payload: {
        address: "123 Main St",
        aiExtract: {
          contract: {
            extractedAt: "2026-04-30T07:00:00.000Z",
            contractType: "Lease Agreement",
            pdf: { filename: "legacy.pdf" },
            data: { propAddress: "123 Main St", propCity: "Newport Beach" },
          },
        },
      },
      contractType: "Lease Agreement",
      now: new Date("2026-05-01T07:00:00.000Z"),
      pdf: { filename: "new.pdf" },
      contract: { propAddress: "456 Harbor Blvd", propCity: "Costa Mesa" },
    });

    expect(merged.address).toBe("456 Harbor Blvd");
    expect((merged.aiExtract as any).contract.revisions).toMatchObject([
      {
        revisionId: "legacy-1",
        revisionNumber: 1,
        pdf: { filename: "legacy.pdf" },
      },
      {
        revisionId: "2026-05-01T07:00:00.000Z-2",
        revisionNumber: 2,
        pdf: { filename: "new.pdf" },
      },
    ]);
  });
});
