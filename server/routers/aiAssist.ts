import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, invokeLLMWithFile, isGeminiDirectAvailable, isClaudeFallbackAvailable, invokeClaudeWithFile } from "../_core/llm";
import { extractJsonText } from "../_core/llmJson";
import { z } from "zod/v4";
import { getSetting } from "../settings/getSetting";
import { isStoredFileReference, storageGetBytes } from "../storage";
import { TRPCError } from "@trpc/server";

/**
 * Map raw LLM/provider errors to plain-language messages safe to show a broker.
 * Internal details (API keys, provider names, stack traces) are logged but never
 * surfaced verbatim in the UI.
 */
function friendlyAiError(error: unknown): TRPCError {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("[aiAssist]", raw);
  const lower = raw.toLowerCase();
  let message = "The AI service hit a problem. Please try again in a moment.";
  if (lower.includes("no ai backend") || lower.includes("no llm") || lower.includes("api key") || lower.includes("not configured")) {
    message = "AI assist isn't configured on the server yet. Please contact your admin.";
  } else if (lower.includes("rate") && lower.includes("limit")) {
    message = "The AI service is busy right now. Please wait a moment and try again.";
  } else if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    message = "The AI request timed out. Please try again.";
  } else if (lower.includes("could not") || lower.includes("no readable") || lower.includes("parse")) {
    message = "The AI couldn't read that input. Try rephrasing or entering the details manually.";
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

// ── Field schemas per tab ──

const listingFields = z.object({
  propertyType: z.string().optional(),
  transactionType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  rateSfMo: z.string().optional(),
  term: z.string().optional(),
  leaseType: z.string().optional(),
  buildingSf: z.string().optional(),
  suiteSf: z.string().optional(),
  askingPrice: z.string().optional(),
  listingExpiration: z.string().optional(),
  dateEntered: z.string().optional(),
  ownerName: z.string().optional(),
  commissionRate: z.string().optional(),
  crossStreets: z.string().optional(),
  yearBuilt: z.string().optional(),
  listingAgentName: z.string().optional(),
  listingAgentLicense: z.string().optional(),
  comments: z.string().optional(),
});

const voucherFields = z.object({
  representationType: z.string().optional(),
  clientName: z.string().optional(),
  transactionType: z.string().optional(),
  propertyType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  suite: z.string().optional(),
  buildingSf: z.string().optional(),
  dealSf: z.string().optional(),
  commissionRate: z.string().optional(),
  term: z.string().optional(),
  commencementDate: z.string().optional(),
  expirationDate: z.string().optional(),
  occupancyDate: z.string().optional(),
  rateSfMo: z.string().optional(),
  rateSfYr: z.string().optional(),
  baseRent: z.string().optional(),
  freeRentMonths: z.string().optional(),
  annualEscalationPct: z.string().optional(),
  leaseType: z.string().optional(),
  lessorName: z.string().optional(),
  lesseeName: z.string().optional(),
  listingAgentName: z.string().optional(),
  procuringAgentName: z.string().optional(),
  totalConsideration: z.string().optional(),
  salePrice: z.string().optional(),
  notes: z.string().optional(),
});

const signFields = z.object({
  propertyAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  signType: z.string().optional(),
  signSize: z.string().optional(),
  quantity: z.string().optional(),
  nameRider: z.string().optional(),
  requestedBy: z.string().optional(),
  specialInstructions: z.string().optional(),
  accessInstructions: z.string().optional(),
});

const compFields = z.object({
  compType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  buildingSf: z.string().optional(),
  dealSf: z.string().optional(),
  leaseRate: z.string().optional(),
  term: z.string().optional(),
  commencementDate: z.string().optional(),
  tenantName: z.string().optional(),
  landlordName: z.string().optional(),
  salePrice: z.string().optional(),
  pricePerSf: z.string().optional(),
  propertyType: z.string().optional(),
  brokerName: z.string().optional(),
  comments: z.string().optional(),
});

const tabFieldSchemas: Record<string, z.ZodObject<any>> = {
  listing: listingFields,
  voucher: voucherFields,
  sign: signFields,
  comp: compFields,
};

type FormTab = keyof typeof tabFieldSchemas;
type AiDocumentMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const formTabSchema = z.enum(["listing", "voucher", "sign", "comp"]);
const aiDocumentMimeSchema = z
  .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  .default("application/pdf");

type VoucherSuggestion = {
  field: string;
  issue: string;
  suggestion: string;
  reason: string;
  inputId: string | null;
};

const propertyTypeMap: Record<string, string> = {
  industrial: "Industrial",
  office: "Office",
  retail: "Retail",
  medical: "Medical",
  "medical office": "Medical",
  healthcare: "Medical",
  "health care": "Medical",
  land: "Land",
  multifamily: "Multi-Family",
  "multi family": "Multi-Family",
  "multi-family": "Multi-Family",
  other: "Other",
};

const transactionTypeMap: Record<string, string> = {
  lease: "Lease",
  leasing: "Lease",
  sale: "Sale",
  purchase: "Sale",
};

const representationTypeMap: Record<string, string> = {
  "tenant rep": "Tenant Rep",
  tenant: "Tenant Rep",
  "landlord rep": "Landlord Rep",
  landlord: "Landlord Rep",
  "buyer rep": "Buyer Rep",
  buyer: "Buyer Rep",
  "seller rep": "Seller Rep",
  seller: "Seller Rep",
  dual: "Dual",
};

const leaseTypeMap: Record<string, string> = {
  nnn: "NNN",
  triple: "NNN",
  "triple net": "NNN",
  fsg: "FSG",
  "full service": "FSG",
  "full service gross": "FSG",
  mg: "MG",
  modified: "MG",
  "modified gross": "MG",
  gross: "Gross",
  net: "Net",
};

const southernCaliforniaCities = new Set([
  "anaheim",
  "brea",
  "buena park",
  "carlsbad",
  "cerritos",
  "chino",
  "chino hills",
  "corona",
  "costa mesa",
  "cypress",
  "foothill ranch",
  "fountain valley",
  "fullerton",
  "garden grove",
  "huntington beach",
  "irvine",
  "la habra",
  "lake forest",
  "laguna beach",
  "laguna hills",
  "laguna niguel",
  "mission viejo",
  "newport beach",
  "orange",
  "placentia",
  "rancho santa margarita",
  "san clemente",
  "san juan capistrano",
  "santa ana",
  "tustin",
  "yorba linda",
]);

function cleanString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(v => String(v ?? "")).join("\n");
  return "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeEnum(
  raw: unknown,
  allowedMap: Record<string, string>
): string | undefined {
  const value = normalizeWhitespace(cleanString(raw)).toLowerCase();
  if (!value) return undefined;

  // Exact match first
  if (allowedMap[value]) return allowedMap[value];

  // Check if any key is contained within the value (e.g., "industrial/warehouse" contains "industrial")
  for (const [key, mapped] of Object.entries(allowedMap)) {
    if (value.includes(key)) return mapped;
  }

  // Check if the value starts with any key
  for (const [key, mapped] of Object.entries(allowedMap)) {
    if (value.startsWith(key)) return mapped;
  }

  // Check if any mapped value matches (case-insensitive)
  for (const [, mapped] of Object.entries(allowedMap)) {
    if (mapped.toLowerCase() === value) return mapped;
  }

  return undefined;
}

