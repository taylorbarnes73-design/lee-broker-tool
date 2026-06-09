import { describe, expect, it } from "vitest";
import {
  buildSignPilotPrefill,
  validateSignPilotFields,
  EMPTY_SIGN_PILOT_FIELDS,
} from "./signFormPilot";

describe("signFormPilot", () => {
  it("builds a sign prefill payload for the broker tool", () => {
    const payload = buildSignPilotPrefill({
      ...EMPTY_SIGN_PILOT_FIELDS,
      propertyAddress: "500 Anton Blvd",
      city: "Costa Mesa",
      requestedBy: "Taylor Barnes",
      nameRider: "Acme Industrial",
    });
    expect(payload.tab).toBe("sign");
    expect(payload.fields.propertyAddress).toBe("500 Anton Blvd");
    expect(payload.fields.city).toBe("Costa Mesa");
    expect(payload.fields.requestedBy).toBe("Taylor Barnes");
    expect(payload.fields.nameRider).toBe("Acme Industrial");
  });

  it("requires property address and city", () => {
    expect(validateSignPilotFields(EMPTY_SIGN_PILOT_FIELDS).ok).toBe(false);
    const valid = validateSignPilotFields({
      ...EMPTY_SIGN_PILOT_FIELDS,
      propertyAddress: "1 Main",
      city: "Irvine",
    });
    expect(valid.ok).toBe(true);
  });
});
