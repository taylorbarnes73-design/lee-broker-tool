import { Router } from "express";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { resolvePortalRequestUser } from "./auth/resolvePortalRequestUser";
import { validateDealEntryForDealiusPush, validateListingEntryForDealiusPush, pushDealEntryToDealius, pushListingEntryToDealius } from "./services/dealiusEntry";
import { DealiusClient } from "./services/dealiusClient";
import { authenticateConfiguredDealius } from "./services/dealiusAuth";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { uploads } from "../drizzle/schema";
import type { Request, Response } from "express";
import { parseLeeVoucherExcelBuffer, submissionPayloadPatchFromParsedVoucher } from "./services/voucherExcel";
import { listingFormPatchFromParsed, parseListingFormPdfBuffer } from "./services/listingFormPdf";
import { extractPdfPlainText, heuristicsFromPdfText, mergeScrapePatches } from "./services/pdfTextScrape";

function jsonErr(res: Response, status: number, error: string, extra?: Record<string, unknown>) {
  res.status(status).json({ success: false, error, ...extra });
}

function inferMimeType(filename: string): string | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xlsm")) {
    return "application/vnd.ms-excel.sheet.macroEnabled.12";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  return null;
}

export const dealiusAdminApiRouter = Router();

dealiusAdminApiRouter.use(async (req, res, next) => {
  try {
    const user = await resolvePortalRequestUser(req);
    if (!user) {
      jsonErr(res, 401, "Not authenticated");
      return;
    }
    if (user.role !== "admin") {
      jsonErr(res, 403, "Admin access required");
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    jsonErr(res, 401, "Not authenticated");
  }
});

const pushBody = z.object({
  entryMode: z.enum(["deal", "listing"]),
  entry: z.record(z.string(), z.unknown()),
});

dealiusAdminApiRouter.post("/push", async (req: Request, res: Response) => {
  const parsed = pushBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }

  try {
    const { entryMode, entry } = parsed.data;
    const validation = entryMode === "listing" ? validateListingEntryForDealiusPush(entry) : validateDealEntryForDealiusPush(entry);
    if (!validation.ok) {
      jsonErr(res, 400, validation.errors.join(" "), { errors: validation.errors });
      return;
    }

    const data = entryMode === "listing" ? await pushListingEntryToDealius({ entry }) : await pushDealEntryToDealius({ entry });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    jsonErr(res, 500, msg);
  }
});

const dealiusDocumentBody = z.object({
  entityType: z.enum(["deal", "listing"]),
  entityId: z.union([z.string(), z.number()]).transform(v => String(v).trim()).pipe(z.string().min(1).max(64)),
  files: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(128).default("application/octet-stream"),
        base64Data: z.string().min(1),
        documentType: z.string().trim().max(128).optional().nullable(),
      })
    )
    .min(1)
    .max(10),
});

dealiusAdminApiRouter.post("/documents", async (req: Request, res: Response) => {
  const user = (req as any).user as { openId: string; name?: string | null };
  const parsed = dealiusDocumentBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }

  const { entityType, entityId, files } = parsed.data;
  const maxBytes = 100 * 1024 * 1024;

  const client = new DealiusClient();
  let token: string;
  try {
    token = await authenticateConfiguredDealius(client);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    jsonErr(res, 500, msg);
    return;
  }

  const db = await getDb();
  const results: any[] = [];

  for (const file of files) {
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    let buffer: Buffer;
    try {
      buffer = Buffer.from(file.base64Data, "base64");
    } catch {
      results.push({ filename: file.filename, success: false, error: "Invalid base64 data" });
      continue;
    }
    if (!buffer.length) {
      results.push({ filename: file.filename, success: false, error: "Empty file" });
      continue;
    }
    if (buffer.length > maxBytes) {
      results.push({ filename: file.filename, success: false, error: "File too large (max 100MB)" });
      continue;
    }

    const fileKey = `broker-docs/dealius/${entityType}/${entityId}/${nanoid(10)}-${safeFilename}`;
    const normalizedMimeType =
      file.mimeType && file.mimeType !== "application/octet-stream"
        ? file.mimeType
        : inferMimeType(file.filename) ?? "application/octet-stream";
    const stored = await storagePut(fileKey, buffer, normalizedMimeType);

    if (db) {
      try {
        await db.insert(uploads).values({
          fileKey,
          url: stored.url,
          filename: file.filename,
          mimeType: normalizedMimeType,
          fileSize: buffer.length,
          category: "dealius-document",
          reference: `dealius:${entityType}:${entityId}`,
          uploaderName: user.name ?? "Admin",
          uploaderOpenId: user.openId,
        });
      } catch {
        // Best effort only; attachment should still proceed.
      }
    }

    const uploaded = await client.uploadDocument({
      token,
      entityType,
      entityId,
      filename: file.filename,
      mimeType: normalizedMimeType,
      buffer,
      documentType: file.documentType ?? null,
    });
    const success = uploaded.status >= 200 && uploaded.status < 300;
    results.push({
      filename: file.filename,
      success,
      status: uploaded.status,
      response: uploaded.text.slice(0, 500),
      fileKey,
      url: stored.url,
      documentType: file.documentType ?? null,
    });
  }

  const failed = results.filter(r => !r.success);
  res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    data: { entityType, entityId, results },
    error: failed.length ? `${failed.length} document(s) failed to attach to Dealius.` : undefined,
  });
});

