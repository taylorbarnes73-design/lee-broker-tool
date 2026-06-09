import { describe, expect, it } from "vitest";
import {
  buildVoucherPilotPrefill,
  validateVoucherPilotFields,
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
    expect(payload.fields.clientName).toBe("Acme Logistics");
    expect(payload.fields.address).toBe("123 Main St");
    expect(payload.fields.suite).toBe("Suite 200");
    expect(payload.fields.dealSf).toBe("12500");
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
