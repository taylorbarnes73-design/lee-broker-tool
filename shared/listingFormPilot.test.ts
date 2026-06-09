import { describe, expect, it } from "vitest";
import {
  buildListingPilotPrefill,
  validateListingPilotFields,
  EMPTY_LISTING_PILOT_FIELDS,
} from "./listingFormPilot";

describe("listingFormPilot", () => {
  it("builds a listing prefill payload for the broker tool", () => {
    const payload = buildListingPilotPrefill({
      ...EMPTY_LISTING_PILOT_FIELDS,
      address: "1450 Von Karman Ave",
      city: "Irvine",
      zip: "92612",
      buildingSf: "52000",
      rateSfMo: "1.15",
      listingAgentName: "Taylor Barnes",
    });
    expect(payload.tab).toBe("listing");
    expect(payload.fields.address).toBe("1450 Von Karman Ave");
    expect(payload.fields.city).toBe("Irvine");
    expect(payload.fields.propertyType).toBe("industrial");
    expect(payload.fields.transactionType).toBe("lease");
    expect(payload.fields.zip).toBe("92612");
    expect(payload.fields.buildingSf).toBe("52000");
    expect(payload.fields.rateSfMo).toBe("1.15");
    expect(payload.fields.listingAgentName).toBe("Taylor Barnes");
  });

  it("requires property address and city", () => {
    expect(validateListingPilotFields(EMPTY_LISTING_PILOT_FIELDS).ok).toBe(false);
    const valid = validateListingPilotFields({
      ...EMPTY_LISTING_PILOT_FIELDS,
      address: "1 Main",
      city: "Newport Beach",
    });
    expect(valid.ok).toBe(true);
  });
});