function parseScaledNumber(raw: unknown) {
  const value = cleanString(raw)
    .toLowerCase()
    .replace(/[$,%]/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");

  if (!value) return undefined;

  let multiplier = 1;
  let numeric = value;

  if (/(million|mm|m)$/.test(value)) {
    multiplier = 1_000_000;
    numeric = value.replace(/(million|mm|m)$/, "");
  } else if (/(billion|bn|b)$/.test(value)) {
    multiplier = 1_000_000_000;
    numeric = value.replace(/(billion|bn|b)$/, "");
  } else if (/(thousand|k)$/.test(value)) {
    multiplier = 1_000;
    numeric = value.replace(/(thousand|k)$/, "");
  }

  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed * multiplier;
}

function normalizeIntegerString(
  raw: unknown,
  opts: { min?: number; max?: number } = {}
) {
  const parsed = parseScaledNumber(raw);
  if (!Number.isFinite(parsed)) return undefined;
  const numeric = parsed as number;
  const rounded = Math.round(numeric);
  if (opts.min != null && rounded < opts.min) return undefined;
  if (opts.max != null && rounded > opts.max) return undefined;
  return String(rounded);
}

function normalizeDecimalString(
  raw: unknown,
  opts: { min?: number; max?: number; maxDecimals?: number } = {}
) {
  const trimmed = cleanString(raw);
  const parsed = parseScaledNumber(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const numeric = parsed as number;
  if (opts.min != null && numeric < opts.min) return undefined;
  if (opts.max != null && numeric > opts.max) return undefined;

  const cleanedNumeric = trimmed
    .replace(/[$,%]/g, "")
    .replace(/,/g, "")
    .trim()
    .toLowerCase()
    .replace(/(million|mm|m|billion|bn|b|thousand|k)$/g, "");
  const requestedDecimals = cleanedNumeric.includes(".")
    ? cleanedNumeric.split(".")[1]?.length ?? 0
    : 0;
  const decimals = Math.min(requestedDecimals, opts.maxDecimals ?? 2);
  return decimals > 0 ? numeric.toFixed(decimals) : String(numeric);
}

function normalizeState(raw: unknown) {
  const value = cleanString(raw);
  if (!value) return undefined;

  const upper = value.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  if (value.toLowerCase() === "california") return "CA";
  return undefined;
}

function normalizeZip(raw: unknown) {
  const digits = cleanString(raw).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  return undefined;
}

function normalizeDate(raw: unknown) {
  const value = cleanString(raw);
  if (!value) return undefined;

  const mmddyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}/${yyyy}`;
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}/${yyyy}`;
  }

  return undefined;
}

function normalizeName(raw: unknown) {
  const value = normalizeWhitespace(cleanString(raw));
  if (!value) return undefined;
  const withoutContact = value
    .replace(/\b\S+@\S+\b/g, "")
    .replace(/\+?[\d().\-\s]{7,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!withoutContact) return undefined;
  return withoutContact;
}

function sanitizeFieldValue(field: string, raw: unknown) {
  const value = cleanString(raw);
  if (!value) return undefined;

  switch (field) {
    case "propertyType":
      return normalizeEnum(value, propertyTypeMap);
    case "transactionType":
      return normalizeEnum(value, transactionTypeMap);
    case "representationType":
      return normalizeEnum(value, representationTypeMap);
    case "leaseType":
      return normalizeEnum(value, leaseTypeMap);
    case "state":
      return normalizeState(value);
    case "zip":
      return normalizeZip(value);
    case "term":
    case "buildingSf":
    case "suiteSf":
    case "dealSf":
    case "quantity":
      return normalizeIntegerString(value, { min: 1, max: 10_000_000 });
    case "askingPrice":
    case "salePrice":
    case "totalConsideration":
      return normalizeIntegerString(value, { min: 1, max: 100_000_000_000 });
    case "rateSfMo":
    case "rateSfYr":
    case "leaseRate":
    case "pricePerSf":
    case "commissionRate":
    case "baseRent":
    case "annualEscalationPct":
      return normalizeDecimalString(value, { min: 0, max: 100_000, maxDecimals: 2 });
    case "freeRentMonths":
      return normalizeIntegerString(value, { min: 0, max: 120 });
    case "commencementDate":
    case "expirationDate":
    case "occupancyDate":
      return normalizeDate(value);
    case "listingAgentName":
    case "brokerName":
    case "lessorName":
    case "lesseeName":
    case "requestedBy":
    case "tenantName":
    case "landlordName":
    case "procuringAgentName":
    case "clientName":
      return normalizeName(value);
    case "city":
      return toTitleCase(value);
    default:
      return normalizeWhitespace(value);
  }
}

function sanitizeAiFields(tab: FormTab, parsed: Record<string, unknown>) {
  const validFields = new Set(Object.keys(tabFieldSchemas[tab].shape));
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([field]) => validFields.has(field))
      .map(([field, value]) => [field, sanitizeFieldValue(field, value)])
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
  ) as Record<string, string>;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  // Flatten multipart content, strip Markdown fences, slice to outer braces.
  const text = extractJsonText(raw);
  if (!text) return {};

  const attempt = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  const direct = attempt(text);
  if (direct) return direct;

  const normalized = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
  const normalizedResult = attempt(normalized);
  if (normalizedResult) return normalizedResult;

  return {};
}

function parseAddressParts(raw: string) {
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );

  if (!match) return {};

  const [, address, city, state, zip] = match;
  return {
    address: normalizeWhitespace(address),
    city: toTitleCase(city),
    state: normalizeState(state),
    zip: normalizeZip(zip),
  };
}

function parseUsDate(raw: unknown) {
  const normalized = normalizeDate(raw);
  if (!normalized) return undefined;
  const [month, day, year] = normalized.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return undefined;
  return { date, normalized };
}

function wholeMonthDiff(start: Date, end: Date) {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return months;
}

function deriveStateFromCity(city: string) {
  return southernCaliforniaCities.has(city.toLowerCase()) ? "CA" : undefined;
}

function deriveSmartSuggestions(tab: FormTab, currentFields: Record<string, string>) {
  const suggestions: Record<string, string> = {};
  const emptyFields = new Set(
    Object.keys(tabFieldSchemas[tab].shape).filter(
      key => !cleanString(currentFields[key])
    )
  );

  const addressValue = cleanString(currentFields.address);
  if (addressValue && addressValue.includes(",")) {
    const parts = parseAddressParts(addressValue);
    if (emptyFields.has("address") && parts.address) suggestions.address = parts.address;
    if (emptyFields.has("city") && parts.city) suggestions.city = parts.city;
    if (emptyFields.has("state") && parts.state) suggestions.state = parts.state;
    if (emptyFields.has("zip") && parts.zip) suggestions.zip = parts.zip;
  }

  const cityValue = cleanString(currentFields.city);
  if (emptyFields.has("state") && cityValue) {
    const derivedState = deriveStateFromCity(cityValue);
    if (derivedState) suggestions.state = derivedState;
  }

  if (tab === "voucher" || tab === "comp") {
    const start = parseUsDate(currentFields.commencementDate);
    const end = parseUsDate(currentFields.expirationDate);
    if (emptyFields.has("term") && start && end && end.date > start.date) {
      const months = wholeMonthDiff(start.date, end.date);
      if (months > 0) suggestions.term = String(months);
    }
  }

  if (tab === "voucher") {
    if (emptyFields.has("dealSf")) {
      const buildingSf = parseScaledNumber(currentFields.buildingSf);
      if (Number.isFinite(buildingSf) && (buildingSf as number) > 0) {
        suggestions.dealSf = String(Math.round(buildingSf as number));
      }
    }
    if (emptyFields.has("rateSfMo")) {
      const dealSf = parseScaledNumber(currentFields.dealSf) ?? parseScaledNumber(currentFields.buildingSf);
      const baseRent = parseScaledNumber(currentFields.baseRent);
      if (
        Number.isFinite(dealSf) &&
        Number.isFinite(baseRent) &&
        (dealSf as number) > 0 &&
        (baseRent as number) > 50
      ) {
        suggestions.rateSfMo = Number((baseRent as number) / (dealSf as number)).toFixed(4);
      }
    }
  }

  if (tab === "comp" && emptyFields.has("pricePerSf")) {
    const salePrice = parseScaledNumber(currentFields.salePrice);
    const buildingSf = parseScaledNumber(currentFields.buildingSf);
    if (
      Number.isFinite(salePrice) &&
      Number.isFinite(buildingSf) &&
      (buildingSf as number) > 0
    ) {
      suggestions.pricePerSf = Number((salePrice as number) / (buildingSf as number)).toFixed(2);
    }
  }

  return sanitizeAiFields(tab, suggestions);
}

function parseNumber(raw: unknown) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const value = cleanString(raw);
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(raw: unknown) {
  return raw === true || raw === "true" || raw === 1;
}

