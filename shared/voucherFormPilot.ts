import type { QuickConvertPrefillPayload } from "./quickConvert";

export const VOUCHER_TRANSACTION_TYPES = ["Lease", "Sale"] as const;
export const VOUCHER_REPRESENTATION_TYPES = [
  "Tenant Rep",
  "Landlord Rep",
  "Dual Agency",
  "Co-op",
] as const;

export type VoucherPilotFields = {
  transactionType: string;
  representationType: string;
  clientName: string;
  address: string;
  suite: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  dealSf: string;
};

export const EMPTY_VOUCHER_PILOT_FIELDS: VoucherPilotFields = {
  transactionType: "Lease",
  representationType: "Tenant Rep",
  clientName: "",
  address: "",
  suite: "",
  city: "",
  state: "CA",
  zip: "",
  propertyType: "",
  dealSf: "",
};

/** Portal labels → broker tool v-rep-type option values. */
export function normalizeVoucherPilotRepType(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const map: Record<string, string> = {
    tenant_rep: "tenant_rep",
    tenant: "tenant_rep",
    landlord_rep: "landlord_rep",
    landlord: "landlord_rep",
    buyer_rep: "buyer_rep",
    buyer: "buyer_rep",
    seller_rep: "seller_rep",
    seller: "seller_rep",
    dual_agency: "other",
    dual: "other",
    co_op: "other",
    coop: "other",
  };
  return map[key] ?? label.trim();
}

/** Target AI field for the represented client's company name. */
export function voucherPilotClientPartyField(
  representationType: string
): "lesseeName" | "lessorName" | null {
  const rep = normalizeVoucherPilotRepType(representationType);
  if (rep === "tenant_rep" || rep === "buyer_rep") return "lesseeName";
  if (rep === "landlord_rep" || rep === "seller_rep") return "lessorName";
  return null;
}

export function voucherPilotFieldsToPrefill(
  fields: VoucherPilotFields
): QuickConvertPrefillPayload["fields"] {
  const out: Record<string, string> = {};
  const assign = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  };
  assign("transactionType", fields.transactionType);
  assign("representationType", normalizeVoucherPilotRepType(fields.representationType));
  const clientName = fields.clientName.trim();
  if (clientName) {
    const partyField = voucherPilotClientPartyField(fields.representationType);
    if (partyField) assign(partyField, clientName);
    else assign("clientName", clientName);
  }
  assign("address", fields.address);
  assign("suite", fields.suite);
  assign("city", fields.city);
  assign("state", fields.state);
  assign("zip", fields.zip);
  assign("propertyType", fields.propertyType);
  assign("dealSf", fields.dealSf);
  return out;
}

export function buildVoucherPilotPrefill(fields: VoucherPilotFields): QuickConvertPrefillPayload {
  return {
    version: 1,
    tab: "voucher",
    fields: voucherPilotFieldsToPrefill(fields),
    savedAt: new Date().toISOString(),
  };
}

export function validateVoucherPilotFields(
  fields: VoucherPilotFields
): { ok: true } | { ok: false; error: string } {
  if (!fields.address.trim()) {
    return { ok: false, error: "Property address is required." };
  }
  if (!fields.city.trim()) {
    return { ok: false, error: "City is required." };
  }
  if (!fields.clientName.trim()) {
    return { ok: false, error: "Client name is required." };
  }
  return { ok: true };
}
