import { describe, expect, it } from "vitest";
import {
  buildSummary,
  classifyFormType,
  extractContacts,
  extractDollarAmounts,
  extractPropertyAddress,
  parseEmailSubmission,
} from "../lib/parseEmailSubmission";

describe("classifyFormType", () => {
  it("classifies commission voucher", () => {
    expect(classifyFormType("Commission Voucher for 658 N Tustin", "")).toBe("voucher");
    expect(classifyFormType("Commission split request", "")).toBe("voucher");
  });
  it("classifies sign requests", () => {
    expect(classifyFormType("Sign Request: 3315 Newport Blvd", "")).toBe("sign");
    expect(classifyFormType("Signage for new listing", "")).toBe("sign");
    expect(classifyFormType("Re: sign order", "")).toBe("sign");
  });
  it("classifies listing agreement subjects", () => {
    expect(classifyFormType("Listing Agreement — 644 N. Eckhoff", "")).toBe("listing");
  });
  it("classifies PSA / purchase agreements", () => {
    expect(classifyFormType("PSA for 11366 Markon Dr", "")).toBe("psa");
    expect(classifyFormType("Purchase and Sale Agreement attached", "")).toBe("psa");
    expect(classifyFormType("Updated purchase agreement", "")).toBe("psa");
  });
  it("classifies price changes", () => {
    expect(classifyFormType("Price reduction announcement", "")).toBe("price_change");
    expect(classifyFormType("Price change requested", "")).toBe("price_change");
  });
  it("classifies amendments", () => {
    expect(classifyFormType("Amendment to listing", "")).toBe("amendment");
  });
  it("classifies docusign", () => {
    expect(classifyFormType("DocuSign completed: please file", "")).toBe("docusign");
  });
  it("classifies invoice", () => {
    expect(classifyFormType("Invoice attached", "")).toBe("invoice");
  });
  it("classifies lease last when no other match", () => {
    expect(classifyFormType("Lease for review", "")).toBe("lease");
  });
  it("falls back to general", () => {
    expect(classifyFormType("Quick question", "Just FYI")).toBe("general");
  });
});

describe("extractPropertyAddress", () => {
  it.each([
    ["Sign request — 658 N. Tustin, Orange", "658 N. Tustin"],
    ["Listing: 3315-3345 Newport Blvd. , Suite 204", "3315-3345 Newport Blvd."],
    ["Voucher 644 N. Eckhoff", "644 N. Eckhoff"],
    ["11366 Markon Dr — please review", "11366 Markon Dr"],
  ])("extracts from subject %s", (subject, expected) => {
    const addr = extractPropertyAddress(subject, "");
    expect(addr).not.toBeNull();
    expect(addr).toContain(expected.split(/[\s,]/)[0]);
  });

  it("returns null when no address present", () => {
    expect(extractPropertyAddress("Hello", "Just checking in")).toBeNull();
  });
});

describe("extractDollarAmounts", () => {
  it("captures up to three unique amounts", () => {
    const body = "Rent is $1,500 per month. Total commission $12,500.00. Deposit $1,500. Bonus $3,000.";
    const out = extractDollarAmounts(body);
    expect(out).toEqual(["$1,500", "$12,500.00", "$3,000"]);
  });
  it("returns empty for plain text", () => {
    expect(extractDollarAmounts("hi there")).toEqual([]);
  });
});

describe("extractContacts", () => {
  it("dedupes and excludes BrokerAdmin + sender", () => {
    const body = `From: alice@example.com
Cc: bob@example.com, alice@example.com
Reply to _NewportBeach-BrokerAdmin@lee-associates.com or me@lee-associates.com`;
    const out = extractContacts(body, ["me@lee-associates.com"]);
    expect(out).toContain("alice@example.com");
    expect(out).toContain("bob@example.com");
    expect(out).not.toContain("me@lee-associates.com");
    expect(out.some(e => e.includes("brokeradmin"))).toBe(false);
  });
});

describe("buildSummary", () => {
  it("cuts at common signature blocks", () => {
    const body = `Hi team,
Please process the attached voucher.
Thanks,
Errissa Kat
Broker Admin
Lee & Associates`;
    expect(buildSummary(body)).toContain("process the attached voucher");
    expect(buildSummary(body)).not.toContain("Errissa Kat");
  });
});

describe("parseEmailSubmission", () => {
  it("integrates fields end-to-end for a voucher email", () => {
    const result = parseEmailSubmission({
      subject: "Commission Voucher — 644 N. Eckhoff",
      body: "Please find attached the voucher for $12,500. Thanks,\nBob",
      from: "bob@lee-associates.com",
      toEmails: ["_NewportBeach-BrokerAdmin@lee-associates.com"],
      ccEmails: [],
    });
    expect(result.formType).toBe("voucher");
    expect(result.propertyAddress).toContain("644");
    expect(result.dollarAmount).toBe("$12,500");
    expect(result.summary).toContain("voucher");
  });
});