function makeVoucherSuggestion(
  field: string,
  issue: string,
  reason: string,
  inputId: string | null,
  suggestion = ""
): VoucherSuggestion {
  return { field, issue, suggestion, reason, inputId };
}

function runVoucherAudit(dealData: Record<string, unknown>) {
  const suggestions: VoucherSuggestion[] = [];
  const isLease = parseBoolean(dealData.isLease);
  const isSale = parseBoolean(dealData.isSale);

  const start = parseUsDate(dealData.startDate);
  const end = parseUsDate(dealData.endDate);
  const term = parseNumber(dealData.term);
  const rentRowMonthTotal = parseNumber(dealData.rentRowMonthTotal);
  const address = cleanString(dealData.address);
  const city = cleanString(dealData.city);
  const zip = cleanString(dealData.zip);
  const sqft = parseNumber(dealData.sqft);
  const totalConsideration = parseNumber(dealData.totalConsideration);
  const saleCommPct = parseNumber(dealData.saleCommPct);

  if (start && end && end.date <= start.date) {
    suggestions.push(
      makeVoucherSuggestion(
        "Lease End",
        "Lease end date is before the start date.",
        "The lease end must be later than the commencement date.",
        "dx_endDate"
      )
    );
  }

  if (start && end && term != null && end.date > start.date) {
    const computedMonths = wholeMonthDiff(start.date, end.date);
    if (computedMonths > 0 && Math.abs(computedMonths - term) > 1) {
      suggestions.push(
        makeVoucherSuggestion(
          "Term",
          "Term does not match the lease date range.",
          `The date range implies about ${computedMonths} months, but the form says ${term}.`,
          "dx_term",
          String(computedMonths)
        )
      );
    }
  }

  if (isLease && term != null && rentRowMonthTotal != null && Math.abs(rentRowMonthTotal - term) > 1) {
    suggestions.push(
      makeVoucherSuggestion(
        "Rent Schedule",
        "Rent rows do not add up to the stated term.",
        `The schedule totals ${rentRowMonthTotal} months while the term field says ${term}.`,
        "dx_term",
        String(rentRowMonthTotal)
      )
    );
  }

  if (saleCommPct != null && (saleCommPct < 0.5 || saleCommPct > 10)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Commission",
        "Commission percentage is outside the normal review range.",
        "Lee vouchers should be reviewed when commission is below 0.5% or above 10%.",
        "dx_saleCommPct",
        saleCommPct.toFixed(saleCommPct % 1 === 0 ? 0 : 2)
      )
    );
  }

  if (address && !city) {
    suggestions.push(
      makeVoucherSuggestion(
        "City",
        "Address is filled but city is missing.",
        "A complete deal location should include both street address and city.",
        "dx_city"
      )
    );
  }

  if (!address && (city || zip)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Address",
        "City or ZIP is filled without a street address.",
        "The property record needs a street address to identify the deal clearly.",
        "dx_address"
      )
    );
  }

  if (sqft != null && (sqft <= 0 || sqft > 10_000_000)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Deal SF",
        "Square footage looks invalid.",
        "Deal SF should be a positive number and well under ten million square feet for one deal.",
        "dx_sqft"
      )
    );
  }

  if (isLease) {
    if (!start) {
      suggestions.push(
        makeVoucherSuggestion(
          "Lease Start",
          "Lease start date is missing.",
          "Lease deals should include a commencement date.",
          "dx_startDate"
        )
      );
    }
    if (!end) {
      suggestions.push(
        makeVoucherSuggestion(
          "Lease End",
          "Lease end date is missing.",
          "Lease deals should include an end date.",
          "dx_endDate"
        )
      );
    }
    if (term == null) {
      suggestions.push(
        makeVoucherSuggestion(
          "Term",
          "Lease term is missing.",
          "Lease deals should include the term in months.",
          "dx_term"
        )
      );
    }
  }

  if (isSale) {
    if (totalConsideration == null || totalConsideration <= 0) {
      suggestions.push(
        makeVoucherSuggestion(
          "Purchase Price",
          "Purchase price is missing or zero.",
          "Sale deals should include total consideration.",
          "dx_totalConsideration"
        )
      );
    }
    if (saleCommPct == null) {
      suggestions.push(
        makeVoucherSuggestion(
          "Commission",
          "Commission percentage is missing.",
          "Sale deals should include the commission percentage.",
          "dx_saleCommPct"
        )
      );
    }
  }

  return suggestions;
}

// ── System prompts (company name from settings) ──

async function parseSystemPrompt(): Promise<string> {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured field values from a broker's natural language deal description.

CRITICAL RULES — follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text.
- Include ONLY fields you can extract with high confidence. Omit uncertain fields entirely.
- Monetary values: numbers as strings, no $ or commas. "1.25" not "$1.25/SF".
- Dates: MM/DD/YYYY format only.
- Property type: exactly one of Industrial, Office, Retail, Medical, Land, Multi-Family, Other.
- Transaction type: exactly Lease or Sale.
- Representation type: Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, or Dual.
- Term: integer months as string. "60" = 5 years, "36" = 3 years. "5 years" → "60".
- Building SF / suite SF: numeric string without commas. "12500" not "12,500".
- Asking price (sale): numeric string without commas. "2500000" not "$2.5M".
- Lease rate: monthly per-SF as string. "$1.25/SF/Mo" → "1.25".
- Broker/agent names: full name only, no phone or email.
- Address: street address only (no city/state). City and state go in their own fields.
- State: two-letter abbreviation. "California" → "CA".
- If a value is implied but not explicitly stated, omit it. Never guess, estimate, or fill market-default values.`;
}

async function brochureSystemPrompt(): Promise<string> {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
You extract structured listing data from property marketing brochures, flyers, and offering memoranda.

Your task: Read the entire brochure carefully, identify every relevant data point, and return a JSON object with the extracted values.

FIELD EXTRACTION GUIDE:
- address: Street address ONLY (e.g. "1234 Main St" or "1234 Main St Ste 200"). Never include city, state, or zip.
- city: City name only, title case (e.g. "Irvine").
- state: Two-letter abbreviation (e.g. "CA").
- zip: 5-digit zip code.
- propertyType: Exactly one of: Industrial, Office, Retail, Medical, Land, Multi-Family, Other. Determine from building use, zoning, or description.
- transactionType: "Lease" or "Sale" — if brochure shows rental rates, it's Lease. If it shows a sale price, it's Sale. If both, use the primary offering.
- leaseType: "NNN" (triple net), "FSG" (full service gross), "MG" (modified gross), "Gross", or "Net". Look for these abbreviations near the rate.
- buildingSf: Total building square footage as integer string. "12,500 SF" → "12500".
- suiteSf: Available suite/space square footage as integer string.
- rateSfMo: Monthly rate per SF as decimal string. "$1.25/SF/Mo" → "1.25". IMPORTANT: If the rate is ANNUAL (e.g. "$15.00/SF/Yr NNN"), divide by 12 and return the monthly figure ("1.25").
- askingPrice: Sale price as integer string. "$2,500,000" → "2500000".
- term: Lease term in MONTHS as integer string. "5 years" → "60".
- listingExpiration: Listing expiration date in MM/DD/YYYY format.
- dateEntered: Date listing was entered/created in MM/DD/YYYY format.
- ownerName: Property owner's full name or entity name.
- commissionRate: Commission percentage as decimal. "6%" → "6".
- crossStreets: Nearby cross streets or intersection.
- yearBuilt: Year the building was constructed as string (e.g. "1985").
- listingAgentName: Full name of the listing agent/broker. No phone or email.
- listingAgentLicense: DRE license number.
- comments: Key property highlights, features, and amenities as a concise bullet list.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Extract ONLY values you can identify with HIGH CONFIDENCE from the document.
- Read ALL pages — brochures often have key data on back pages, in fine print, or in contact sections.
- Look carefully at headers, footers, and sidebar panels for rates, SF, and property details.
- If a rate is shown as annual (per year), convert to monthly by dividing by 12.
- If the brochure is promotional without precise values, OMIT those fields.
- Never guess or infer values not explicitly stated.`;
}

