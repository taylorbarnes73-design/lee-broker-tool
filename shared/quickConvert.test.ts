import { describe, expect, it } from "vitest";
import {
  assessQuickConvertPrefill,
  formatQuickConvertPrefillWarnings,
  isQuickConvertKind,
  mapContractExtractionToVoucherFields,
  normalizeListingExtractFields,
  normalizeListingPropertyType,
  normalizeSignExtractFields,
  parseQuickConvertPrefill,
  parseStreetAddressParts,
  serializeQuickConvertPrefill,
  toolTabForQuickConvertKind,
  validateQuickConvertUpload,
} from "./quickConvert";

describe("quickConvert shared", () => {
  it("validates allowed uploads and rejects bad types", () => {
    expect(
      validateQuickConvertUpload({
        filename: "lease.pdf",
        mimeType: "application/pdf",
        byteLength: 1024,
      }).ok
    ).toBe(true);
    expect(
      validateQuickConvertUpload({
        filename: "notes.txt",
        mimeType: "text/plain",
        byteLength: 10,
      }).ok
    ).toBe(false);
    expect(
      validateQuickConvertUpload({
        filename: "empty.pdf",
        mimeType: "application/pdf",
        byteLength: 0,
      }).ok
    ).toBe(false);
  });

  it("maps lease contract extraction to voucher AI fields", () => {
    const fields = mapContractExtractionToVoucherFields({
      contractType: "Lease Agreement",
      propAddress: "100 Main St",
      propCity: "Irvine",
      propState: "CA",
      propZip: "92614",
      mlLessor: "Owner LLC",
      mlLessee: "Tenant Inc",
      termStart: "01/01/2026",
      termEnd: "12/31/2028",
      commAmount: "6% of base rent",
      agentIndividual: "Taylor Barnes",
    });
    expect(fields.address).toBe("100 Main St");
    expect(fields.city).toBe("Irvine");
    expect(fields.lessorName).toBe("Owner LLC");
    expect(fields.lesseeName).toBe("Tenant Inc");
    expect(fields.clientName).toBe("Tenant Inc");
    expect(fields.commissionRate).toBe("6");
    expect(fields.transactionType).toBe("lease");
    expect(fields.representationType).toBe("tenant_rep");
    expect(fields.procuringAgentName).toBe("Taylor Barnes");
    expect(fields.listingAgentName).toBeUndefined();
    expect(fields.commencementDate).toBe("2026-01-01");
    expect(fields.expirationDate).toBe("2028-12-31");
    expect(fields.term).toBe("36");
  });

  it("maps lessor agent to listing and lessee agent to procuring on tenant-rep leases", () => {
    const fields = mapContractExtractionToVoucherFields({
      contractType: "Lease Agreement",
      propAddress: "2961 W. MacArthur Blvd",
      propCity: "Santa Ana",
      propState: "CA",
      propZip: "92704",
      mlLessor: "MacArthur Fairview Park, LLC",
      mlLessee: "KAEV Corporation",
      termStart: "2026-05-01",
      termEnd: "2029-04-30",
      lessorAgentIndividual: "Carter Harrington",
    });
    expect(fields.listingAgentName).toBe("Carter Harrington");
    expect(fields.procuringAgentName).toBeUndefined();
    expect(fields.term).toBe("36");
  });

  it("parses combined property address into discrete voucher fields", () => {
    const fields = mapContractExtractionToVoucherFields({
      contractType: "Lease Agreement",
      propAddress: "500 Technology Drive, Suite 120, Irvine, CA 92618",
      mlLessee: "Acme Corp",
    });
    expect(fields.address).toBe("500 Technology Drive");
    expect(fields.suite).toBe("120");
    expect(fields.city).toBe("Irvine");
    expect(fields.state).toBe("CA");
    expect(fields.zip).toBe("92618");
    expect(fields.clientName).toBe("Acme Corp");
  });

  it("does not map flat-dollar commission amounts to commissionRate", () => {
    const fields = mapContractExtractionToVoucherFields({
      contractType: "Lease Agreement",
      propAddress: "1 Main",
      propCity: "Newport Beach",
      commAmount: "$25,000",
    });
    expect(fields.commissionRate).toBeUndefined();
  });

  it("maps sale contracts to listing agent instead of procuring agent", () => {
    const fields = mapContractExtractionToVoucherFields({
      contractType: "Purchase Agreement",
      propAddress: "9 Harbor",
      propCity: "Newport Beach",
      agentIndividual: "Lee Agent",
    });
    expect(fields.transactionType).toBe("sale");
    expect(fields.listingAgentName).toBe("Lee Agent");
    expect(fields.procuringAgentName).toBeUndefined();
  });

  it("keeps suite in sign propertyAddress when splitting city", () => {
    const fields = normalizeSignExtractFields({
      propertyAddress: "16520 Bake Pkwy, Suite 115, Irvine, CA 92618",
      requestedBy: "Stephen A. Madigan",
      nameRider: "Lee & Associates - Newport Beach",
    });
    expect(fields.propertyAddress).toBe("16520 Bake Pkwy, Suite 115");
    expect(fields.city).toBe("Irvine");
  });

  it("normalizes exclusive-right sign extract fields for broker tool", () => {
    const fields = normalizeSignExtractFields({
      propertyAddress: "200 Spectrum Center Drive, Irvine, CA 92618",
      requestedBy: "Jane Broker",
      nameRider: "Jane Broker",
      specialInstructions: "Install on corner lot",
      accessInstructions: "yes",
      signType: "4x8",
      quantity: "2",
      state: "CA",
      zip: "92618",
      bogusField: "drop me",
    });
    expect(fields.propertyAddress).toBe("200 Spectrum Center Drive");
    expect(fields.city).toBe("Irvine");
    expect(fields.requestedBy).toBe("Jane Broker");
    expect(fields.nameRider).toBe("Jane Broker");
    expect(fields.specialInstructions).toBe("Install on corner lot");
    expect(fields.state).toBeUndefined();
    expect(fields.zip).toBeUndefined();
    expect(fields.signType).toBeUndefined();
    expect((fields as Record<string, string>).bogusField).toBeUndefined();
  });

  it("assesses low-confidence voucher prefill when required fields missing", () => {
    const assessment = assessQuickConvertPrefill("voucher", {
      address: "100 Main",
    });
    expect(assessment.lowConfidence).toBe(true);
    expect(assessment.missingRequired).toContain("city");
    expect(assessment.missingRequired).toContain("lesseeName");
    expect(formatQuickConvertPrefillWarnings(assessment)).toContain("Missing required");
  });

  it("assesses sign prefill and warns when requestedBy is absent", () => {
    const assessment = assessQuickConvertPrefill("sign", {
      propertyAddress: "9 Main Street",
      city: "Newport Beach",
      nameRider: "Lee & Associates",
    });
    expect(assessment.lowConfidence).toBe(false);
    expect(assessment.warnings.some(w => w.includes("Requested By"))).toBe(true);
  });

  it("parses street address parts for suite and city", () => {
    expect(parseStreetAddressParts("500 Tech Dr, Suite 120, Irvine, CA 92618")).toMatchObject({
      address: "500 Tech Dr",
      suite: "120",
      city: "Irvine",
      state: "CA",
      zip: "92618",
    });
  });

  it("normalizes listing extract fields for broker tool listing tab", () => {
    const fields = normalizeListingExtractFields(
      {
        propertyType: "Office Building",
        transactionType: "Exclusive Right to Lease",
        address: "200 Spectrum Center Drive, Irvine, CA 92618",
        listingAgentName: "Jane Broker",
        rateSfMo: "2.85",
        buildingSf: "12000",
        listingExpiration: "2027-06-01",
      },
      { forcedVariant: "office" }
    );
    expect(fields.propertyType).toBe("office");
    expect(fields.transactionType).toBe("lease");
    expect(fields.address).toBe("200 Spectrum Center Drive");
    expect(fields.city).toBe("Irvine");
    expect(fields.state).toBe("CA");
    expect(fields.zip).toBe("92618");
    expect(fields.listingAgentName).toBe("Jane Broker");
    expect(fields.dateEntered).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("infers listing property type labels", () => {
    expect(normalizeListingPropertyType("Retail storefront")).toBe("retail");
    expect(normalizeListingPropertyType("Vacant land parcel")).toBe("land");
    expect(normalizeListingPropertyType("Warehouse / distribution")).toBe("industrial");
  });

  it("assesses listing prefill when expiration is missing", () => {
    const assessment = assessQuickConvertPrefill("listing", {
      address: "100 Main",
      city: "Irvine",
      propertyType: "industrial",
    });
    expect(assessment.warnings.some(w => w.includes("expiration"))).toBe(true);
  });

  it("resolves workflow tabs for each quick-convert kind", () => {
    expect(toolTabForQuickConvertKind("lease_to_voucher")).toBe("voucher");
    expect(toolTabForQuickConvertKind("exclusive_to_sign")).toBe("sign");
    expect(toolTabForQuickConvertKind("exclusive_to_listing_land")).toBe("listing");
    expect(toolTabForQuickConvertKind("to_pdf")).toBeNull();
    expect(isQuickConvertKind("letterhead")).toBe(true);
    expect(isQuickConvertKind("nope")).toBe(false);
  });

  it("round-trips portal prefill payload", () => {
    const payload = {
      version: 1 as const,
      tab: "sign" as const,
      fields: { propertyAddress: "200 Spectrum" },
      savedAt: new Date().toISOString(),
    };
    const parsed = parseQuickConvertPrefill(serializeQuickConvertPrefill(payload));
    expect(parsed?.fields.propertyAddress).toBe("200 Spectrum");
  });
});
