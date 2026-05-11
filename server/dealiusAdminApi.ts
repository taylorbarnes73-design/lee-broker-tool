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
      let source: "listing_form_pdf" | "listing_pdf_text" = "listing_pdf_text";

      try {
        const parsedListing = await parseListingFormPdfBuffer(buffer);
        patch = listingFormPatchFromParsed(parsedListing);
        source = "listing_form_pdf";
      } catch {
        warnings.push("No usable PDF form fields found; filled gaps from document text where possible.");
      }

      const plain = await extractPdfPlainText(buffer);
      const { patch: textPatch, hints } = heuristicsFromPdfText(plain);
      patch = mergeScrapePatches(patch, textPatch);

      const addr = String(patch.address ?? "").trim();
      const city = String(patch.city ?? "").trim();
      if (source === "listing_form_pdf" && !addr && !city) {
        warnings.push("Form fields were empty; merged text heuristics for address and parties.");
      }

      if (!String(patch.ownerCompany ?? "").trim() && String(patch.lessorName ?? "").trim()) {
        patch.ownerCompany = patch.lessorName;
      }
      if (!String(patch.listingName ?? "").trim() && addr) {
        patch.listingName = addr;
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
          hints,
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

