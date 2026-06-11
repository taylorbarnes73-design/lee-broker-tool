export const QUICK_CONVERT_PREFILL_STORAGE_KEY = "leeBrokerTool:quickConvertPrefill";

export const QUICK_CONVERT_MAX_BYTES = 25 * 1024 * 1024;

export const QUICK_CONVERT_LISTING_VARIANTS = [
  "industrial",
  "office",
  "retail",
  "land",
] as const;

export type QuickConvertListingVariant = (typeof QUICK_CONVERT_LISTING_VARIANTS)[number];

export const QUICK_CONVERT_KINDS = [
  "lease_to_voucher",
  "exclusive_to_sign",
  "exclusive_to_listing_industrial",
  "exclusive_to_listing_office",
  "exclusive_to_listing_retail",
  "exclusive_to_listing_land",
  "to_pdf",
  "letterhead",
] as const;

export type QuickConvertKind = (typeof QUICK_CONVERT_KINDS)[number];

export type QuickConvertPrefillPayload = {
  version: 1;
  tab: "voucher" | "sign" | "listing";
  fields: Record<string, string>;
  sourceFileUrl?: string;
  sourceFilename?: string;
  savedAt: string;
};

/** Voucher AI keys accepted by broker_tool applyAiFields (voucher tab). */
export const VOUCHER_AI_FIELD_KEYS = [
  "representationType",
  "clientName",
  "transactionType",
  "propertyType",
  "address",
  "city",
  "state",
  "zip",
  "suite",
  "buildingSf",
  "dealSf",
  "commissionRate",
  "term",
  "commencementDate",
  "expirationDate",
  "occupancyDate",
  "rateSfMo",
  "rateSfYr",
  "baseRent",
  "freeRentMonths",
  "annualEscalationPct",
  "leaseType",
  "lessorName",
  "lesseeName",
  "listingAgentName",
  "procuringAgentName",
  "totalConsideration",
  "salePrice",
  "notes",
] as const;

/** Sign AI keys accepted by broker_tool applyAiFields (sign tab). */
export const SIGN_AI_FIELD_KEYS = [
  "propertyAddress",
  "city",
  "nameRider",
  "requestedBy",
  "specialInstructions",
  "accessInstructions",
] as const;

export const VOUCHER_PREFILL_REQUIRED_FIELDS = ["address", "city"] as const;
export const SIGN_PREFILL_REQUIRED_FIELDS = ["propertyAddress", "city"] as const;

/** Listing AI keys accepted by broker_tool applyAiFields (listing tab). */
export const LISTING_AI_FIELD_KEYS = [
  "propertyType",
  "transactionType",
  "address",
  "city",
  "state",
  "zip",
  "dateEntered",
  "listingExpiration",
  "rateSfMo",
  "term",
  "leaseType",
  "buildingSf",
  "suiteSf",
  "sizeSf",
  "yearBuilt",
  "askingPrice",
  "crossStreets",
  "listingAgentName",
  "listingAgentLicense",
  "comments",
  "ownerName",
  "commissionRate",
] as const;

export const LISTING_PREFILL_REQUIRED_FIELDS = ["address", "city"] as const;

