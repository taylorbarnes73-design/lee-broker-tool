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
import { uploads, submissions } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";

export const restApiRouter = Router();

// ─── Utility ────────────────────────────────────────────────────────────────

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

  next();
});

// ─── POST /api/v1/submit/listing ─────────────────────────────────────────────
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

// ─── POST /api/v1/submit/voucher ─────────────────────────────────────────────
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

// ─── POST /api/v1/submit/sign-request ────────────────────────────────────────
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

// ─── POST /api/v1/submit/comp ─────────────────────────────────────────────────
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

// ─── GET /api/v1/submissions ──────────────────────────────────────────────────
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

// ─── GET /api/v1/submissions/:id ─────────────────────────────────────────────
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

// ─── GET /api/v1/files ────────────────────────────────────────────────────────
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

// ─── GET /api/v1/files/url ────────────────────────────────────────────────────
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