async function documentSystemPrompt(): Promise<string> {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
You extract structured form data from broker-provided documents such as brochures, offering memoranda, commission agreements, sign requests, lease abstracts, and comp sheets.

Your task: Read the entire document carefully, identify every relevant data point, and return a JSON object with the extracted values.

FIELD EXTRACTION GUIDE:
- address: Street address ONLY (e.g. "1234 Main St" or "1234 Main St Ste 200"). Never include city, state, or zip in this field.
- city: City name only (e.g. "Irvine" or "Costa Mesa"). Title case.
- state: Two-letter state abbreviation (e.g. "CA").
- zip: 5-digit zip code (e.g. "92618").
- propertyType: Classify as exactly one of: Industrial, Office, Retail, Medical, Land, Multi-Family, Other.
- transactionType: "Lease" or "Sale" — determine from context (rental terms = Lease, purchase price = Sale).
- representationType: "Tenant Rep", "Landlord Rep", "Buyer Rep", "Seller Rep", or "Dual".
- leaseType: "NNN" (triple net), "FSG" (full service gross), "MG" (modified gross), "Gross", or "Net".
- buildingSf / suiteSf / dealSf: Total square footage as integer string without commas. "12,500 SF" → "12500".
- rateSfMo: Monthly rate PER SQUARE FOOT as decimal string. "$1.25/SF/Mo" → "1.25". Use this when the document states a monthly per-SF rate.
- rateSfYr: Annual rate PER SQUARE FOOT as decimal string. "$18.00/SF/Yr" → "18.00". Use this when the document states an annual per-SF rate (do NOT divide by 12).
- baseRent / leaseRate: Monthly rate PER SQUARE FOOT when clearly per-SF; if only total monthly rent is stated (e.g. "$15,000/month"), divide by dealSf/buildingSf and return the per-SF monthly rate ("1.50" for $15,000 on 10,000 SF).
- freeRentMonths: Number of free/abated rent months as integer string. "2 months free rent" → "2".
- annualEscalationPct: Annual rent increase percentage as decimal string. "3% annual increase" → "3".
- term: Lease duration in MONTHS as integer string. "5 years" → "60". "36 months" → "36".
- commencementDate / expirationDate / occupancyDate / listingExpiration / dateEntered: Dates in MM/DD/YYYY format.
- askingPrice / salePrice / totalConsideration: Dollar amount as integer string without $ or commas. "$2,500,000" → "2500000".
- pricePerSf: Price per square foot as decimal string. "$250.00/SF" → "250.00".
- commissionRate: Commission percentage as decimal string. "6%" → "6". "3.5%" → "3.5".
- ownerName / clientName / lessorName / lesseeName / tenantName / landlordName: Full name of the person or entity.
- listingAgentName / procuringAgentName / brokerName: Full name only, no phone/email/license.
- listingAgentLicense: DRE license number if visible.
- comments / notes: Brief summary of key deal terms, highlights, or special conditions.
- signType: Type of sign (e.g. "For Lease", "For Sale", "Sold").
- signSize: Dimensions (e.g. "4x8").
- nameRider: Name rider text.
- specialInstructions / accessInstructions: Verbatim instructions from the document.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text.
- Include ONLY fields from the user's available fields list.
- Extract ONLY values you can identify with HIGH CONFIDENCE. Omit uncertain fields entirely.
- Read the ENTIRE document — important data may be on any page, in headers, footers, signature blocks, or fine print.
- For multi-page documents, cross-reference data across pages to ensure accuracy.
- If a value appears in multiple places, prefer the most specific/detailed version.
- If the document is ambiguous or promotional without a precise field value, OMIT that field.
- Never guess or infer values that are not explicitly stated in the document.`;
}

// ── Shared JSON schema builder ──

function buildJsonSchema(name: string, fieldNames: string[]) {
  // NOTE: We intentionally do NOT set strict: true here. OpenAI's strict mode
  // requires every property to appear in `required`, but we want the model to
  // omit fields it cannot confidently extract from a brochure or PDF. With an
  // empty `required` array, strict mode would reject the request.
  return {
    name,
    schema: {
      type: "object",
      properties: Object.fromEntries(fieldNames.map((k) => [k, { type: "string" }])),
      required: [] as string[],
      additionalProperties: false,
    },
  };
}

async function fetchDocumentBuffer(fileUrl: string) {
  const target = fileUrl.trim();
  const isDataUrl = /^data:[^;]+;base64,/i.test(target);
  const isStoredPath = isStoredFileReference(target);

  try {
    if (isStoredPath) {
      const { bytes } = await storageGetBytes(target);
      return { fileBuffer: bytes, error: null };
    }
    if (isDataUrl) {
      const base64 = target.slice(target.indexOf(",") + 1);
      return { fileBuffer: Buffer.from(base64, "base64"), error: null };
    }
    return { fileBuffer: null, error: "Only stored file references and data URLs are supported." };
  } catch (e: any) {
    return { fileBuffer: null, error: `Could not fetch file: ${e.message}` };
  }
}

async function buildDocumentUserContent(
  fileBuffer: Buffer,
  mimeType: AiDocumentMime,
  promptText: string,
  extractedPdfText?: string
) {
  if (mimeType !== "application/pdf") {
    return [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
          detail: "high",
        },
      },
      {
        type: "text",
        text: promptText,
      },
    ];
  }

  return [
    {
      type: "text",
      text: await (async () => {
        try {
          const cleaned = extractedPdfText ?? await extractPdfTextFromBuffer(fileBuffer);
          const trimmed = cleaned.slice(0, 40_000);
          return `${promptText}\n\nDocument text (extracted):\n${trimmed}`;
        } catch (e: any) {
          const message = e?.message ? String(e.message) : "Unknown PDF parse error";
          return `${promptText}\n\nNote: PDF text extraction failed (${message}). Return an empty fields object and set all documentDetection found values to false.`;
        }
      })(),
    },
  ];
}

async function extractPdfTextFromBuffer(fileBuffer: Buffer) {
  const mod = await import("pdf-parse");
  const callableParse = (mod as any).default ?? (typeof (mod as any) === "function" ? (mod as any) : null);
  if (callableParse) {
    const parsed = await callableParse(fileBuffer);
    return normalizeWhitespace(parsed?.text || "");
  }

  const Parser = (mod as any).PDFParse;
  if (typeof Parser !== "function") {
    throw new Error("pdf-parse did not expose a supported parser");
  }

  const parser = new Parser({ data: fileBuffer });
  try {
    const parsed = await parser.getText();
    return normalizeWhitespace(parsed?.text || "");
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocumentFields(
  tab: FormTab,
  fileUrl: string,
  mimeType: AiDocumentMime,
  options: { listingBrochurePrompt?: boolean } = {}
) {
  const fieldNames = Object.keys(tabFieldSchemas[tab].shape);
  const fetched = await fetchDocumentBuffer(fileUrl);

  if (!fetched.fileBuffer) {
    return {
      success: false as const,
      fields: {},
      tab,
      fieldCount: 0,
      error: fetched.error ?? "Could not fetch file",
    };
  }

  const docDesc = mimeType === "application/pdf" ? "PDF document" : "document image";
  const promptText = options.listingBrochurePrompt
    ? `Carefully read this entire ${docDesc} (all pages) and extract listing data into the fields below.

Fields to extract: ${fieldNames.join(", ")}

Instructions:
- Read every page, header, footer, sidebar, and fine print.
- For rates: if shown as annual ($/SF/Yr), divide by 12 to get monthly.
- For SF: remove commas, return as integer string.
- For dates: return as MM/DD/YYYY.
- For addresses: street only, put city/state/zip in their own fields.
- Only include fields you find explicitly stated. Omit anything uncertain.

Return the JSON object now:`
    : `Carefully read this entire ${docDesc} (all pages) and extract data for the "${tab}" form into the fields below.

Fields to extract: ${fieldNames.join(", ")}

Instructions:
- Read every page, header, footer, sidebar, signature block, and fine print.
- For rates: if shown as annual ($/SF/Yr), divide by 12 to get monthly.
- For SF: remove commas, return as integer string.
- For monetary amounts: remove $ and commas, return as integer string.
- For dates: return as MM/DD/YYYY.
- For term: convert to months ("5 years" = "60").
- For addresses: street only, put city/state/zip in their own fields.
- Only include fields you find explicitly stated. Omit anything uncertain.

Return the JSON object now:`;

  const systemContent = options.listingBrochurePrompt
    ? await brochureSystemPrompt()
    : await documentSystemPrompt();

  // ── Preferred path: Claude (Anthropic) as primary extractor ──
  // Claude provides superior accuracy for document field extraction, especially
  // for pricing, SF, and agent details. Gemini serves as fallback.
  let primaryFields: Record<string, string> = {};
  let primarySucceeded = false;
  let primaryProvider = "";

  if (isClaudeFallbackAvailable()) {
    try {
      console.info(`[aiAssist] Trying Claude as primary extractor...`);
      const claudeRaw = await invokeClaudeWithFile({
        fileBuffer: fetched.fileBuffer,
        mimeType,
        systemPrompt: systemContent,
        userPrompt: promptText,
      });
      console.info(`[aiAssist] Claude raw response length: ${typeof claudeRaw === 'string' ? claudeRaw.length : 0}`);
      console.info(`[aiAssist] Claude raw response (first 2000 chars): ${typeof claudeRaw === 'string' ? claudeRaw.slice(0, 2000) : JSON.stringify(claudeRaw)}`);
      const claudeParsed = parseJsonObject(claudeRaw);
      console.info(`[aiAssist] Claude parsed keys: ${Object.keys(claudeParsed).join(', ')}`);
      primaryFields = sanitizeAiFields(tab, claudeParsed);
      console.info(`[aiAssist] Claude sanitized fields (${Object.keys(primaryFields).length}): ${JSON.stringify(primaryFields).slice(0, 2000)}`);
      primarySucceeded = true;
      primaryProvider = "Claude";
    } catch (claudeErr: unknown) {
      console.warn(
        "[aiAssist] Claude primary extraction failed:",
        claudeErr instanceof Error ? claudeErr.message : String(claudeErr)
      );
    }
  }

  // If Claude returned a good result (3+ fields), use it
  if (primarySucceeded && Object.keys(primaryFields).length >= 3) {
    console.info(`[aiAssist] ${primaryProvider} returned ${Object.keys(primaryFields).length} fields — using as final result.`);
    return {
      success: true as const,
      fields: primaryFields,
      tab,
      fieldCount: Object.keys(primaryFields).length,
    };
  }

  // ── Gemini fallback: try Gemini when Claude returned few/no fields ──
  let geminiFields: Record<string, string> = {};
  let geminiSucceeded = false;

  if (isGeminiDirectAvailable()) {
    try {
      console.info(
        `[aiAssist] Claude returned ${Object.keys(primaryFields).length} fields, trying Gemini fallback...`
      );
      const raw = await invokeLLMWithFile({
        fileBuffer: fetched.fileBuffer,
        mimeType,
        systemPrompt: systemContent,
        userPrompt: promptText,
        outputSchema: buildJsonSchema(`${tab}_document_fields`, fieldNames),
      });
      const parsed = parseJsonObject(raw);
      geminiFields = sanitizeAiFields(tab, parsed);
      geminiSucceeded = true;
      console.info(`[aiAssist] Gemini fallback returned ${Object.keys(geminiFields).length} fields.`);
      if (Object.keys(geminiFields).length > Object.keys(primaryFields).length) {
        return {
          success: true as const,
          fields: geminiFields,
          tab,
          fieldCount: Object.keys(geminiFields).length,
        };
      }
    } catch (aiErr: unknown) {
      console.warn(
        "[aiAssist] Gemini fallback also failed:",
        aiErr instanceof Error ? aiErr.message : String(aiErr)
      );
    }
  }

  // Return whichever provider got more fields
  const bestFields = Object.keys(primaryFields).length >= Object.keys(geminiFields).length
    ? primaryFields
    : geminiFields;
  if (Object.keys(bestFields).length > 0) {
    return {
      success: true as const,
      fields: bestFields,
      tab,
      fieldCount: Object.keys(bestFields).length,
    };
  }

  // ── Last resort: extract text from PDF, then call via the regular LLM ──
  const userContent = await buildDocumentUserContent(
    fetched.fileBuffer,
    mimeType,
    promptText
  );

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent as any[] },
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildJsonSchema(`${tab}_document_fields`, fieldNames),
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(raw);
  const fields = sanitizeAiFields(tab, parsed);

  return {
    success: true as const,
    fields,
    tab,
    fieldCount: Object.keys(fields).length,
  };
}

const voucherDocumentStatusSchema = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    executed: { type: "boolean" },
    missingSignatures: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["found", "executed", "missingSignatures"],
  additionalProperties: false,
} as const;

const voucherDocumentDetectionSchema = {
  name: "voucher_document_detection",
  schema: {
    type: "object",
    properties: {
      agencyDisclosure: voucherDocumentStatusSchema,
      listingAgreement: voucherDocumentStatusSchema,
    },
    required: ["agencyDisclosure", "listingAgreement"],
    additionalProperties: false,
  },
} as const;

const listingDocumentDetectionSchema = {
  name: "listing_document_detection",
  schema: {
    type: "object",
    properties: {
      agencyDisclosure: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          executed: { type: "boolean" },
          missingSignatures: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["found", "executed", "missingSignatures"],
        additionalProperties: false,
      },
      listingAgreement: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          executed: { type: "boolean" },
          missingSignatures: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["found", "executed", "missingSignatures"],
        additionalProperties: false,
      },
    },
    required: ["agencyDisclosure", "listingAgreement"],
    additionalProperties: false,
  },
} as const;

function buildFieldsWithDetectionSchema(
  name: string,
  fieldNames: string[],
  documentDetectionSchema: typeof voucherDocumentDetectionSchema | typeof listingDocumentDetectionSchema
) {
  return {
    name,
    schema: {
      type: "object",
      properties: {
        fields: buildJsonSchema(`${name}_fields`, fieldNames).schema,
        documentDetection: documentDetectionSchema.schema,
      },
      required: ["fields", "documentDetection"],
      additionalProperties: false,
    },
  } as const;
}

type ListingDocumentDetectionState = {
  found: boolean;
  executed: boolean;
  missingSignatures: string[];
};

type ListingDocumentDetectionResult = {
  agencyDisclosure: ListingDocumentDetectionState;
  listingAgreement: ListingDocumentDetectionState;
};

function emptyListingDocumentDetection(): ListingDocumentDetectionResult {
  return {
    agencyDisclosure: { found: false, executed: false, missingSignatures: [] },
    listingAgreement: { found: false, executed: false, missingSignatures: [] },
  };
}

function normalizeDetectionFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1" || text === "found" || text === "present" || text === "executed";
}

function normalizeVoucherDocumentStatus(value: unknown) {
  if (typeof value === "boolean") {
    return {
      found: value,
      executed: false,
      missingSignatures: [] as string[],
    };
  }

  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const found = normalizeDetectionFlag(record.found);
  const executed = normalizeDetectionFlag(record.executed);
  const missingSignatures = Array.isArray(record.missingSignatures)
    ? record.missingSignatures
        .filter((entry) => typeof entry === "string")
        .map((entry) => String(entry).trim())
        .filter(Boolean)
    : [];

  return {
    found,
    executed: found && executed,
    missingSignatures: executed ? [] : missingSignatures,
  };
}

function parseVoucherDocumentDetection(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    agencyDisclosure: normalizeVoucherDocumentStatus(record.agencyDisclosure),
    listingAgreement: normalizeVoucherDocumentStatus(record.listingAgreement),
  };
}

function parseListingDocumentDetectionState(value: unknown): ListingDocumentDetectionState {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const found = normalizeDetectionFlag(record.found);
  const executed = found ? normalizeDetectionFlag(record.executed) : false;
  const missingSignatures = Array.isArray(record.missingSignatures)
    ? record.missingSignatures
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => entry.length > 0)
    : [];
  return {
    found,
    executed,
    missingSignatures: found && !executed ? missingSignatures : [],
  };
}

function parseListingDocumentDetection(value: unknown): ListingDocumentDetectionResult {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    agencyDisclosure: parseListingDocumentDetectionState(record.agencyDisclosure),
    listingAgreement: parseListingDocumentDetectionState(record.listingAgreement),
  };
}

function hasDocuSignExecutionEvidence(text: string) {
  if (!/docusign envelope id/i.test(text) && !/certificate of completion/i.test(text)) return false;
  if (/certificate of completion/i.test(text) && /completed/i.test(text)) return true;
  const timestampMatches = text.match(/[A-Z][a-z]+ \d{1,2}, \d{4}\s*\|\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*(?:[A-Z]{2,4})?/g) || [];
  return timestampMatches.length >= 2;
}

function inferListingDocumentDetectionFromText(text: string): ListingDocumentDetectionResult {
  const normalized = normalizeWhitespace(text || "");
  const lower = normalized.toLowerCase();
  const executedByDocuSign = hasDocuSignExecutionEvidence(normalized);
  const hasAgencyDisclosure =
    /disclosure regarding real estate agency relationship/i.test(normalized) ||
    (/agency relationship/i.test(lower) && /civil code/i.test(lower) && /seller'?s agent|buyer'?s agent|lessor|lessee/i.test(normalized));
  const hasListingAgreement =
    /exclusive right to represent owner/i.test(normalized) ||
    /exclusive authorization and right to (?:lease|sell)/i.test(normalized) ||
    /exclusive listing agreement/i.test(normalized) ||
    (/listing agreement/i.test(lower) && /owner|seller|lessor/i.test(lower) && /agent|broker/i.test(lower));

  return {
    agencyDisclosure: {
      found: hasAgencyDisclosure,
      executed: hasAgencyDisclosure && executedByDocuSign,
      missingSignatures: hasAgencyDisclosure && !executedByDocuSign ? ["Signature/date confirmation unclear"] : [],
    },
    listingAgreement: {
      found: hasListingAgreement,
      executed: hasListingAgreement && executedByDocuSign,
      missingSignatures: hasListingAgreement && !executedByDocuSign ? ["Signature/date confirmation unclear"] : [],
    },
  };
}

function mergeListingDetectionState(
  modelState: ListingDocumentDetectionState,
  inferredState: ListingDocumentDetectionState
): ListingDocumentDetectionState {
  if (!inferredState.found) return modelState;
  if (!modelState.found) return inferredState;
  if (!modelState.executed && inferredState.executed) return inferredState;
  if (modelState.executed) return { ...modelState, missingSignatures: [] };
  return {
    found: true,
    executed: false,
    missingSignatures: [...new Set([...modelState.missingSignatures, ...inferredState.missingSignatures])],
  };
}

function mergeListingDocumentDetection(
  modelDetection: ListingDocumentDetectionResult,
  inferredDetection: ListingDocumentDetectionResult
): ListingDocumentDetectionResult {
  return {
    agencyDisclosure: mergeListingDetectionState(modelDetection.agencyDisclosure, inferredDetection.agencyDisclosure),
    listingAgreement: mergeListingDetectionState(modelDetection.listingAgreement, inferredDetection.listingAgreement),
  };
}

function emptyVoucherDocumentDetection() {
  return {
    agencyDisclosure: { found: false, executed: false, missingSignatures: [] as string[] },
    listingAgreement: { found: false, executed: false, missingSignatures: [] as string[] },
  };
}

async function extractDocumentFieldsAndDetection<TDetection>(params: {
  tab: "voucher" | "listing";
  fileUrl: string;
  mimeType: AiDocumentMime;
  detectionPrompt: string;
  systemPrompt: string;
  schemaName: string;
  detectionSchema: typeof voucherDocumentDetectionSchema | typeof listingDocumentDetectionSchema;
  parseDetection: (value: unknown) => TDetection;
  emptyDetection: () => TDetection;
}) {
  const fieldNames = Object.keys(tabFieldSchemas[params.tab].shape);
  const fetched = await fetchDocumentBuffer(params.fileUrl);

  if (!fetched.fileBuffer) {
    return {
      success: false as const,
      fields: {},
      tab: params.tab,
      fieldCount: 0,
      error: fetched.error ?? "Could not fetch file",
      documentDetection: params.emptyDetection(),
    };
  }

  const fieldPrompt = `You are analyzing a ${params.mimeType === "application/pdf" ? "PDF document" : "document image"} for a commercial real estate ${params.tab} form.

READ THE ENTIRE DOCUMENT CAREFULLY. Extract every field you can identify with confidence.

You MUST use these EXACT JSON key names (camelCase) for the "fields" object:
${fieldNames.map(f => `  - "${f}"`).join("\n")}

For each field, extract the value EXACTLY as described in the system prompt's FIELD EXTRACTION GUIDE.
Only include fields you can confidently identify. Omit any field you're unsure about.

Example output for a lease brochure:
{
  "fields": {
    "address": "1234 Main St",
    "city": "Costa Mesa",
    "state": "CA",
    "zip": "92626",
    "propertyType": "Industrial",
    "transactionType": "Lease",
    "buildingSf": "15000",
    "rateSfMo": "1.25",
    "listingAgentName": "John Smith"
  },
  "documentDetection": { ... }
}`;

  const promptText = `${fieldPrompt}

Also check required compliance document status:

${params.detectionPrompt}

Return ONE JSON object with exactly this structure:
{
  "fields": { ...extracted form field values... },
  "documentDetection": { ...compliance document status... }
}

The "fields" object should contain the extracted values. The "documentDetection" object should follow the compliance rules above.
Return ONLY valid JSON. No markdown fences, no explanation.`;

  const outputSchema = buildFieldsWithDetectionSchema(
    params.schemaName,
    fieldNames,
    params.detectionSchema
  );

  let raw = "";
  let extractedPdfText = "";
  const ensureExtractedPdfText = async () => {
    if (params.mimeType !== "application/pdf" || extractedPdfText) return extractedPdfText;
    try {
      extractedPdfText = await extractPdfTextFromBuffer(fetched.fileBuffer);
    } catch (parseErr: unknown) {
      console.warn(
        "[aiAssist] PDF text extraction failed:",
        parseErr instanceof Error ? parseErr.message : String(parseErr)
      );
    }
    return extractedPdfText;
  };

  // ── Primary: Claude (most accurate for document extraction) ──
  if (isClaudeFallbackAvailable()) {
    try {
      console.info("[aiAssist] Using Claude as primary extractor for combined extraction...");
      raw = await invokeClaudeWithFile({
        fileBuffer: fetched.fileBuffer,
        mimeType: params.mimeType,
        systemPrompt: params.systemPrompt,
        userPrompt: promptText,
      });
    } catch (claudeErr: unknown) {
      console.error(
        "[aiAssist] Claude primary extraction failed:",
        claudeErr instanceof Error ? claudeErr.message : String(claudeErr)
      );
    }
  }

  // ── Fallback 1: Gemini with native PDF support ──
  if (!raw && isGeminiDirectAvailable()) {
    try {
      console.info("[aiAssist] Claude unavailable/failed, trying Gemini for combined extraction...");
      raw = await invokeLLMWithFile({
        fileBuffer: fetched.fileBuffer,
        mimeType: params.mimeType,
        systemPrompt: params.systemPrompt,
        userPrompt: promptText,
        outputSchema,
      });
    } catch (aiErr: unknown) {
      console.error(
        "[aiAssist] Gemini fallback also failed:",
        aiErr instanceof Error ? aiErr.message : String(aiErr),
        aiErr instanceof Error ? aiErr.stack : ""
      );
    }
  }

  // ── Fallback 2: text extraction + OpenAI-compatible endpoint ──
  if (!raw) {
    await ensureExtractedPdfText();
    const userContent = await buildDocumentUserContent(
      fetched.fileBuffer,
      params.mimeType,
      promptText,
      extractedPdfText
    );
    const response = await invokeLLM({
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: userContent as any[] },
      ],
      response_format: {
        type: "json_schema",
        json_schema: outputSchema,
      },
    });
    const content = response.choices?.[0]?.message?.content;
    raw = typeof content === "string" ? content : "";
  }

  const parsed = parseJsonObject(raw) as Record<string, unknown>;
  console.error(`[aiAssist DEBUG] raw response length: ${raw.length}, parsed keys: ${Object.keys(parsed).join(", ")}`);
  if (parsed.fields) console.error(`[aiAssist DEBUG] parsed.fields keys: ${Object.keys(parsed.fields as object).join(", ")}`);
  const fieldSource =
    parsed.fields && typeof parsed.fields === "object" && !Array.isArray(parsed.fields)
      ? (parsed.fields as Record<string, unknown>)
      : parsed;
  console.error(`[aiAssist DEBUG] fieldSource keys: ${Object.keys(fieldSource).join(", ")}`);
  let fields = sanitizeAiFields(params.tab, fieldSource);
  console.error(`[aiAssist DEBUG] sanitized fields (${Object.keys(fields).length}): ${JSON.stringify(fields)}`);

  // Smart fallback: check for critical fields, not just count.
  // A good extraction should have at least address OR city for any real estate document.
  const hasCriticalFields = Boolean(
    fields.address || fields.city || fields.propertyAddress
  );
  const fieldCount = Object.keys(fields).length;
  const needsFallback = !hasCriticalFields || fieldCount < 3;

  if (needsFallback && isGeminiDirectAvailable()) {
    try {
      console.info(`[aiAssist] Extraction quality check failed (fields: ${fieldCount}, hasCritical: ${hasCriticalFields}). Trying Gemini as secondary...`);
      const geminiRaw = await invokeLLMWithFile({
        fileBuffer: fetched.fileBuffer,
        mimeType: params.mimeType,
        systemPrompt: params.systemPrompt,
        userPrompt: promptText,
        outputSchema,
      });
      const geminiParsed = parseJsonObject(geminiRaw) as Record<string, unknown>;
      const geminiFieldSource =
        geminiParsed.fields && typeof geminiParsed.fields === "object" && !Array.isArray(geminiParsed.fields)
          ? (geminiParsed.fields as Record<string, unknown>)
          : geminiParsed;
      const geminiFields = sanitizeAiFields(params.tab, geminiFieldSource);
      const geminiHasCritical = Boolean(
        geminiFields.address || geminiFields.city || geminiFields.propertyAddress
      );
      // Use Gemini's result if it has critical fields or more total fields
      if (geminiHasCritical || Object.keys(geminiFields).length > fieldCount) {
        console.info(`[aiAssist] Gemini returned ${Object.keys(geminiFields).length} fields (hasCritical: ${geminiHasCritical}). Using Gemini result.`);
        fields = geminiFields;
      }
    } catch (geminiErr: unknown) {
      console.warn("[aiAssist] Gemini quality fallback failed:", geminiErr instanceof Error ? geminiErr.message : String(geminiErr));
    }
  } else if (fieldCount > 0) {
    console.info(`[aiAssist] Primary extraction succeeded: ${fieldCount} fields, critical fields present.`);
  }

  const modelDetection = params.parseDetection(parsed.documentDetection);
  if (params.tab === "listing") await ensureExtractedPdfText();
  const documentDetection =
    params.tab === "listing" && extractedPdfText
      ? mergeListingDocumentDetection(
          modelDetection as ListingDocumentDetectionResult,
          inferListingDocumentDetectionFromText(extractedPdfText)
        )
      : modelDetection;

  return {
    success: true as const,
    fields,
    tab: params.tab,
    fieldCount: Object.keys(fields).length,
    documentDetection,
  };
}

async function extractVoucherDocumentWithDetection(
  fileUrl: string,
  mimeType: AiDocumentMime
) {
  const sysPrompt = await documentSystemPrompt();
  return extractDocumentFieldsAndDetection({
    tab: "voucher",
    fileUrl,
    mimeType,
    schemaName: "voucher_document_fields_and_detection",
    detectionSchema: voucherDocumentDetectionSchema,
    parseDetection: parseVoucherDocumentDetection,
    emptyDetection: emptyVoucherDocumentDetection,
    systemPrompt: sysPrompt + "\n\nIn addition to extracting fields, you must also classify compliance document status as described in the user prompt.",
    detectionPrompt: `Determine whether this file includes either of these documents and whether each one appears fully executed:
- Agency Disclosure
- Listing Agreement

Rules:
- found=true only when the document is present in the file.
- executed=true only when all required signatures and signature dates appear present.
- If executed=false and found=true, list missing or unclear signatures in missingSignatures.
- If found=false, executed must be false and missingSignatures must be an empty array.`,
  });
}

async function extractListingDocumentWithDetection(
  fileUrl: string,
  mimeType: AiDocumentMime
) {
  const sysPrompt = await brochureSystemPrompt();
  return extractDocumentFieldsAndDetection({
    tab: "listing",
    fileUrl,
    mimeType,
    schemaName: "listing_document_fields_and_detection",
    detectionSchema: listingDocumentDetectionSchema,
    parseDetection: parseListingDocumentDetection,
    emptyDetection: emptyListingDocumentDetection,
    systemPrompt: sysPrompt + "\n\nIn addition to extracting fields, you must also classify compliance document status as described in the user prompt.",
    detectionPrompt: `Identify whether this file contains the following documents and whether each is fully executed:

AGENCY DISCLOSURE
- Also called: "Agency Disclosure", "C.A.R. Form AD", "Disclosure Regarding Real Estate Agency Relationships", "Agency Confirmation"
- Found if: document clearly discloses agency relationship (selling agent, listing agent, or dual agent) between broker and client
- Executed if: both the broker/agent AND the client/principal have signed, with dates present
- Missing signatures: note if agent signature, client signature, or date is absent

LISTING AGREEMENT
- Also called: "Exclusive Authorization and Right to Lease", "Exclusive Listing Agreement", "Exclusive Right to Sell", "Residential Listing Agreement", "Commercial Listing Agreement", "C.A.R. Form RLA", "C.A.R. Form CLA", "AIR CRE Listing Authorization"
- Found if: document grants a broker the exclusive right to list/lease/sell a specific property
- Executed if: both the listing broker/agent AND the property owner/principal have signed, with dates present
- Missing signatures: note if broker signature, owner signature, or date is absent

For each document:
- found: true only when that specific document is clearly present
- executed: true only when ALL required signatures and dates are present and legible
- missingSignatures: array of who is missing (e.g. ["Owner signature", "Date"]) — only when found=true and executed=false

A DocuSign Certificate of Completion means the document is executed. If DocuSign envelope shows "Completed" status, set executed=true for any documents in the envelope.`,
  });
}

// ── Router ──

export const aiAssistRouter = router({
  /**
   * Parse a natural language deal description into structured form fields.
   */
  parse: protectedProcedure
    .input(
      z.object({
        description: z.string().min(5).max(3000),
        tab: z.enum(["listing", "voucher", "sign", "comp"]),
        // Optional deal-type context hint from the client (e.g. "lease", "sale")
        dealTypeHint: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { description, tab, dealTypeHint } = input;
      const schema = tabFieldSchemas[tab];
      const fieldNames = Object.keys(schema.shape);

      // Build a tab-specific context prefix for the user message
      const tabContextMap: Record<string, string> = {
        listing: "You are extracting data for a commercial real estate LISTING form. Focus on property address, type, lease rate, term, building SF, suite SF, expiration date, and listing agent details.",
        voucher: "You are extracting data for a commercial real estate COMMISSION VOUCHER from lease agreements, commission agreements, or deal packages. Focus on parties (lessor/lessee or buyer/seller), deal/building SF, commencement/expiration/occupancy dates, lease term, rent rate ($/SF/mo or $/SF/yr), free rent months, annual escalation %, commission rate, and agent names.",
        sign: "You are extracting data for a SIGN REQUEST form. Focus on property address, sign type, size, quantity, name rider, and any special placement instructions.",
        comp: "You are extracting data for a COMPARABLE TRANSACTION (comp) entry. Focus on address, deal SF, lease rate or sale price, term, tenant/landlord names, and transaction date.",
      };
      const tabContext = tabContextMap[tab] ?? "";
      const dealHintLine = dealTypeHint ? `\nDeal type context: ${dealTypeHint}` : "";

      let response;
      try {
        response = await invokeLLM({
          messages: [
            { role: "system", content: await parseSystemPrompt() },
            {
              role: "user",
              content: `${tabContext}${dealHintLine}\n\nExtract fields for the "${tab}" form tab.\n\nAvailable fields: ${fieldNames.join(", ")}\n\nDeal description:\n"${description}"\n\nReturn JSON:`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: buildJsonSchema(`${tab}_fields`, fieldNames),
          },
        });
      } catch (error) {
        throw friendlyAiError(error);
      }

      const raw = response.choices?.[0]?.message?.content;
      const parsed = parseJsonObject(raw);
      const fields = sanitizeAiFields(tab, parsed);

      return { success: true, fields, tab };
    }),

  /**
   * Smart complete: suggest values for empty fields based on what is already filled.
   */
  smartComplete: protectedProcedure
    .input(
      z.object({
        currentFields: z.record(z.string(), z.string()),
        tab: z.enum(["listing", "voucher", "sign", "comp"]),
      })
    )
    .mutation(async ({ input }) => {
      const { currentFields, tab } = input;
      const schema = tabFieldSchemas[tab];

      const emptyFields = Object.keys(schema.shape).filter(
        (k) => !currentFields[k] || currentFields[k].trim() === ""
      );

      if (emptyFields.length === 0) {
        return { success: true, fields: {}, tab, message: "All fields already filled" };
      }

      const filledSummary = Object.entries(currentFields)
        .filter(([, v]) => v && v.trim() !== "")
        .map(([k, v]) => `${k}: "${v}"`)
        .join("\n");

      const derived = deriveSmartSuggestions(tab, currentFields);
      const fields = Object.fromEntries(
        Object.entries(derived).filter(([field]) => emptyFields.includes(field))
      );

      return {
        success: true,
        fields,
        tab,
        message:
          Object.keys(fields).length > 0
            ? "Added directly-supported suggestions only."
            : filledSummary
              ? "No directly-supported suggestions found from the current form data."
              : "Enter a little more deal detail first, then try again.",
      };
    }),

  /**
   * Scrape a property brochure (PDF or image) and extract listing fields.
   * Fetches the file server-side and sends the content as base64.
   */
  scrapeBrochure: protectedProcedure
    .input(
      z.object({
        // Accept either a public http(s) URL (e.g. an S3 object) or a data:
        // URL uploaded inline from the browser. Both are fetched server-side.
        fileUrl: z
          .string()
          .refine(
            v =>
              /^https?:\/\//i.test(v) ||
              /^data:[^;]+;base64,/i.test(v) ||
              v.startsWith("/local-uploads/") ||
              v.startsWith("/api/files/content") ||
              /^(broker-docs|broker-admin|broker-docusign)\//.test(v),
            {
              message:
                "fileUrl must be an http(s) URL, data URL, local upload path, file proxy URL, or stored file key",
            }
          ),
        mimeType: z
          .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
          .default("application/pdf"),
      })
    )
    .mutation(async ({ input }) => {
      return extractDocumentFields(
        "listing",
        input.fileUrl,
        input.mimeType,
        { listingBrochurePrompt: true }
      );
    }),

  /**
   * Extract fields from a broker document for any supported tool tab.
   * This keeps client-side AI document workflows behind the broker tool API.
   */
  extractDocument: protectedProcedure
    .input(
      z.object({
        fileUrl: z
          .string()
          .refine(
            v =>
              /^https?:\/\//i.test(v) ||
              /^data:[^;]+;base64,/i.test(v) ||
              v.startsWith("/local-uploads/") ||
              v.startsWith("/api/files/content") ||
              /^(broker-docs|broker-admin|broker-docusign)\//.test(v),
            {
              message:
                "fileUrl must be an http(s) URL, data URL, local upload path, file proxy URL, or stored file key",
            }
          ),
        mimeType: z
          .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
          .default("application/pdf"),
        tab: z.enum(["listing", "voucher", "sign", "comp"]),
      })
    )
    .mutation(async ({ input }) =>
      extractDocumentFields(input.tab, input.fileUrl, input.mimeType)
    ),

  extractVoucherDocument: protectedProcedure
    .input(
      z.object({
        fileUrl: z
          .string()
          .refine(
            v =>
              /^https?:\/\//i.test(v) ||
              /^data:[^;]+;base64,/i.test(v) ||
              v.startsWith("/local-uploads/") ||
              v.startsWith("/api/files/content") ||
              /^(broker-docs|broker-admin|broker-docusign)\//.test(v),
            {
              message:
                "fileUrl must be an http(s) URL, data URL, local upload path, file proxy URL, or stored file key",
            }
          ),
        mimeType: aiDocumentMimeSchema,
      })
    )
    .mutation(async ({ input }) =>
      extractVoucherDocumentWithDetection(input.fileUrl, input.mimeType)
    ),

  extractListingDocument: protectedProcedure
    .input(
      z.object({
        fileUrl: z
          .string()
          .refine(
            v =>
              /^https?:\/\//i.test(v) ||
              /^data:[^;]+;base64,/i.test(v) ||
              v.startsWith("/local-uploads/") ||
              v.startsWith("/api/files/content") ||
              /^(broker-docs|broker-admin|broker-docusign)\//.test(v),
            {
              message:
                "fileUrl must be an http(s) URL, data URL, local upload path, file proxy URL, or stored file key",
            }
          ),
        mimeType: aiDocumentMimeSchema,
      })
    )
    .mutation(async ({ input }) =>
      extractListingDocumentWithDetection(input.fileUrl, input.mimeType)
    ),

  /**
   * Review parsed voucher/deal data and return structured suggestions.
   * Used by the Dealius integration panel — no external API key required.
   */
  reviewVoucher: protectedProcedure
    .input(
      z.object({
        dealData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      const suggestions = runVoucherAudit(input.dealData);
      return { success: true, suggestions };
    }),

  /**
   * AI-powered deal financial analysis.
   * Takes structured deal data and returns computed values plus a plain-English
   * explanation of the deal's key financial metrics and any anomalies.
   *
   * Useful for: commission verification, deal summaries, quick sanity checks.
   */
  calculateDeal: protectedProcedure
    .input(
      z.object({
        /** Natural language description OR structured deal data (or both). */
        description: z.string().optional(),
        dealData: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { description, dealData } = input;

      if (!description && !dealData) {
        return {
          success: false as const,
          error: "Provide either a deal description or structured deal data.",
          analysis: null,
        };
      }

      const company = String(await getSetting("branding.company_name"));

      const systemPrompt = `You are a commercial real estate financial analyst for ${company}.
Given deal data, compute financial metrics and return a concise JSON analysis.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown, no explanation outside the JSON.
- Compute all metrics from the data provided; never guess missing inputs.
- All monetary values in the output must be plain numbers (no $ or commas).
- Round dollar amounts to 2 decimal places.`;

      const dataLines = dealData
        ? Object.entries(dealData)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
            .join("\n")
        : "";

      const userPrompt = [
        "Analyze this commercial real estate deal and return a JSON object with the following fields:",
        "",
        '  "summary": "One-sentence deal summary (e.g. 5-year lease, 10,000 SF industrial, Irvine CA)",',
        '  "transactionType": "Lease | Sale",',
        '  "totalConsideration": <number — total lease value or sale price>,',
        '  "commissionAmount": <number — gross commission dollar amount>,',
        '  "commissionRate": <number — commission % used>,',
        '  "avgMonthlyRent": <number — average monthly rent in dollars (lease only, or null)>,',
        '  "avgRatePerSf": <number — average $/SF/month (lease only, or null)>,',
        '  "pricePerSf": <number — sale price per SF (sale only, or null)>,',
        '  "termMonths": <number — lease term in months or null>,',
        '  "flags": ["array of any concerns or anomalies — empty array if none"],',
        '  "explanation": "2-4 sentence plain-English explanation of the financials"',
        "",
        description ? `Deal description:\n"${description}"` : "",
        dataLines ? `Structured deal data:\n${dataLines}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });

        const raw = response.choices?.[0]?.message?.content;
        const parsed = parseJsonObject(raw);

        return {
          success: true as const,
          analysis: parsed,
          error: null,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false as const, error: msg, analysis: null };
      }
    }),
});
