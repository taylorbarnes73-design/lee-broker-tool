import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { z } from "zod/v4";
import { getSetting } from "../settings/getSetting";

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
  listingAgentName: z.string().optional(),
  listingAgentLicense: z.string().optional(),
  comments: z.string().optional(),
});

const voucherFields = z.object({
  representationType: z.string().optional(),
  clientName: z.string().optional(),
  transactionType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  dealSf: z.string().optional(),
  commissionRate: z.string().optional(),
  term: z.string().optional(),
  commencementDate: z.string().optional(),
  expirationDate: z.string().optional(),
  baseRent: z.string().optional(),
  lessorName: z.string().optional(),
  lesseeName: z.string().optional(),
  listingAgentName: z.string().optional(),
  procuringAgentName: z.string().optional(),
  totalConsideration: z.string().optional(),
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
  land: "Land",
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
  return typeof value === "string" ? value.trim() : "";
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
  return allowedMap[value];
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
    case "leaseRate":
    case "pricePerSf":
    case "commissionRate":
    case "baseRent":
      return normalizeDecimalString(value, { min: 0, max: 100_000, maxDecimals: 2 });
    case "commencementDate":
    case "expirationDate":
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

function parseJsonObject(raw: unknown) {
  try {
    return JSON.parse(typeof raw === "string" ? raw : "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
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

  if (
    tab === "voucher" || tab === "comp"
  ) {
    const start = parseUsDate(currentFields.commencementDate);
    const end = parseUsDate(currentFields.expirationDate);
    if (emptyFields.has("term") && start && end && end.date > start.date) {
      const months = wholeMonthDiff(start.date, end.date);
      if (months > 0) suggestions.term = String(months);
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
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
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
Extract structured listing data from a property marketing brochure or flyer.

CRITICAL RULES — follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Extract ONLY fields you can identify with high confidence. Omit everything else.
- Monetary values: numeric strings without $ or commas. "$1.25/SF/Mo" → "1.25".
- Building/suite SF: numeric string without commas. "12,500 SF" → "12500".
- Asking price for sales: numeric string. "$2,500,000" → "2500000".
- Dates: MM/DD/YYYY format.
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
- Transaction type: Lease or Sale.
- Lease type: NNN, FSG, MG, Gross, or Net.
- Term: integer months as string if stated. "5 years" → "60".
- Address: street only (no city/state). Put city and state in separate fields.
- State: two-letter abbreviation.
- Extract agent/broker full name if visible.
- Extract all highlights/features into comments as a concise bullet list.
- If the brochure is ambiguous or promotional without a precise field value, omit that field.`;
}

async function documentSystemPrompt(): Promise<string> {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured form data from broker-provided documents such as brochures, offering memoranda, commission agreements, sign requests, and comp sheets.

CRITICAL RULES — follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Include ONLY fields listed in the user's available fields list.
- Extract ONLY values you can identify with high confidence. Omit uncertain fields entirely.
- Monetary values: numeric strings without $ or commas. "$1.25/SF/Mo" -> "1.25".
- Building/suite/deal SF: numeric string without commas. "12,500 SF" -> "12500".
- Dates: MM/DD/YYYY format.
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
- Transaction type: Lease or Sale.
- Representation type: Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, or Dual.
- Lease type: NNN, FSG, MG, Gross, or Net.
- Term: integer months as string if stated. "5 years" -> "60".
- Address: street only (no city/state). Put city and state in separate fields.
- State: two-letter abbreviation.
- Broker/agent names: full name only, no phone or email.
- If the document is ambiguous or promotional without a precise field value, omit that field.`;
}

// ── Shared JSON schema builder ──

function buildJsonSchema(name: string, fieldNames: string[]) {
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(fieldNames.map((k) => [k, { type: "string" }])),
      required: [] as string[],
      additionalProperties: false,
    },
  };
}

async function fetchDocumentBuffer(fileUrl: string) {
  try {
    const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
    if (!fileResp.ok) throw new Error(`File fetch failed: ${fileResp.status}`);
    const buffer = await fileResp.arrayBuffer();
    return { fileBuffer: Buffer.from(buffer), error: null as string | null };
  } catch (e: any) {
    return { fileBuffer: null, error: `Could not fetch file: ${e.message}` };
  }
}

async function buildDocumentUserContent(
  fileBuffer: Buffer,
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
  promptText: string
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
          const mod = await import("pdf-parse");
          const parse = (mod as any).default ?? (mod as any);
          const parsed = await parse(fileBuffer);
          const cleaned = normalizeWhitespace(parsed.text || "");
          const trimmed = cleaned.slice(0, 40_000);
          return `${promptText}\n\nDocument text (extracted):\n${trimmed}`;
        } catch (e: any) {
          const message = e?.message ? String(e.message) : "Unknown PDF parse error";
          return `${promptText}\n\nNote: PDF text extraction failed (${message}). Return an empty JSON object.`;
        }
      })(),
    },
  ];
}

