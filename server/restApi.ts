/**
 * REST API endpoints for Power Automate Custom Connector
 * Base path: /api/v1
 *
 * All endpoints accept and return JSON.
 * Requests must include the shared connector API key in the x-api-key header.
 */

import { Router, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { brokerAdminRequests, uploads, submissions } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";
import { DealiusClient } from "./services/dealiusClient";
import { authenticateConfiguredDealius } from "./services/dealiusAuth";

export const restApiRouter = Router();

// ── Utility ──

function ok(res: Response, data: unknown) {
  res.json({ success: true, data });
}

function err(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, error: message });
}

function getConnectorApiKey(): string {
  return process.env.CONNECTOR_API_KEY ?? "";
}

function hasValidApiKey(req: Request): boolean {
  const configuredApiKey = getConnectorApiKey();
  if (!configuredApiKey) return false;

  const providedApiKey = req.header("x-api-key");
  if (!providedApiKey) return false;

  const expected = Buffer.from(configuredApiKey, "utf8");
  const provided = Buffer.from(providedApiKey, "utf8");
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}

restApiRouter.use((req: Request, res: Response, next) => {
  if (!getConnectorApiKey()) {
    err(res, 503, "Connector API key is not configured");
    return;
  }

  if (!hasValidApiKey(req)) {
    err(res, 401, "Invalid or missing API key");
    return;
  }

  // CSRF protection: reject browser-originated cross-site requests on mutating methods.
  // The connector uses x-api-key which browsers cannot set via simple requests,
  // so this is an extra defence-in-depth check.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      err(res, 415, "Content-Type must be application/json");
      return;
    }
  }

  next();
});

// ── POST /api/v1/submit/listing ──
/**
 * Submit a new listing entry.
 * Body: ListingSubmission (see OpenAPI spec for full schema)
 */
