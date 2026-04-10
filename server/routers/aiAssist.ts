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

function buildParseSystemPrompt(tab: string): string {
  return `You are an AI assistant for a commercial real estate broker submission tool at Lee & Associates Newport Beach.
Your job is to extract structured field values from a natural language deal description for the "${tab}" form tab.

Rules:
- Return ONLY a valid JSON object with the field names listed below. No markdown, no explanation.
- Only include fields you can confidently extract from the description.
- For monetary values, return numbers as strings without $ or commas (e.g. "1.25" not "$1.25/SF").
- For dates, use MM/DD/YYYY format.
- For property type, use one of: Industrial, Office, Retail, Land, Other.
- For transaction type, use: Lease or Sale.
- For representation type, use: Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, or Dual.
- For term, use a number (months) or descriptive string like "60" or "5 years".
- If the description mentions a broker name, put it in listingAgentName or brokerName.
- Keep values concise and clean — no extra punctuation.`;
}

function buildSmartCompleteSystemPrompt(tab: string): string {
  return `You are an AI assistant for a commercial real estate broker submission tool at Lee & Associates Newport Beach.
Your job is to intelligently suggest values for EMPTY fields in the "${tab}" form tab, based on the values already filled in.

Rules:
- Return ONLY a valid JSON object with suggested field names and values. No markdown, no explanation.
- Only suggest values for fields that are currently empty (provided as null or "").
- Base your suggestions on standard commercial real estate practices in Southern California.
- For commission rates: industrial lease = 3-4% of total consideration; office = 4-5%; retail = 4-6%.
- For lease type: if industrial → NNN; if office → Full Service or Modified Gross; if retail → NNN.
- For term: if not specified, suggest "60" months for industrial, "36" for office, "60" for retail.
- For state: if city is in Orange County or LA area, suggest "CA".
- Do not suggest values that contradict already-filled fields.
- Keep suggestions realistic and conservative.`;
}

function buildBrochureScrapeSystemPrompt(): string {
  return `You are an AI assistant for a commercial real estate broker submission tool at Lee & Associates Newport Beach.
Your job is to extract structured listing field values from a commercial real estate property brochure or flyer.

Rules:
- Return ONLY a valid JSON object. No markdown, no explanation.
- Extract as many fields as you can confidently identify from the brochure content.
- For monetary values, return numbers as strings without $ or commas (e.g. "1.25" not "$1.25/SF/Mo").
- For dates, use MM/DD/YYYY format.
- For property type, use one of: Industrial, Office, Retail, Land, Other.
- For transaction type, use: Lease or Sale.
- For term, return number of months as a string (e.g. "60" for 5 years).
- For building SF and suite SF, return numeric strings without commas (e.g. "12500").
- For asking price on sales, return the number without $ or commas (e.g. "2500000").
- For rate $/SF/Mo on leases, return just the number (e.g. "1.25").
- Extract agent/broker names if visible.
- Extract property address, city, state, zip if present.
- Extract lease type (NNN, FSG, MG, Gross, Net) if mentioned.
- Extract any relevant comments or property highlights.
- If a field cannot be determined, omit it entirely.`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiAssistRouter = router({
  /**
   * Parse a natural language deal description into structured form fields.
   */
  parse: publicProcedure
    .input(
      z.object({
        description: z.string().min(5).max(2000),
        tab: z.enum(["listing", "voucher", "sign", "comp"]),
      })
    )
    .mutation(async ({ input }) => {
      const { description, tab } = input;
      const schema = tabFieldSchemas[tab];

      const systemPrompt = buildParseSystemPrompt(tab);
      const fieldNames = Object.keys(schema.shape).join(", ");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Available fields: ${fieldNames}\n\nDeal description: "${description}"\n\nExtract field values as JSON:`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: `${tab}_fields`,
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                Object.keys(schema.shape).map((k) => [k, { type: "string" }])
              ),
              required: [],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {};
      }

      // Remove empty strings
      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v && v.trim() !== "")
      );

      return { success: true, fields, tab };
    }),

  /**
   * Smart complete: given current form state, suggest values for empty fields.
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

      // Find which fields are empty
      const emptyFields = Object.keys(schema.shape).filter(
        (k) => !currentFields[k] || currentFields[k].trim() === ""
      );

      if (emptyFields.length === 0) {
        return { success: true, fields: {}, tab, message: "All fields already filled" };
      }

      const systemPrompt = buildSmartCompleteSystemPrompt(tab);
      const filledSummary = Object.entries(currentFields)
        .filter(([, v]) => v && v.trim() !== "")
        .map(([k, v]) => `${k}: "${v}"`)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Currently filled fields:\n${filledSummary || "(none)"}\n\nEmpty fields to suggest values for: ${emptyFields.join(", ")}\n\nSuggest values as JSON:`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: `${tab}_suggestions`,
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                emptyFields.map((k) => [k, { type: "string" }])
              ),
              required: [],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent2 = response.choices?.[0]?.message?.content;
      const content = typeof rawContent2 === "string" ? rawContent2 : "{}";
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {};
      }

      // Only return non-empty suggestions
      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v && v.trim() !== "")
      );

      return { success: true, fields, tab };
    }),

  /**
   * Scrape a property brochure (PDF or image URL) and extract listing fields.
   * Accepts a publicly accessible file URL (e.g. from S3 after upload).
   */
  scrapeBrochure: publicProcedure
    .input(
      z.object({
        fileUrl: z.string().url(),
        mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).default("application/pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const { fileUrl, mimeType } = input;
      const fieldNames = Object.keys(listingFields.shape).join(", ");
      const systemPrompt = buildBrochureScrapeSystemPrompt();

      const isImage = mimeType.startsWith("image/");

      const userContent: Array<{ type: string; text?: string; image_url?: { url: string }; file_url?: { url: string; mime_type: string } }> = isImage
        ? [
            {
              type: "image_url",
              image_url: { url: fileUrl },
            },
            {
              type: "text",
              text: `Extract listing fields from this property brochure image.\nAvailable fields: ${fieldNames}\n\nReturn as JSON:`,
            },
          ]
        : [
            {
              type: "file_url",
              file_url: { url: fileUrl, mime_type: mimeType },
            },
            {
              type: "text",
              text: `Extract listing fields from this property brochure PDF.\nAvailable fields: ${fieldNames}\n\nReturn as JSON:`,
            },
          ];

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: userContent as any,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "brochure_listing_fields",
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                Object.keys(listingFields.shape).map((k) => [k, { type: "string" }])
              ),
              required: Object.keys(listingFields.shape),
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {};
      }

      // Remove empty strings
      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v && v.trim() !== "")
      );

      return { success: true, fields, tab: "listing" as const, fieldCount: Object.keys(fields).length };
    }),
});
