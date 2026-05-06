import {
  buildDealEntryFromSubmissionPayload,
  pushDealEntryToDealius,
  validateDealEntryForDealiusPush,
} from "./dealiusEntry";

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function parseAddressParts(raw: string): { address?: string; city?: string; state?: string; zip?: string } {
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (!match) return {};
  const [, address, city, state, zip] = match;
  return {
    address: address.trim(),
    city: city.trim(),
    state: state.toLowerCase() === "california" ? "CA" : state.toUpperCase(),
    zip: zip ? zip.replace(/\D/g, "").slice(0, 5) : undefined,
  };
}

/** Same address / deal-name resolution as Dealius push (keeps validation in sync). */
export function resolveVoucherLocationForDealius(payload: Record<string, unknown>) {
  const p = payload ?? {};
  const rawAddress = str(p.address || p.propertyAddress || (p as any).property || "");
  const parts = parseAddressParts(rawAddress);
  const address = str(p.address || parts.address || rawAddress);
  const city = str(p.city || parts.city);
  const zip = str(p.zip || p.zipCode || parts.zip);
  const dealName =
    str(p.dealName) ||
    [str(p.transactionType || p.txnType || "Deal") + ":", address].filter(Boolean).join(" ");
  return { address, city, zip, dealName, rawAddress };
}

/**
 * Validates a voucher submission payload before calling Dealius.
 * Mirrors the portal pre-flight checklist; returns 400-friendly errors.
 */
export function validateVoucherPayloadForDealiusPush(
  payload: Record<string, unknown>
): { ok: true } | { ok: false; errors: string[] } {
  return validateDealEntryForDealiusPush(buildDealEntryFromSubmissionPayload(payload ?? {}));
}

export async function pushVoucherSubmissionToDealius(params: {
  payload: Record<string, unknown>;
}) {
  return pushDealEntryToDealius({
    entry: buildDealEntryFromSubmissionPayload(params.payload ?? {}),
  });
}