export type QuickConvertPrefillAssessment = {
  tab: "voucher" | "sign" | "listing";
  fieldCount: number;
  missingRequired: string[];
  warnings: string[];
  lowConfidence: boolean;
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const SIGN_EXTRACT_FIELD_KEYS = new Set<string>([
  ...SIGN_AI_FIELD_KEYS,
  // aiAssist.sign schema extras — filtered before apply; not all have form targets
  "state",
  "zip",
  "signType",
  "signSize",
  "quantity",
]);

export function normalizeQuickConvertFilename(filename: string): string {
  const base = String(filename ?? "")
    .trim()
    .replace(/[/\\]+/g, "_")
    .replace(/[^\w.\- ()]+/g, "_");
  return base || "document";
}

export function mimeTypeFromQuickConvertFilename(filename: string): string {
  const lower = normalizeQuickConvertFilename(filename).toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

export function isQuickConvertKind(value: string): value is QuickConvertKind {
  return (QUICK_CONVERT_KINDS as readonly string[]).includes(value);
}

export function validateQuickConvertUpload(params: {
  filename: string;
  mimeType: string;
  byteLength: number;
}): { ok: true } | { ok: false; error: string } {
  const filename = normalizeQuickConvertFilename(params.filename);
  const ext = filename.toLowerCase();
  if (!ext.endsWith(".pdf") && !ext.endsWith(".doc") && !ext.endsWith(".docx")) {
    return { ok: false, error: "Upload a .pdf, .doc, or .docx file." };
  }
  const mime = String(params.mimeType || "").trim() || mimeTypeFromQuickConvertFilename(filename);
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Unsupported file type. Use PDF or Word (.doc / .docx)." };
  }
  if (params.byteLength <= 0) {
    return { ok: false, error: "File is empty." };
  }
  if (params.byteLength > QUICK_CONVERT_MAX_BYTES) {
    return {
      ok: false,
      error: `File exceeds ${Math.floor(QUICK_CONVERT_MAX_BYTES / (1024 * 1024))} MB limit.`,
    };
  }
  return { ok: true };
}

export function listingVariantForQuickConvertKind(
  kind: QuickConvertKind
): QuickConvertListingVariant | null {
  if (kind === "exclusive_to_listing_industrial") return "industrial";
  if (kind === "exclusive_to_listing_office") return "office";
  if (kind === "exclusive_to_listing_retail") return "retail";
  if (kind === "exclusive_to_listing_land") return "land";
  return null;
}

export function isListingEntryQuickConvertKind(kind: QuickConvertKind): boolean {
  return listingVariantForQuickConvertKind(kind) !== null;
}

export function toolTabForQuickConvertKind(
  kind: QuickConvertKind
): "voucher" | "sign" | "listing" | null {
  if (kind === "lease_to_voucher") return "voucher";
  if (kind === "exclusive_to_sign") return "sign";
  if (isListingEntryQuickConvertKind(kind)) return "listing";
  return null;
}

export function buildBrokerToolTabUrl(tab: string, extraParams?: Record<string, string>): string {
  const params = new URLSearchParams({ tab });
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  return `/portal/workspace?${params.toString()}`;
}

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeIsoDate(raw: unknown): string {
  const text = str(raw);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const mmddyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

function feePercentFromCommAmount(raw: unknown): string {
  const match = str(raw).match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return "";
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return String(parsed);
}

/** Split "123 Main St, Suite 200, Irvine, CA 92618" into voucher address parts when discrete fields are blank. */
export function parseStreetAddressParts(raw: string): Partial<
  Record<"address" | "suite" | "city" | "state" | "zip", string>
> {
  const text = str(raw);
  if (!text) return {};

  const suiteMatch = text.match(/\b(?:suite|ste\.?|unit|#)\s*([#.\w-]+)\b/i);
  let suite = "";
  let street = text;
  if (suiteMatch) {
    suite = suiteMatch[1].replace(/^#/, "");
    street = text.replace(suiteMatch[0], "").replace(/\s*,\s*,/g, ",").replace(/\s*,\s*$/, "").trim();
  }

  const commaMatch = street.match(
    /^(.+?),\s*([A-Za-z][A-Za-z.\- ]+?),\s*([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (commaMatch) {
    const [, address, city, state, zip] = commaMatch;
    return {
      address: address.trim(),
      ...(suite ? { suite } : {}),
      city: city.trim(),
      state: state === "California" ? "CA" : state.toUpperCase(),
      ...(zip ? { zip } : {}),
    };
  }

  return suite ? { address: street, suite } : { address: street };
}

function termMonthsFromIsoDates(startRaw: string, endRaw: string): string {
  const start = normalizeIsoDate(startRaw);
  const end = normalizeIsoDate(endRaw);
  if (!start || !end) return "";
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return "";
  let months =
    (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) months -= 1;
  // Inclusive lease terms often end the day before the monthly anniversary (e.g. May 1 → Apr 30).
  const dayAfterEnd = new Date(e);
  dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
  if (
    dayAfterEnd.getUTCDate() === s.getUTCDate() &&
    dayAfterEnd.getUTCMonth() === s.getUTCMonth()
  ) {
    const anniversaryMonths =
      (dayAfterEnd.getUTCFullYear() - s.getUTCFullYear()) * 12 +
      (dayAfterEnd.getUTCMonth() - s.getUTCMonth());
    if (anniversaryMonths > months) months = anniversaryMonths;
  }
  return months > 0 ? String(months) : "";
}

/** Map contracts.extractContract payload into broker-tool voucher AI field keys. */
export function mapContractExtractionToVoucherFields(
  contract: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};

  let address = str(contract.propAddress);
  let city = str(contract.propCity);
  let state = str(contract.propState);
  let zip = str(contract.propZip);

  if (address) {
    const parsed = parseStreetAddressParts(address);
    if (parsed.suite && !out.suite) out.suite = parsed.suite;
    if (!city || !state || !zip) {
      if (parsed.address) address = parsed.address;
      if (!city && parsed.city) city = parsed.city;
      if (!state && parsed.state) state = parsed.state;
      if (!zip && parsed.zip) zip = parsed.zip;
    } else if (parsed.address && parsed.suite) {
      address = parsed.address;
    }
  }

  if (address) out.address = address;
  if (city) out.city = city;
  if (state) out.state = state;
  if (zip) out.zip = zip;

  const lessor = str(contract.mlLessor) || str(contract.party1Name);
  const lessee = str(contract.mlLessee);
  if (lessor) out.lessorName = lessor;
  if (lessee) {
    out.lesseeName = lessee;
    out.clientName = lessee;
  }

  const commencementDate = normalizeIsoDate(contract.termStart);
  const expirationDate = normalizeIsoDate(contract.termEnd);
  if (commencementDate) out.commencementDate = commencementDate;
  if (expirationDate) out.expirationDate = expirationDate;

  const term = termMonthsFromIsoDates(
    commencementDate || str(contract.termStart),
    expirationDate || str(contract.termEnd)
  );
  if (term) out.term = term;

  // Only map explicit percentage commission — never infer dollar amounts as rates.
  const commissionRate = feePercentFromCommAmount(contract.commAmount);
  if (commissionRate) out.commissionRate = commissionRate;

  const contractType = str(contract.contractType).toLowerCase();
  let tenantRepLease = false;
  if (contractType.includes("lease")) {
    out.transactionType = "lease";
    out.representationType = "tenant_rep";
    tenantRepLease = true;
  } else if (contractType.includes("purchase") || contractType.includes("sale")) {
    out.transactionType = "sale";
  }

  const lesseeAgent =
    str(contract.lesseeAgentIndividual) ||
    (tenantRepLease ? str(contract.agentIndividual) : "");
  const lessorAgent =
    str(contract.lessorAgentIndividual) ||
    (!tenantRepLease ? str(contract.agentIndividual) || str(contract.agentName) : str(contract.agentName));
  if (tenantRepLease) {
    if (lesseeAgent) out.procuringAgentName = lesseeAgent;
    if (lessorAgent) out.listingAgentName = lessorAgent;
  } else if (lessorAgent || lesseeAgent) {
    out.listingAgentName = lessorAgent || lesseeAgent;
  }

  const notes = [str(contract.additionalProvisions), str(contract.propDesc)].filter(Boolean).join("\n");
  if (notes) out.notes = notes;

  return out;
}

/** Keep only sign-tab AI keys and parse a combined propertyAddress when city is missing. */
export function normalizeSignExtractFields(
  fields: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (!SIGN_EXTRACT_FIELD_KEYS.has(key)) return;
    const cleaned = str(value);
    if (cleaned) out[key] = cleaned;
  });

  if (out.propertyAddress && !out.city && out.propertyAddress.includes(",")) {
    const parsed = parseStreetAddressParts(out.propertyAddress);
    if (parsed.address) {
      const suiteSuffix = parsed.suite ? `, Suite ${parsed.suite}` : "";
      out.propertyAddress = `${parsed.address}${suiteSuffix}`;
    }
    if (parsed.city) out.city = parsed.city;
  }

  // Sign form has no state/zip inputs — drop so applyAiFields does not target missing elements.
  delete out.state;
  delete out.zip;
  delete out.signType;
  delete out.signSize;
  delete out.quantity;

  return out;
}

const LISTING_EXTRACT_FIELD_KEYS = new Set<string>([...LISTING_AI_FIELD_KEYS]);

/** Map AI / brochure property labels to broker-tool l-prop-type option values. */
export function normalizeListingPropertyType(
  raw: unknown,
  forcedVariant?: QuickConvertListingVariant | null
): string {
  if (forcedVariant) return forcedVariant;
  const text = str(raw).toLowerCase();
  if (!text) return "industrial";
  if (text.includes("land") || text.includes("vacant lot")) return "land";
  if (text.includes("retail") || text.includes("storefront") || text.includes("shopping")) return "retail";
  if (text.includes("office") || text.includes("medical")) return text.includes("medical") ? "medical" : "office";
  if (text.includes("multifamily") || text.includes("multi-family") || text.includes("apartment")) {
    return "multifamily";
  }
  if (text.includes("industrial") || text.includes("warehouse") || text.includes("distribution")) {
    return "industrial";
  }
  return "industrial";
}

function normalizeListingTransactionType(raw: unknown): string {
  const text = str(raw).toLowerCase();
  if (!text) return "";
  if (text.includes("sale") && text.includes("lease")) return "lease";
  if (text.includes("sale")) return "sale";
  if (text.includes("lease") || text.includes("sublease")) return "lease";
  return "";
}

/** Keep listing-tab AI keys and normalize property / transaction selects for broker tool. */
export function normalizeListingExtractFields(
  fields: Record<string, unknown>,
  options?: { forcedVariant?: QuickConvertListingVariant | null }
): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (!LISTING_EXTRACT_FIELD_KEYS.has(key)) return;
    const cleaned = str(value);
    if (cleaned) out[key] = cleaned;
  });

  const propertyType = normalizeListingPropertyType(
    out.propertyType,
    options?.forcedVariant ?? null
  );
  out.propertyType = propertyType;

  const txn = normalizeListingTransactionType(out.transactionType);
  if (txn) out.transactionType = txn;

  if (out.address && !out.city && out.address.includes(",")) {
    const parsed = parseStreetAddressParts(out.address);
    if (parsed.address) out.address = parsed.address;
    if (parsed.city) out.city = parsed.city;
    if (parsed.state) out.state = parsed.state;
    if (parsed.zip) out.zip = parsed.zip;
  }

  if (!out.state) out.state = "CA";

  if (!out.dateEntered) {
    const today = new Date();
    out.dateEntered = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  return out;
}

export function assessQuickConvertPrefill(
  tab: "voucher" | "sign" | "listing",
  fields: Record<string, string>
): QuickConvertPrefillAssessment {
  const fieldCount = Object.keys(fields).length;
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  if (tab === "voucher") {
    for (const key of VOUCHER_PREFILL_REQUIRED_FIELDS) {
      if (!str(fields[key])) missingRequired.push(key);
    }
    if (!str(fields.lesseeName) && !str(fields.clientName)) {
      missingRequired.push("lesseeName");
    }
    if (!str(fields.commencementDate)) {
      warnings.push("Commencement date not found in document.");
    }
    if (!str(fields.commissionRate)) {
      warnings.push("Commission rate not found (only explicit % values are mapped).");
    }
  } else if (tab === "sign") {
    for (const key of SIGN_PREFILL_REQUIRED_FIELDS) {
      if (!str(fields[key])) missingRequired.push(key);
    }
    if (!str(fields.requestedBy)) {
      warnings.push("Requested By agent name not found in document.");
    }
  } else {
    for (const key of LISTING_PREFILL_REQUIRED_FIELDS) {
      if (!str(fields[key])) missingRequired.push(key);
    }
    if (!str(fields.listingExpiration)) {
      warnings.push("Listing expiration date not found — set it before submitting.");
    }
    if (!str(fields.transactionType)) {
      warnings.push("Transaction type (lease/sale) not detected — pick Lease or Sale.");
    }
    if (!str(fields.listingAgentName)) {
      warnings.push("Listing agent name not found in document.");
    }
  }

  if (fieldCount < 3) {
    warnings.push("Very few fields extracted — review the entire form carefully.");
  }

  const lowConfidence = missingRequired.length > 0 || fieldCount < 3;

  return { tab, fieldCount, missingRequired, warnings, lowConfidence };
}

export function formatQuickConvertPrefillWarnings(assessment: QuickConvertPrefillAssessment): string {
  const parts: string[] = [];
  if (assessment.missingRequired.length) {
    parts.push(`Missing required: ${assessment.missingRequired.join(", ")}`);
  }
  parts.push(...assessment.warnings);
  return parts.filter(Boolean).join(" ");
}

export function serializeQuickConvertPrefill(payload: QuickConvertPrefillPayload): string {
  return JSON.stringify(payload);
}

export function parseQuickConvertPrefill(raw: string): QuickConvertPrefillPayload | null {
  try {
    const parsed = JSON.parse(raw) as QuickConvertPrefillPayload;
    if (parsed?.version !== 1) return null;
    if (parsed.tab !== "voucher" && parsed.tab !== "sign" && parsed.tab !== "listing") return null;
    if (!parsed.fields || typeof parsed.fields !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}
