import type { QuickConvertPrefillPayload } from "./quickConvert";

export const LISTING_PROPERTY_TYPES = [
  "Industrial",
  "Office",
  "Retail",
  "Medical",
  "Land",
  "Multifamily",
] as const;
export const LISTING_TRANSACTION_TYPES = ["Lease", "Sale"] as const;

export type ListingPilotFields = {
  propertyType: string;
  transactionType: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  buildingSf: string;
  rateSfMo: string;
  askingPrice: string;
  ownerName: string;
  listingAgentName: string;
  comments: string;
};

export const EMPTY_LISTING_PILOT_FIELDS: ListingPilotFields = {
  propertyType: "Industrial",
  transactionType: "Lease",
  address: "",
  city: "",
  state: "CA",
  zip: "",
  buildingSf: "",
  rateSfMo: "",
  askingPrice: "",
  ownerName: "",
  listingAgentName: "",
  comments: "",
};

function normalizeSelectValue(value: string): string {
  return value.trim().toLowerCase();
}

export function listingPilotFieldsToPrefill(
  fields: ListingPilotFields
): QuickConvertPrefillPayload["fields"] {
  const out: Record<string, string> = {};
  const assign = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  };
  assign("propertyType", normalizeSelectValue(fields.propertyType));
  assign("transactionType", normalizeSelectValue(fields.transactionType));
  assign("address", fields.address);
  assign("city", fields.city);
  assign("state", fields.state);
  assign("zip", fields.zip);
  assign("buildingSf", fields.buildingSf);
  assign("rateSfMo", fields.rateSfMo);
  assign("askingPrice", fields.askingPrice);
  assign("ownerName", fields.ownerName);
  assign("listingAgentName", fields.listingAgentName);
  assign("comments", fields.comments);
  return out;
}

export function buildListingPilotPrefill(fields: ListingPilotFields): QuickConvertPrefillPayload {
  return {
    version: 1,
    tab: "listing",
    fields: listingPilotFieldsToPrefill(fields),
    savedAt: new Date().toISOString(),
  };
}

export function validateListingPilotFields(
  fields: ListingPilotFields
): { ok: true } | { ok: false; error: string } {
  if (!fields.address.trim()) {
    return { ok: false, error: "Property address is required." };
  }
  if (!fields.city.trim()) {
    return { ok: false, error: "City is required." };
  }
  return { ok: true };
}
