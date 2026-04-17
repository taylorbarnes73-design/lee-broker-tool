import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { z } from "zod/v4";

// ─── Field schemas per tab ────────────────────────────────────────────────────

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

// ─── System prompts ───────────────────────────────────────────────────────────

const PARSE_SYSTEM = `You are a commercial real estate data extraction specialist for Lee & Associates Newport Beach.
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
- State: two-letter abbreviation. "California" → "CA".`;

const SMART_COMPLETE_SYSTEM = `You are a commercial real estate expert assistant for Lee & Associates Newport Beach.
Suggest plausible values for EMPTY form fields based on filled context and Southern California market norms.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown, no explanation.
- Suggest values ONLY for the empty fields listed in the request.
- Never contradict or modify already-filled fields.
- Use realistic Southern California CRE market values:
  * Commission rates: Industrial lease 3–4%, Office 4–5%, Retail 4–6% of total consideration.
  * Lease type defaults: Industrial → NNN; Office → Full Service; Retail → NNN.
  * Term defaults if unknown: Industrial 60 months, Office 36 months, Retail 60 months.
  * State: default "CA" for Orange County / LA cities.
  * Lease rate: if building type known, apply realistic Orange County range.
- Keep suggestions conservative and realistic. When uncertain, omit the field.`;

const BROCHURE_SYSTEM = `You are a commercial real estate data extraction specialist for Lee & Associates Newport Beach.
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
- Extract all highlights/features into comments as a concise bullet list.`;

const VOUCHER_REVIEW_SYSTEM = `You are a commercial real estate deal-entry quality reviewer for Lee & Associates Newport Beach.
Review parsed voucher data and identify genuine errors, inconsistencies, or suspicious values.

CRITICAL RULES:
- Return ONLY a raw JSON array (no markdown, no explanation).
- Each item: { "field": "human-readable field name", "issue": "brief description", "suggestion": "corrected value as string", "reason": "why this looks wrong", "inputId": "html_input_id_or_null" }
- Only flag REAL problems. Do not flag minor formatting differences.
- Return [] if everything looks correct — do not fabricate issues.
- Flag: date ranges where end is before start; term mismatch vs date range; rent rows that don't match term length; commission percentages above 10% or below 0.5%; missing required fields for lease vs sale type; address with no city or state; impossible SF values (negative, or >10M for a single deal).
- Do NOT flag: missing optional fields, minor date format differences, missing phone/email.`;

// ─── Shared JSON schema builder ───────────────────────────────────────────────

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

// ─── Router ───────────────────────────────────────────────────────────────────

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
          { role: "system", content: PARSE_SYSTEM },
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
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : "{}");
      } catch {
        parsed = {};
      }

      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim() !== "")
      );

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

      const response = await invokeLLM({
        messages: [
          { role: "system", content: SMART_COMPLETE_SYSTEM },
          {
            role: "user",
            content: `Tab: ${tab}\n\nFilled fields:\n${filledSummary || "(none yet)"}\n\nSuggest values for these empty fields only: ${emptyFields.join(", ")}\n\nReturn JSON:`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildJsonSchema(`${tab}_suggestions`, emptyFields),
        },
      });

      const raw = response.choices?.[0]?.message?.content;
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : "{}");
      } catch {
        parsed = {};
      }

      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim() !== "")
      );

      return { success: true, fields, tab };
    }),

  /**
   * Scrape a property brochure (PDF or image) and extract listing fields.
   * Fetches the file server-side to avoid CORS issues and sends as base64.
   */
  scrapeBrochure: publicProcedure
    .input(
      z.object({
        fileUrl: z.string().url(),
        mimeType: z
          .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
          .default("application/pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const { fileUrl, mimeType } = input;
      const fieldNames = Object.keys(listingFields.shape);

      // Fetch file server-side → avoids CORS and lets us send as base64 inline data
      let base64Data: string;
      try {
        const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
        if (!fileResp.ok) throw new Error(`File fetch failed: ${fileResp.status}`);
        const buffer = await fileResp.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
      } catch (e: any) {
        return {
          success: false,
          fields: {},
          tab: "listing" as const,
          fieldCount: 0,
          error: `Could not fetch file: ${e.message}`,
        };
      }

      // Use data URL — works for images; for PDFs some providers support it too
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const userContent: any[] = [
        {
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" },
        },
        {
          type: "text",
          text: `Extract all listing fields you can identify from this ${mimeType === "application/pdf" ? "PDF brochure" : "brochure image"}.\n\nAvailable fields: ${fieldNames.join(", ")}\n\nReturn JSON with only fields you can confidently extract:`,
        },
      ];

      const response = await invokeLLM({
        messages: [
          { role: "system", content: BROCHURE_SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildJsonSchema("brochure_listing_fields", fieldNames),
        },
      });

      const raw = response.choices?.[0]?.message?.content;
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : "{}");
      } catch {
        parsed = {};
      }

      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim() !== "")
      );

      return {
        success: true,
        fields,
        tab: "listing" as const,
        fieldCount: Object.keys(fields).length,
      };
    }),

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
      const dataStr = JSON.stringify(input.dealData, null, 2);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: VOUCHER_REVIEW_SYSTEM },
          {
            role: "user",
            content: `Review this parsed Lee & Associates commission voucher data for errors or inconsistencies:\n\n${dataStr}\n\nReturn a JSON array of issues (or [] if everything looks correct):`,
          },
        ],
        // No json_schema — array response; parse as text
        response_format: { type: "json_object" },
      });

      const raw = response.choices?.[0]?.message?.content;
      let suggestions: unknown[] = [];
      try {
        const text = typeof raw === "string" ? raw.trim() : "[]";
        // Model may return { "suggestions": [...] } or a bare array
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) suggestions = parsed;
        else if (Array.isArray(parsed?.suggestions)) suggestions = parsed.suggestions;
        else if (Array.isArray(parsed?.issues)) suggestions = parsed.issues;
      } catch {
        suggestions = [];
      }

      return { success: true, suggestions };
    }),
});
