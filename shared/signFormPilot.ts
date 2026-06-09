import type { QuickConvertPrefillPayload } from "./quickConvert";

export type SignPilotFields = {
  propertyAddress: string;
  city: string;
  nameRider: string;
  requestedBy: string;
  specialInstructions: string;
  accessInstructions: string;
};

export const EMPTY_SIGN_PILOT_FIELDS: SignPilotFields = {
  propertyAddress: "",
  city: "",
  nameRider: "",
  requestedBy: "",
  specialInstructions: "",
  accessInstructions: "",
};

export function signPilotFieldsToPrefill(
  fields: SignPilotFields
): QuickConvertPrefillPayload["fields"] {
  const out: Record<string, string> = {};
  const assign = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  };
  assign("propertyAddress", fields.propertyAddress);
  assign("city", fields.city);
  assign("nameRider", fields.nameRider);
  assign("requestedBy", fields.requestedBy);
  assign("specialInstructions", fields.specialInstructions);
  assign("accessInstructions", fields.accessInstructions);
  return out;
}

export function buildSignPilotPrefill(fields: SignPilotFields): QuickConvertPrefillPayload {
  return {
    version: 1,
    tab: "sign",
    fields: signPilotFieldsToPrefill(fields),
    savedAt: new Date().toISOString(),
  };
}

export function validateSignPilotFields(
  fields: SignPilotFields
): { ok: true } | { ok: false; error: string } {
  if (!fields.propertyAddress.trim()) {
    return { ok: false, error: "Property address is required." };
  }
  if (!fields.city.trim()) {
    return { ok: false, error: "City is required." };
  }
  return { ok: true };
}