restApiRouter.post("/submit/listing", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");
    if (!body.propertyType) return err(res, 400, "propertyType is required");
    if (!body.transactionType) return err(res, 400, "transactionType is required");

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const [result] = await db.insert(submissions).values({
      formType: "listing",
      payload: JSON.stringify(body),
      submittedBy: body.agentName ?? null,
      reference: body.propertyAddress ?? null,
    });

    ok(res, {
      submissionId: (result as any).insertId,
      formType: "listing",
      propertyAddress: body.propertyAddress,
      submittedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── POST /api/v1/submit/voucher ──
/**
 * Submit a commission voucher.
 */
restApiRouter.post("/submit/voucher", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");
    if (!body.representationType) return err(res, 400, "representationType is required");

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const [result] = await db.insert(submissions).values({
      formType: "voucher",
      payload: JSON.stringify(body),
      submittedBy: body.listingAgentName ?? null,
      reference: body.propertyAddress ?? null,
    });

    ok(res, {
      submissionId: (result as any).insertId,
      formType: "voucher",
      propertyAddress: body.propertyAddress,
      totalCommission: body.totalCommission ?? null,
      submittedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── POST /api/v1/submit/sign-request ──
/**
 * Submit a sign order request.
 */
restApiRouter.post("/submit/sign-request", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const poNumber = body.poNumber ?? `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${nanoid(3).toUpperCase()}`;

    const [result] = await db.insert(submissions).values({
      formType: "sign-request",
      payload: JSON.stringify({ ...body, poNumber }),
      submittedBy: body.requestedBy ?? null,
      reference: body.propertyAddress ?? null,
    });

    ok(res, {
      submissionId: (result as any).insertId,
      formType: "sign-request",
      poNumber,
      propertyAddress: body.propertyAddress,
      submittedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── POST /api/v1/submit/comp ──
/**
 * Submit a comp input record.
 */
restApiRouter.post("/submit/comp", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.address) return err(res, 400, "address is required");
    if (!body.compType) return err(res, 400, "compType is required");

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const [result] = await db.insert(submissions).values({
      formType: "comp",
      payload: JSON.stringify(body),
      submittedBy: body.lanbSource ?? null,
      reference: body.address ?? null,
    });

    ok(res, {
      submissionId: (result as any).insertId,
      formType: "comp",
      compType: body.compType,
      address: body.address,
      submittedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── GET /api/v1/submissions ──
/**
 * List recent form submissions.
 * Query params: formType, limit (default 50)
 */
restApiRouter.get("/submissions", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const formType = req.query.formType as string | undefined;

    let rows = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt))
      .limit(limit);

    if (formType) {
      rows = rows.filter(r => r.formType === formType);
    }

    ok(res, rows.map(r => ({
      submissionId: r.id,
      formType: r.formType,
      reference: r.reference,
      submittedBy: r.submittedBy,
      submittedAt: r.createdAt,
    })));
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── GET /api/v1/submissions/:id ──
/**
 * Get full payload of a single submission by ID.
 */
restApiRouter.get("/submissions/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const id = parseInt(req.params.id);
    if (isNaN(id)) return err(res, 400, "Invalid submission ID");

    const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    if (!rows.length) return err(res, 404, "Submission not found");

    const row = rows[0];
    ok(res, {
      submissionId: row.id,
      formType: row.formType,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedAt: row.createdAt,
      payload: JSON.parse(row.payload ?? "{}"),
    });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── GET /api/v1/files ──
/**
 * List uploaded files.
 * Query params: category, reference, limit (default 50)
 */
restApiRouter.get("/files", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const category = req.query.category as string | undefined;
    const reference = req.query.reference as string | undefined;

    let rows = await db
      .select()
      .from(uploads)
      .orderBy(desc(uploads.createdAt))
      .limit(limit);

    if (category) rows = rows.filter(r => r.category === category);
    if (reference) rows = rows.filter(r => r.reference === reference);

    ok(res, rows.map(r => ({
      fileKey: r.fileKey,
      filename: r.filename,
      url: r.url,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      category: r.category,
      reference: r.reference,
      uploaderName: r.uploaderName,
      uploadedAt: r.createdAt,
    })));
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── GET /api/v1/files/url ──
/**
 * Get a fresh download URL for a file.
 * Query param: key (S3 file key)
 */
restApiRouter.get("/files/url", async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) return err(res, 400, "key query parameter is required");

    const { url } = await storageGet(key);
    ok(res, { fileKey: key, url });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── POST /api/v1/inbox/email ──
/**
 * Create a trackable request from an inbound shared-mailbox email.
 * Intended to be called from Power Automate ("When a new email arrives").
 *
 * Body:
 * {
 *   messageId: string,
 *   internetMessageId?: string,
 *   subject?: string,
 *   from?: string,
 *   receivedAt?: string,
 *   bodyPreview?: string,
 *   category?: string,          // voucher, docusign, listing, contract, etc.
 *   docusignEnvelopeId?: string,
 *   dealiusDealId?: string,
 *   dealiusListingId?: string,
 *   reference?: string,         // e.g. "123 Main St, Newport Beach"
 *   attachments?: [{ filename, mimeType, base64Data }]
 * }
 */
restApiRouter.post("/inbox/email", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const messageId = String(body.messageId ?? "").trim();
    if (!messageId) return err(res, 400, "messageId is required");

    const subject = String(body.subject ?? "").trim();
    const from = String(body.from ?? "").trim();
    const receivedAt = String(body.receivedAt ?? "").trim();
    const reference = String(body.reference ?? "").trim() || subject || null;

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const category = body.category != null ? String(body.category).trim() : "";
    const confidential = Boolean(body.confidential);
    const requestedSystemImpact = body.systemImpact ?? null;
    const systemImpact =
      category.toLowerCase() === "voucher"
        ? ["Dealius", ...(confidential ? [] : ["Metropolis"])]
        : Array.isArray(requestedSystemImpact)
          ? requestedSystemImpact
          : null;

    const [result] = await db.insert(brokerAdminRequests).values({
      title: subject || "(no subject)",
      receivedAt: receivedAt ? new Date(receivedAt) : null,
      fromEmail: from || null,
      category: category || null,
      confidential: confidential ? 1 : 0,
      systemImpact: systemImpact ? JSON.stringify(systemImpact) : null,
      owner: body.owner ?? null,
      status: "new",
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
      priority: body.priority ?? null,
      emailMessageId: messageId,
      internetMessageId: body.internetMessageId ?? null,
      outlookWebLink: body.outlookWebLink ?? null,
      threadKey: body.threadKey ?? null,
      dealiusDealId: body.dealiusDealId ?? null,
      dealiusListingId: body.dealiusListingId ?? null,
      docusignEnvelopeId: body.docusignEnvelopeId ?? null,
      matchStatus: "matched",
      reference,
      bodyPreview: body.bodyPreview ?? null,
    });
    const requestId = (result as any).insertId as number;

    const attachments: any[] = Array.isArray(body.attachments) ? body.attachments : [];
    const saved: Array<{ filename: string; fileKey: string; url: string }> = [];

    for (const a of attachments) {
      const filename = String(a?.filename ?? "").trim();
      const mimeType = String(a?.mimeType ?? "application/octet-stream").trim() || "application/octet-stream";
      const base64Data = String(a?.base64Data ?? "").trim();
      if (!filename || !base64Data) continue;

      const buffer = Buffer.from(base64Data, "base64");
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `broker-admin/${requestId}/${nanoid(10)}-${safeName}`;

      const { url } = await storagePut(fileKey, buffer, mimeType);
      await db.insert(uploads).values({
        fileKey,
        url,
        filename,
        mimeType,
        fileSize: buffer.length,
        category: "inbox",
        reference: `brokerAdminRequest:${requestId}`,
        uploaderName: from || null,
        uploaderOpenId: null,
      });

      saved.push({ filename, fileKey, url });
    }

    // Best-effort: store attachment names for quick scanning
    try {
      const summary = saved.map(s => s.filename).join("\n");
      await db
        .update(brokerAdminRequests)
        .set({ attachmentsSummary: summary || null, updatedAt: new Date() })
        .where(eq(brokerAdminRequests.id, requestId));
    } catch {
      // ignore
    }

    ok(res, { requestId, savedAttachments: saved });
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// ── POST /api/v1/docusign/completed ──
/**
 * Ingest a completed DocuSign (executed PDF) and attach it to Dealius deal+listing.
 * Intended to be called from Power Automate when a "Completed" DocuSign email arrives.
 *
 * Body:
 * {
 *   requestId?: number,             // link to an existing broker admin request if you have it
 *   docusignEnvelopeId?: string,
 *   dealiusDealId?: string|number,
 *   dealiusListingId?: string|number,
 *   filename: string,
 *   mimeType?: string,
 *   base64Pdf: string,
 *   documentType?: string           // optional Dealius DocumentType
 * }
 */
restApiRouter.post("/docusign/completed", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const filename = String(body.filename ?? "").trim();
    const base64Pdf = String(body.base64Pdf ?? "").trim();
    if (!filename) return err(res, 400, "filename is required");
    if (!base64Pdf) return err(res, 400, "base64Pdf is required");

    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");

    const requestId = Number(body.requestId ?? body.submissionId ?? 0) || null;
    const envelopeId = String(body.docusignEnvelopeId ?? "").trim() || null;

    const buffer = Buffer.from(base64Pdf, "base64");
    const mimeType = String(body.mimeType ?? "application/pdf").trim() || "application/pdf";

    // Store executed PDF in tool storage first (system of record)
    const key = `broker-docusign/executed/${nanoid(10)}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { url } = await storagePut(key, buffer, mimeType);

    await db.insert(uploads).values({
      fileKey: key,
      url,
      filename,
      mimeType,
      fileSize: buffer.length,
      category: "docusign-executed",
      reference: requestId ? `brokerAdminRequest:${requestId}` : envelopeId ? `envelope:${envelopeId}` : null,
      uploaderName: "DocuSign",
      uploaderOpenId: null,
    });

    // Attach to Dealius (deal + listing) when IDs are present
    const dealiusDealId = body.dealiusDealId != null ? String(body.dealiusDealId).trim() : "";
    const dealiusListingId = body.dealiusListingId != null ? String(body.dealiusListingId).trim() : "";

    const client = new DealiusClient();
    const token = await authenticateConfiguredDealius(client);

    const documentType = body.documentType != null ? String(body.documentType).trim() : null;
    const results: any = { stored: { fileKey: key, url }, attached: {} as any };

    if (dealiusDealId) {
      const r = await client.uploadDocument({
        token,
        entityType: "deal",
        entityId: dealiusDealId,
        filename,
        mimeType,
        buffer,
        documentType,
      });
      results.attached.deal = r;
      if (r.status < 200 || r.status >= 300) {
        // Keep going; listing attach might still succeed.
      }
    }

    if (dealiusListingId) {
      const r = await client.uploadDocument({
        token,
        entityType: "listing",
        entityId: dealiusListingId,
        filename,
        mimeType,
        buffer,
        documentType,
      });
      results.attached.listing = r;
    }

    ok(res, results);
  } catch (e: any) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
