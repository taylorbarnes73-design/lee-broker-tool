import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { PDFParse } from "pdf-parse";
import { invokeLLM, type MessageContent } from "../_core/llm";
import { adminProcedure, router } from "../_core/trpc";
import { getSetting } from "../settings/getSetting";
import { ensureSettingsCache } from "../settings/settingsStore";
import {
  addBuildoutPropertyPhoto,
  createBuildoutProperty,
  updateBuildoutProperty,
  buildoutResultErrorMessage,
} from "../services/buildoutClient";
import { mapListingFieldsToBuildoutProperty } from "../services/listingToBuildoutMap";
import { storageGetBytes } from "../storage";

/** Server-side brochure / flyer size cap (after fetch or decode). */
export const BROCHURE_MAX_BYTES = 18 * 1024 * 1024;

const listingKeys = [
  "propertyType",
  "transactionType",
  "address",
  "city",
  "state",
  "zip",
  "rateSfMo",
  "term",
  "leaseType",
  "buildingSf",
  "suiteSf",
  "askingPrice",
  "listingAgentName",
  "listingAgentLicense",
  "comments",
] as const;

const mimeSchema = z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function fetchDocumentBuffer(fileUrl: string): Promise<{ fileBuffer: Buffer | null; error: string | null }> {
  const target = fileUrl.trim();
  const isHttp = /^https?:\/\//i.test(target);
  const isDataUrl = /^data:[^;]+;base64,/i.test(target);
  const isStoredPath = target.startsWith("/local-uploads/") || target.startsWith("/api/files/content");
  const isStoredKey = /^(broker-docs|broker-admin|broker-docusign)\//.test(target);

  try {
    if (isStoredPath || isStoredKey) {
      const { bytes } = await storageGetBytes(target);
      if (bytes.length > BROCHURE_MAX_BYTES) {
        return {
          fileBuffer: null,
          error: `File exceeds maximum size of ${Math.floor(BROCHURE_MAX_BYTES / (1024 * 1024))} MB.`,
        };
      }
      return { fileBuffer: bytes, error: null };
    }
    if (!isHttp && !isDataUrl) {
      return { fileBuffer: null, error: "Unsupported file URL format" };
    }
    const fileResp = await fetch(target, { signal: AbortSignal.timeout(30_000) });
    if (!fileResp.ok) {
      return { fileBuffer: null, error: `File fetch failed: ${fileResp.status}` };
    }
    const buffer = Buffer.from(await fileResp.arrayBuffer());
    if (buffer.length > BROCHURE_MAX_BYTES) {
      return {
        fileBuffer: null,
        error: `File exceeds maximum size of ${Math.floor(BROCHURE_MAX_BYTES / (1024 * 1024))} MB.`,
      };
    }
    return { fileBuffer: buffer, error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { fileBuffer: null, error: `Could not fetch file: ${message}` };
  }
}

async function buildDocumentUserContent(
  fileBuffer: Buffer,
  mimeType: z.infer<typeof mimeSchema>,
  promptText: string
) {
  if (mimeType !== "application/pdf") {
    return [
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
          detail: "high" as const,
        },
      },
      { type: "text" as const, text: promptText },
    ];
  }

  return [
    {
      type: "text" as const,
      text: await (async () => {
        try {
          const parser = new PDFParse({ data: fileBuffer });
          const textResult = await parser.getText();
          await parser.destroy?.();
          const cleaned = normalizeWhitespace(textResult.text || "");
          const trimmed = cleaned.slice(0, 40_000);
          return `${promptText}\n\nDocument text (extracted):\n${trimmed}`;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Unknown PDF parse error";
          return `${promptText}\n\nNote: PDF text extraction failed (${message}). Return empty property keys, contacts [], photoUrls [].`;
        }
      })(),
    },
  ];
}

function brochureImportJsonSchema() {
  return {
    name: "brochure_listing_import",
    strict: true,
    schema: {
      type: "object",
      properties: {
        property: {
          type: "object",
          properties: Object.fromEntries(listingKeys.map(k => [k, { type: "string" }])),
          required: [] as string[],
          additionalProperties: false,
        },
        contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              company: { type: "string" },
              role: { type: "string" },
            },
            required: [] as string[],
            additionalProperties: false,
          },
        },
        photoUrls: { type: "array", items: { type: "string" } },
      },
      required: ["property", "contacts", "photoUrls"],
      additionalProperties: false,
    },
  };
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function sanitizeListingProperty(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of listingKeys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim() !== "") {
      out[k] = v.trim();
    }
  }
  return out;
}

function sanitizeContacts(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  const rows: Array<Record<string, string>> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const k of ["name", "email", "phone", "company", "role"] as const) {
      if (typeof o[k] === "string" && o[k].trim()) row[k] = o[k].trim();
    }
    if (Object.keys(row).length) rows.push(row);
  }
  return rows;
}

function sanitizePhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const t = u.trim();
    if (/^https:\/\//i.test(t) && t.length < 2048) out.push(t);
  }
  return [...new Set(out)].slice(0, 12);
}

async function brochureImportSystemPrompt(): Promise<string> {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured data from a listing brochure, offering memorandum page, or flyer.

CRITICAL RULES:
- Return ONLY JSON matching the provided schema. No markdown.
- property: only listing-related string fields you are confident about; omit unknown keys or use empty strings only when the schema requires a key (prefer omission via empty object fields allowed).
- contacts: brokers, agents, or landlord contacts with name / email / phone / company / role when visible.
- photoUrls: only absolute https:// URLs printed in the document (e.g. CDN or property photo links). Do not invent URLs. If none, use [].
- Monetary / SF / state / address rules match the brokerage listing form: numeric strings without commas for money and SF where applicable; state as two-letter; street in address without city/state.`;
}

export const listingImportRouter = router({
  /**
   * Admin-only: extracts listing fields, contacts, and any https photo URLs from a brochure (PDF or image).
   * Expects an already-uploaded file URL (same pattern as aiAssist.scrapeBrochure).
   */
  extractFromBrochure: adminProcedure
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
        mimeType: mimeSchema.default("application/pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const fetched = await fetchDocumentBuffer(input.fileUrl);
      if (!fetched.fileBuffer) {
        return {
          success: false as const,
          error: fetched.error ?? "Could not read file",
          property: {} as Record<string, string>,
          contacts: [] as Array<Record<string, string>>,
          photoUrls: [] as string[],
        };
      }

      const fieldList = listingKeys.join(", ");
      const promptText = `Extract listing data from this document.

Target property fields (strings, omit unknown): ${fieldList}

Also extract contacts and any https image URLs as specified in the system instructions.`;

      const userContent = await buildDocumentUserContent(fetched.fileBuffer, input.mimeType, promptText);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: await brochureImportSystemPrompt() },
          { role: "user", content: userContent as MessageContent[] },
        ],
        response_format: {
          type: "json_schema",
          json_schema: brochureImportJsonSchema(),
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const parsed = parseJsonObject(rawContent);
      const propRaw =
        parsed.property && typeof parsed.property === "object"
          ? (parsed.property as Record<string, unknown>)
          : {};

      return {
        success: true as const,
        property: sanitizeListingProperty(propRaw),
        contacts: sanitizeContacts(parsed.contacts),
        photoUrls: sanitizePhotoUrls(parsed.photoUrls),
      };
    }),

  /**
   * Admin-only: create or update a Buildout property using org settings API key + caller-supplied Buildout enum IDs.
   */
  pushToBuildout: adminProcedure
    .input(
      z.object({
        mode: z.enum(["create", "update"]),
        buildoutPropertyId: z.number().int().positive().optional(),
        brokerId: z.number().int().positive(),
        propertyTypeId: z.number().int().positive(),
        propertySubtypeId: z.number().int().positive(),
        listingFields: z.record(z.string(), z.string().optional()),
        photoUrls: z.array(z.string().url()).max(12).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.mode === "update" && input.buildoutPropertyId == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "buildoutPropertyId is required when mode is update.",
        });
      }

      const merged = await ensureSettingsCache();
      const apiKey = String(merged.get("integrations.buildout.api_key") ?? "").trim();
      const apiBaseUrl = (merged.get("integrations.buildout.api_base_url") as string | null) ?? null;

      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Buildout API key is not configured. Add it under Portal → Settings → Integrations.",
        });
      }

      const mapped = mapListingFieldsToBuildoutProperty(input.listingFields);
      const property: Record<string, unknown> = {
        broker_id: input.brokerId,
        property_type_id: input.propertyTypeId,
        property_subtype_id: input.propertySubtypeId,
        ...mapped,
      };

      let propertyId: number;
      if (input.mode === "create") {
        const created = await createBuildoutProperty({
          apiKey,
          apiBaseUrl,
          property,
        });
        propertyId = created.propertyId;
      } else {
        propertyId = input.buildoutPropertyId!;
        await updateBuildoutProperty({
          apiKey,
          apiBaseUrl,
          propertyId,
          property,
        });
      }

      const photoResults: Array<{ url: string; ok: boolean; error?: string }> = [];
      const urls = input.photoUrls ?? [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        const r = await addBuildoutPropertyPhoto({
          apiKey,
          apiBaseUrl,
          propertyId,
          photo: { url, sort_order: i },
        });
        if (r.ok) {
          photoResults.push({ url, ok: true });
        } else {
          photoResults.push({
            url,
            ok: false,
            error: buildoutResultErrorMessage(r, "add photo"),
          });
        }
      }

      return {
        success: true as const,
        propertyId,
        mode: input.mode,
        photoResults,
      };
    }),
});
