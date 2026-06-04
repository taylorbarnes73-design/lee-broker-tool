import { describe, expect, it } from "vitest";
import { buildSubmissionSummaryFields } from "../shared/submissionSummary";

describe("buildSubmissionSummaryFields", () => {
  it("reads section-based payloads from send-to-admin", () => {
    const fields = buildSubmissionSummaryFields("voucher", {
      sections: [
        {
          title: "Property",
          fields: [
            { label: "Address", value: "123 Main St" },
            { label: "City", value: "Newport Beach" },
          ],
        },
      ],
    });
    expect(fields[0]?.value).toBe("123 Main St");
    expect(fields.some(f => f.label.includes("City"))).toBe(true);
  });

  it("falls back to flat voucher keys", () => {
    const fields = buildSubmissionSummaryFields("voucher", {
      address: "456 Oak Ave",
      city: "Irvine",
      brokerName: "Taylor Barnes",
      dealSF: "12000",
    });
    expect(fields.some(f => f.value.includes("456 Oak"))).toBe(true);
    expect(fields.some(f => f.label === "Broker" && f.value === "Taylor Barnes")).toBe(true);
  });
});
