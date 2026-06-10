import { describe, expect, it } from "vitest";
import {
  buildVoucherPilotPrefill,
  normalizeVoucherPilotPropertyType,
  normalizeVoucherPilotRepType,
  validateVoucherPilotFields,
  voucherPilotClientPartyField,
  voucherPilotRepMapsToOther,
  EMPTY_VOUCHER_PILOT_FIELDS,
} from "./voucherFormPilot";

describe("voucherFormPilot", () => {
  it("builds a voucher prefill payload for the broker tool", () => {
    const payload = buildVoucherPilotPrefill({
      ...EMPTY_VOUCHER_PILOT_FIELDS,
      clientName: "Acme Logistics",
      address: "123 Main St",
      suite: "Suite 200",
      city: "Irvine",
      zip: "92618",
      dealSf: "12500",
    });
    expect(payload.tab).toBe("voucher");
    expect(payload.fields.representationType).toBe("tenant_rep");
    expect(payload.fields.lesseeName).toBe("Acme Logistics");
    expect(payload.fields.clientName).toBeUndefined();
    expect(payload.fields.address).toBe("123 Main St");
    expect(payload.fields.suite).toBe("Suite 200");
    expect(payload.fields.dealSf).toBe("12500");
    expect(payload.fields.propertyType).toBe("industrial");
  });

  it("maps landlord rep client name to lessor company field", () => {
    const payload = buildVoucherPilotPrefill({
      ...EMPTY_VOUCHER_PILOT_FIELDS,
      representationType: "Landlord Rep",
      clientName: "Big Landlord LLC",
      address: "456 Oak Ave",
      city: "Newport Beach",
    });
    expect(payload.fields.representationType).toBe("landlord_rep");
    expect(payload.fields.lessorName).toBe("Big Landlord LLC");
    expect(payload.fields.lesseeName).toBeUndefined();
    expect(payload.fields.clientName).toBeUndefined();
  });

  it("normalizes portal representation labels to broker values", () => {
    expect(normalizeVoucherPilotRepType("Tenant Rep")).toBe("tenant_rep");
    expect(normalizeVoucherPilotRepType("Landlord Rep")).toBe("landlord_rep");
    expect(normalizeVoucherPilotRepType("Dual Agency")).toBe("other");
    expect(normalizeVoucherPilotRepType("Co-op")).toBe("other");
    expect(voucherPilotClientPartyField("Tenant Rep")).toBe("lesseeName");
    expect(voucherPilotClientPartyField("Landlord Rep")).toBe("lessorName");
    expect(voucherPilotRepMapsToOther("Dual Agency")).toBe(true);
    expect(voucherPilotRepMapsToOther("Co-op")).toBe(true);
    expect(voucherPilotRepMapsToOther("Tenant Rep")).toBe(false);
  });

  it("normalizes portal property type labels to broker values", () => {
    expect(normalizeVoucherPilotPropertyType("Office")).toBe("office");
    expect(normalizeVoucherPilotPropertyType("Other")).toBe("other");
    const payload = buildVoucherPilotPrefill({
      ...EMPTY_VOUCHER_PILOT_FIELDS,
      propertyType: "Retail",
      clientName: "Tenant Co",
      address: "1 Main",
      city: "Newport Beach",
    });
    expect(payload.fields.propertyType).toBe("retail");
  });

  it("requires address, city, and client name", () => {
    expect(validateVoucherPilotFields(EMPTY_VOUCHER_PILOT_FIELDS).ok).toBe(false);
    const valid = validateVoucherPilotFields({
      ...EMPTY_VOUCHER_PILOT_FIELDS,
      clientName: "Tenant Co",
      address: "1 Main",
      city: "Newport Beach",
    });
    expect(valid.ok).toBe(true);
  });
});