const scrapeBody = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128).optional(),
  base64Data: z.string().min(1),
});

dealiusAdminApiRouter.post("/scrape", async (req: Request, res: Response) => {
  const parsed = scrapeBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }

  const maxBytes = 100 * 1024 * 1024;
  const { filename, base64Data } = parsed.data;
  const normalizedMimeType =
    parsed.data.mimeType && parsed.data.mimeType !== "application/octet-stream"
      ? parsed.data.mimeType
      : inferMimeType(filename) ?? "application/octet-stream";

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    jsonErr(res, 400, "Invalid base64 data");
    return;
  }
  if (!buffer.length) {
    jsonErr(res, 400, "Empty file");
    return;
  }
  if (buffer.length > maxBytes) {
    jsonErr(res, 400, "File too large (max 100MB)");
    return;
  }

  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm") || lower.endsWith(".xls")) {
      const parsedVoucher = parseLeeVoucherExcelBuffer(buffer);
      const patch = submissionPayloadPatchFromParsedVoucher(parsedVoucher);
      // Dealius admin tool expects repTypeID as string.
      if (typeof patch.repTypeID === "number") patch.repTypeID = String(patch.repTypeID);
      res.json({
        success: true,
        data: {
          source: "voucher_excel",
          entryMode: "deal",
          mimeType: normalizedMimeType,
          filename,
          patch,
        },
      });
      return;
    }

    if (lower.endsWith(".pdf")) {
      const warnings: string[] = [];
      let patch: Record<string, unknown> = {};
      let source: "listing_form_pdf" | "listing_pdf_text" | "listing_llm" = "listing_pdf_text";

      // Step 1: Try structured form fields (AcroForm)
      try {
        const parsedListing = await parseListingFormPdfBuffer(buffer);
        patch = listingFormPatchFromParsed(parsedListing);
        source = "listing_form_pdf";
      } catch {
        // No form fields – expected for flat PDFs / listing agreements.
      }

      // Step 2: Extract raw text for regex heuristics and LLM input
      let plain = "";
      try {
        plain = await extractPdfPlainText(buffer);
      } catch {
        warnings.push("Could not extract text from PDF.");
      }

      // Step 3: LLM-powered smart extraction (multi-space aware)
      if (plain.length > 50) {
        try {
          const { invokeLLM } = await import("../_core/llm");
          const { getSetting } = await import("../settings/getSetting");
          const company = String(await getSetting("branding.company_name").catch(() => "Lee & Associates"));
          const trimmedText = plain.slice(0, 40_000);

          const llmResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a commercial real estate listing data extraction specialist for ${company}.
Extract structured data from a listing agreement, exclusive right to represent, or property marketing document.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Extract ONLY values you can identify with HIGH CONFIDENCE.
- For "spaces": extract ALL suites/units/spaces mentioned with their individual SF and asking rates.
- Monetary values: numeric strings, no $ or commas. "$1.25/SF/Mo" → "1.25".
- SF values: numeric strings without commas. "12,500 SF" → "12500".
- Dates: YYYY-MM-DD format.
- Property type: exactly Industrial, Office, Retail, Land, or Other.
- Transaction type: exactly Lease, Sale, Sublease, or "Sale or Lease".
- Commission: numeric percentage as string. "6%" → "6".
- Owner/lessor: the property owner or landlord company name ONLY, not random words.
- Address: street address only (no city/state/zip).
- State: two-letter abbreviation.
- Broker names: full name only. If multiple brokers listed, separate with semicolons.`
              },
              {
                role: "user",
                content: `Extract listing data from the document below. Return JSON matching this schema:

{
  "address": "street address only",
  "city": "city name",
  "state": "two-letter state",
  "zip": "5-digit zip",
  "propertyType": "Industrial|Office|Retail|Land|Other",
  "transactionType": "Lease|Sale|Sublease|Sale or Lease",
  "ownerCompany": "property owner / landlord company",
  "lessorName": "lessor if different from owner",
  "totalBldgSF": "total building SF as number string",
  "yearBuilt": "year built",
  "askingRate": "lease rate per SF",
  "askingPrice": "sale price",
  "feePercent": "commission percentage",
  "listingAgentName": "broker name(s), semicolon separated",
  "listingStartDate": "YYYY-MM-DD",
  "listingExpiryDate": "YYYY-MM-DD",
  "listingNotes": "key property features, brief",
  "spaces": [{ "suite": "", "sqft": "", "askingRate": "", "availableDate": "", "comments": "" }]
}

=== EXAMPLE 1: Multi-space lease listing ===
INPUT: "EXCLUSIVE LISTING AGREEMENT ... Owner: Pacific Industrial Partners LLC ... Property: 8400 Central Ave, Rancho Cucamonga, CA 91730 ... Total Building: 45,000 SF ... Year Built: 2005 ... Suite 100 - 12,000 SF - $1.15/SF/Mo NNN - Available Now ... Suite 210 - 8,500 SF - $1.25/SF/Mo NNN - Available 07/01/2026 ... Suite 305 - 6,200 SF - $1.10/SF/Mo NNN ... Commission: 5% of aggregate lease value ... Listing Agent: John Smith, Lee & Associates ... Term: 12 months from 05/01/2026 to 04/30/2027"
OUTPUT:
{"address":"8400 Central Ave","city":"Rancho Cucamonga","state":"CA","zip":"91730","propertyType":"Industrial","transactionType":"Lease","ownerCompany":"Pacific Industrial Partners LLC","totalBldgSF":"45000","yearBuilt":"2005","feePercent":"5","listingAgentName":"John Smith","listingStartDate":"2026-05-01","listingExpiryDate":"2027-04-30","spaces":[{"suite":"100","sqft":"12000","askingRate":"1.15","comments":"NNN"},{"suite":"210","sqft":"8500","askingRate":"1.25","availableDate":"2026-07-01","comments":"NNN"},{"suite":"305","sqft":"6200","askingRate":"1.10","comments":"NNN"}]}

=== EXAMPLE 2: Sale or lease with single space ===
INPUT: "EXCLUSIVE RIGHT TO SELL OR LEASE ... 2200 E Orangewood Ave, Anaheim, CA 92806 ... Owner/Lessor: Westgate Properties Inc and Westgate Holdings ... Industrial warehouse, 22,400 SF on 1.2 acres ... Built 1998 ... Asking: $4,250,000 for sale or $1.35/SF/Mo NNN for lease ... Commission to listing broker: 4% sale / 6% lease ... Listing Brokers: Jane Doe; Mike Johnson ... Agreement dated 03/15/2026, expires 09/15/2026"
OUTPUT:
{"address":"2200 E Orangewood Ave","city":"Anaheim","state":"CA","zip":"92806","propertyType":"Industrial","transactionType":"Sale or Lease","ownerCompany":"Westgate Properties Inc","totalBldgSF":"22400","yearBuilt":"1998","askingRate":"1.35","askingPrice":"4250000","feePercent":"4","listingAgentName":"Jane Doe; Mike Johnson","listingStartDate":"2026-03-15","listingExpiryDate":"2026-09-15","listingNotes":"1.2 acres, NNN lease terms","spaces":[{"suite":"","sqft":"22400","askingRate":"1.35","comments":"NNN"}]}

=== EXAMPLE 3: Owner representation with property details ===
INPUT: "EXCLUSIVE AGENCY LISTING AGREEMENT ... this agreement between Diamond Realty Group (Owner) and Lee & Associates ... property located at 11330 Diamond Back Way, Grass Valley, CA 95945 ... industrial/flex building ... Commission shall be six percent (6%) ... Broker: Taylor Barnes"
OUTPUT:
{"address":"11330 Diamond Back Way","city":"Grass Valley","state":"CA","zip":"95945","propertyType":"Industrial","transactionType":"Lease","ownerCompany":"Diamond Realty Group","feePercent":"6","listingAgentName":"Taylor Barnes"}

=== NOW EXTRACT FROM THIS DOCUMENT ===
${trimmedText}`
              }
            ],
            maxTokens: 2048,
          });

          const raw = llmResponse.choices?.[0]?.message?.content;
          if (typeof raw === "string" && raw.trim()) {
            const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            const llmData = JSON.parse(cleaned);
            if (llmData && typeof llmData === "object") {
              // Merge LLM results into patch, preferring LLM for empty fields
              for (const [key, value] of Object.entries(llmData)) {
                if (key === "spaces" && Array.isArray(value) && value.length > 0) {
                  // Only use LLM spaces if we don't already have form-scraped ones
                  const existingSpaces = Array.isArray(patch.spaces) ? patch.spaces as any[] : [];
                  if (!existingSpaces.length || existingSpaces.every((s: any) => !s.suite && !s.sqft)) {
                    patch.spaces = value;
                  }
                } else if (value !== null && value !== undefined && String(value).trim() !== "") {
                  const existing = patch[key];
                  const isEmpty = existing === undefined || existing === null || String(existing).trim() === "";
                  if (isEmpty) {
                    patch[key] = value;
                  }
                }
              }
              source = "listing_llm";
            }
          }
        } catch (llmErr: unknown) {
          const llmMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
          warnings.push(`LLM extraction skipped: ${llmMsg.slice(0, 120)}`);
        }
      }

      // Step 4: Regex heuristics as fallback for anything the LLM missed
      if (plain.length > 0) {
        const { patch: textPatch, hints } = heuristicsFromPdfText(plain);
        patch = mergeScrapePatches(patch, textPatch);
        (patch as any)._hints = hints;
      }

      // Step 5: Derive missing fields
      const addr = String(patch.address ?? "").trim();
      const suite = String(patch.suite ?? "").trim();
      if (!String(patch.listingName ?? "").trim() && addr) {
        patch.listingName = suite ? `${addr}, Ste ${suite}` : addr;
      }
      if (!String(patch.ownerCompany ?? "").trim() && String(patch.lessorName ?? "").trim()) {
        // Only copy if it looks like a real name (more than 2 chars, not just "and")
        const lessor = String(patch.lessorName).trim();
        if (lessor.length > 2) patch.ownerCompany = lessor;
      }
      if (String(patch.commission ?? "").trim() === "" && patch.feePercent != null) {
        patch.commission = patch.feePercent;
      }

      res.json({
        success: true,
        data: {
          source,
          entryMode: "listing" as const,
          mimeType: normalizedMimeType,
          filename,
          patch,
          warnings,
        },
      });
      return;
    }

    jsonErr(res, 400, "Unsupported file type. Upload .xlsx/.xlsm/.xls voucher or .pdf listing agreement / listing form.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    jsonErr(res, 500, `Could not scrape file: ${msg}`);
  }
});

// ── Optional: quick health check for configured creds ──
dealiusAdminApiRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const client = new DealiusClient();
    const token = await authenticateConfiguredDealius(client);
    // Avoid leaking token; just validate auth succeeded.
    res.json({ success: true, data: { authenticated: Boolean(token) } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    jsonErr(res, 500, msg);
  }
});

