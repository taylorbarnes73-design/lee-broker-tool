/**
 * Maps broker-tool "listing" tab string fields to Buildout API v1 property attributes.
 * Buildout requires integer enum IDs (property_type_id, property_subtype_id, broker_id) — those come from the caller, not the brochure.
 */

export type ListingTabFields = Record<string, string | undefined>;

function digitsOnly(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseMoney(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = parseFloat(raw.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns a partial `property` object for Buildout POST/PUT (nested under `{ property: ... }`).
 */
export function mapListingFieldsToBuildoutProperty(fields: ListingTabFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (fields.address?.trim()) out.address = fields.address.trim();
  if (fields.city?.trim()) out.city = fields.city.trim();
  if (fields.state?.trim()) out.state = fields.state.trim().slice(0, 2).toUpperCase();
  if (fields.zip?.trim()) out.zip = fields.zip.trim();

  const nameParts = [fields.address, fields.city, fields.state].filter(Boolean).join(", ");
  if (nameParts) out.name = nameParts.slice(0, 500);

  const bsf = digitsOnly(fields.buildingSf);
  if (bsf != null) out.building_size_sf = bsf;

  const tx = (fields.transactionType ?? "").toLowerCase();
  if (tx.includes("sale")) {
    out.sale = true;
    const sp = parseMoney(fields.askingPrice);
    if (sp != null) out.sale_price_dollars = sp;
  }

  const descParts: string[] = [];
  if (fields.comments?.trim()) descParts.push(fields.comments.trim());
  if (fields.propertyType?.trim()) descParts.push(`Property type (brochure): ${fields.propertyType.trim()}`);
  if (fields.transactionType?.trim()) descParts.push(`Transaction: ${fields.transactionType.trim()}`);
  if (fields.leaseType?.trim()) descParts.push(`Lease type: ${fields.leaseType.trim()}`);
  if (fields.rateSfMo?.trim()) descParts.push(`Rate ($/SF/Mo): ${fields.rateSfMo.trim()}`);
  if (fields.term?.trim()) descParts.push(`Term (months): ${fields.term.trim()}`);
  const suite = digitsOnly(fields.suiteSf);
  if (suite != null) descParts.push(`Suite / unit SF (approx): ${suite}`);
  if (fields.listingAgentName?.trim()) descParts.push(`Listing agent: ${fields.listingAgentName.trim()}`);
  if (fields.listingAgentLicense?.trim()) descParts.push(`License: ${fields.listingAgentLicense.trim()}`);

  if (descParts.length) {
    out.site_description = descParts.join("\n").slice(0, 50_000);
  }

  return out;
}