async function extractDocumentFields(
  tab: FormTab,
  fileUrl: string,
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
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

  const promptText = options.listingBrochurePrompt
    ? `Extract all listing fields you can identify from this ${mimeType === "application/pdf" ? "PDF brochure" : "brochure image"}.\n\nAvailable fields: ${fieldNames.join(", ")}\n\nReturn JSON with only fields you can confidently extract:`
    : `Extract all fields you can identify for the "${tab}" form from this ${mimeType === "application/pdf" ? "PDF document" : "document image"}.\n\nAvailable fields: ${fieldNames.join(", ")}\n\nReturn JSON with only fields you can confidently extract:`;

  const userContent = await buildDocumentUserContent(
    fetched.fileBuffer,
    mimeType,
    promptText
  );

  const systemContent = options.listingBrochurePrompt
    ? await brochureSystemPrompt()
    : await documentSystemPrompt();

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

// ── Router ──

export const aiAssistRouter = router({
  /**
   * Parse a natural language deal description into structured form fields.
   */
  parse: publicProcedure
    .input(
      z.object({
        description: z.string().min(5).max(3000),
        tab: z.enum(["listing", "voucher", "sign", "comp"]),
      })
    )
    .mutation(async ({ input }) => {
      const { description, tab } = input;
      const schema = tabFieldSchemas[tab];
      const fieldNames = Object.keys(schema.shape);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: await parseSystemPrompt() },
          {
            role: "user",
            content: `Extract fields for the "${tab}" form tab.\n\nAvailable fields: ${fieldNames.join(", ")}\n\nDeal description:\n"${description}"\n\nReturn JSON:`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildJsonSchema(`${tab}_fields`, fieldNames),
        },
      });

      const raw = response.choices?.[0]?.message?.content;
      const parsed = parseJsonObject(raw);
      const fields = sanitizeAiFields(tab, parsed);

      return { success: true, fields, tab };
    }),

  /**
   * Smart complete: suggest values for empty fields based on what is already filled.
   */
  smartComplete: publicProcedure
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
  scrapeBrochure: publicProcedure
    .input(
      z.object({
        // Accept either a public http(s) URL (e.g. an S3 object) or a data:
        // URL uploaded inline from the browser. Both are fetched server-side.
        fileUrl: z
          .string()
          .refine(
            v => /^https?:\/\//i.test(v) || /^data:[^;]+;base64,/i.test(v),
            { message: "fileUrl must be an http(s) URL or a data: URL" }
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
  extractDocument: publicProcedure
    .input(
      z.object({
        fileUrl: z
          .string()
          .refine(
            v => /^https?:\/\//i.test(v) || /^data:[^;]+;base64,/i.test(v),
            { message: "fileUrl must be an http(s) URL or a data: URL" }
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

  /**
   * Review parsed voucher/deal data and return structured suggestions.
   * Used by the Dealius integration panel — no external API key required.
   */
  reviewVoucher: publicProcedure
    .input(
      z.object({
        dealData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      const suggestions = runVoucherAudit(input.dealData);
      return { success: true, suggestions };
    }),
});

