import { Router } from "express";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { submissions, uploads } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { resolvePortalRequestUser } from "./auth/resolvePortalRequestUser";
import { pushVoucherSubmissionToDealius, validateVoucherPayloadForDealiusPush } from "./services/dealiusPush";
import { pushDealEntryToDealius, pushListingEntryToDealius, validateListingEntryForDealiusPush } from "./services/dealiusEntry";
import { parseLeeVoucherExcelBuffer, submissionPayloadPatchFromParsedVoucher } from "./services/voucherExcel";
import { listingFormPatchFromParsed, parseListingFormPdfBuffer } from "./services/listingFormPdf";
import { DealiusClient } from "./services/dealiusClient";
import { authenticateConfiguredDealius } from "./services/dealiusAuth";
import { storageGetBytes, storagePut } from "./storage";

const ACTIVE_QUEUE_STATUSES = ["pending", "in_review"] as const;
type ActiveQueueStatus = (typeof ACTIVE_QUEUE_STATUSES)[number];

function isActiveQueueStatus(status: string): status is ActiveQueueStatus {
  return (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(status);
}

type SubmissionAttachment = {
  title: string;
  filename: string;
  url: string | null;
  fileKey: string | null;
  category: string | null;
  mimeType: string | null;
  fileSize: number | null;
  downloadUrl: string;
};

function parseSubmissionPayload(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readSubmissionFile(entry: unknown): {
  filename: string;
  url: string | null;
  fileKey: string | null;
  category: string | null;
  mimeType: string | null;
  fileSize: number | null;
} | null {
  if (!entry || typeof entry !== "object") return null;
  const file = entry as Record<string, unknown>;
  const filename = typeof file.filename === "string" ? file.filename.trim() : "";
  const url = typeof file.url === "string" && file.url.trim() ? file.url.trim() : null;
  const fileKey = typeof file.fileKey === "string" && file.fileKey.trim() ? file.fileKey.trim() : null;
  const category = typeof file.category === "string" && file.category.trim() ? file.category.trim() : null;
  const mimeType = typeof file.mimeType === "string" && file.mimeType.trim() ? file.mimeType.trim() : null;
  const fileSizeRaw = typeof file.fileSize === "number" ? file.fileSize : Number(file.fileSize);
  const fileSize = Number.isFinite(fileSizeRaw) && fileSizeRaw > 0 ? fileSizeRaw : null;

  if (!filename || (!url && !fileKey)) return null;

  return {
    filename,
    url,
    fileKey,
    category,
    mimeType,
    fileSize,
  };
}

function buildSubmissionAttachments(params: {
  id: number;
  formType: string;
  pdfFileKey: string | null;
  pdfUrl: string | null;
  payload: Record<string, unknown>;
}): SubmissionAttachment[] {
  const docs: Array<Omit<SubmissionAttachment, "downloadUrl">> = [];
  const seen = new Set<string>();

  const pushDoc = (
    title: string,
    fileEntry: unknown,
    fallbackCategory: string | null = null,
    fallbackFilename?: string
  ) => {
    const file = readSubmissionFile(fileEntry);
    if (!file) return;
    const dedupeKey = file.fileKey || file.url;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    docs.push({
      title,
      filename: file.filename || fallbackFilename || "attachment",
      url: file.url,
      fileKey: file.fileKey,
      category: file.category || fallbackCategory,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    });
  };

  const payloadArchivedFile =
    params.payload.archivedFile && typeof params.payload.archivedFile === "object"
      ? params.payload.archivedFile
      : null;
  const fallbackArchivedFile =
    !payloadArchivedFile && (params.pdfFileKey || params.pdfUrl)
      ? {
          fileKey: params.pdfFileKey,
          url: params.pdfUrl,
          filename: `${params.formType || "submission"}-${params.id}.pdf`,
          mimeType: "application/pdf",
          category: "submission_pdf",
        }
      : null;

  pushDoc("Generated submission PDF", payloadArchivedFile || fallbackArchivedFile, "submission_pdf");
  pushDoc("Generated Excel Voucher", params.payload.excelFile, "voucher_excel", `voucher-${params.id}.xlsm`);

  const supportingFiles = Array.isArray(params.payload.supportingFiles) ? params.payload.supportingFiles : [];
  supportingFiles.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const file = entry as Record<string, unknown>;
    const label =
      typeof file.label === "string" && file.label.trim() ? file.label.trim() : `Supporting document ${index + 1}`;
    pushDoc(label, file, typeof file.category === "string" ? file.category : null);
  });

  return docs.map((doc, index) => ({
    ...doc,
    downloadUrl: `/api/submissions/${params.id}/attachments/${index}/download`,
  }));
}

function mimeTypeFromFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".xlsm")) return "application/vnd.ms-excel.sheet.macroEnabled.12";
  if (normalized.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (normalized.endsWith(".xls")) return "application/vnd.ms-excel";
  if (normalized.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (normalized.endsWith(".doc")) return "application/msword";
  if (normalized.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function downloadFileName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
}

// Support the "title/body" shape (preferred), and keep backward compatibility
// for older portal clients that still send { formType, reference, payload }.
const createSchema = z
  .union([
    z.object({
      title: z.string().trim().min(1).max(256),
      body: z.string().trim().min(1).max(20_000),
    }),
    z.object({
      formType: z.string().trim().min(1).max(32),
      reference: z.string().trim().max(512).optional(),
      payload: z.unknown().optional(),
    }),
  ])
  .transform(value => {
    if ("title" in value) {
      return {
        formType: "item",
        reference: value.title,
        payload: { body: value.body },
      };
    }
    return value;
  });

const updateSchema = z.object({
  status: z.string().trim().max(32).optional(),
  reference: z.string().trim().max(512).optional(),
  payload: z.unknown().optional(),
});

const importVoucherExcelBody = z.object({
  base64Data: z.string().min(1),
  filename: z.string().trim().min(1).max(255),
});

const importListingPdfBody = z.object({
  base64Data: z.string().min(1),
  filename: z.string().trim().min(1).max(255),
});

const pushDealiusBody = z.object({
  entryMode: z.enum(["deal", "listing"]).optional(),
  entry: z.record(z.string(), z.unknown()).optional(),
  overrides: z
    .object({
      feePercent: z.union([z.number(), z.string(), z.null()]).optional(),
    })
    .optional(),
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

export const submissionsApiRouter = Router();

submissionsApiRouter.use(async (req, res, next) => {
  try {
    const user = await resolvePortalRequestUser(req);
    if (!user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Not authenticated" });
  }
});

submissionsApiRouter.get("/", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const isAdmin = user.role === "admin";
  const includeQueue =
    String(req.query.includeQueue ?? "").trim().toLowerCase() === "1" ||
    String(req.query.includeQueue ?? "").trim().toLowerCase() === "true";

  const statusFilter = String(req.query.status ?? "").trim();
  const formTypeFilter = String(req.query.formType ?? "").trim();
  const submittedByOpenIdFilter = String(req.query.submittedByOpenId ?? "").trim();
  const submittedByEmailFilter = String(req.query.submittedByEmail ?? "").trim();

  const whereClauses: any[] = [];
  if (!isAdmin) {
    whereClauses.push(sql`${submissions.submittedByOpenId} = ${user.openId}`);
    if (statusFilter) whereClauses.push(sql`${submissions.status} = ${statusFilter}`);
    if (formTypeFilter) whereClauses.push(sql`${submissions.formType} = ${formTypeFilter}`);
  } else {
    if (statusFilter) whereClauses.push(sql`${submissions.status} = ${statusFilter}`);
    if (formTypeFilter) whereClauses.push(sql`${submissions.formType} = ${formTypeFilter}`);
    if (submittedByOpenIdFilter) whereClauses.push(sql`${submissions.submittedByOpenId} = ${submittedByOpenIdFilter}`);
    if (submittedByEmailFilter) whereClauses.push(sql`${submissions.submittedByEmail} = ${submittedByEmailFilter}`);
  }

  const whereSql = whereClauses.length ? sql`where ${sql.join(whereClauses, sql` and `)}` : sql``;

  const baseSql = includeQueue
    ? sql`
        with queue as (
          select
            id,
            row_number() over (order by createdAt asc, id asc) as queuePosition
          from submissions
          where status in (${sql.join(ACTIVE_QUEUE_STATUSES.map(s => sql`${s}`), sql`, `)})
        )
        select s.*, q.queuePosition as queuePosition
        from submissions s
        left join queue q on q.id = s.id
        ${whereSql}
        order by s.createdAt desc
        limit ${limit}
      `
    : sql`
        select s.*
        from submissions s
        ${whereSql}
        order by s.createdAt desc
        limit ${limit}
      `;

  const result = await db.execute(baseSql);
  const rows = (result as any)?.rows ?? result;

  res.json({
    success: true,
    data: rows.map(r => ({
      id: r.id,
      formType: r.formType,
      status: r.status,
      reference: r.reference,
      submittedBy: r.submittedBy,
      submittedByEmail: r.submittedByEmail,
      submittedByOpenId: r.submittedByOpenId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      queuePosition: includeQueue ? (r as any).queuePosition ?? null : null,
      source: (r as any).source ?? "tool",
      sourceEmailWebLink: (r as any).source_email_web_link ?? (r as any).sourceEmailWebLink ?? null,
      // Assignment fields — only surfaced to admins so broker-facing views don't leak who's working on what
      ...(isAdmin
        ? {
            assignedTo: (r as any).assignedTo ?? null,
            assignedAt: (r as any).assignedAt ?? null,
            completedBy: (r as any).completedBy ?? null,
            completedAt: (r as any).completedAt ?? null,
          }
        : {}),
    })),
  });
});

submissionsApiRouter.post("/", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string; email?: string | null; name?: string | null };
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const payload = (parsed.data as any).payload ?? {};
  const [result] = await db.insert(submissions).values({
    formType: (parsed.data as any).formType,
    status: "pending",
    payload: JSON.stringify(payload),
    reference: (parsed.data as any).reference ?? null,
    submittedBy: user.name ?? user.email ?? user.openId,
    submittedByOpenId: user.openId,
    submittedByEmail: user.email ?? null,
  });

  res.status(201).json({
    success: true,
    data: { id: (result as any).insertId ?? null },
  });
});

submissionsApiRouter.get("/:id", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const payload = parseSubmissionPayload(row.payload);
  const attachments = buildSubmissionAttachments({
    id: row.id,
    formType: row.formType,
    pdfFileKey: row.pdfFileKey ?? null,
    pdfUrl: row.pdfUrl ?? null,
    payload,
  });

  res.json({
    success: true,
    data: {
      id: row.id,
      formType: row.formType,
      status: row.status,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedByEmail: row.submittedByEmail,
      submittedByOpenId: row.submittedByOpenId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      source: (row as any).source ?? "tool",
      sourceEmailMessageId: (row as any).sourceEmailMessageId ?? null,
      sourceEmailWebLink: (row as any).sourceEmailWebLink ?? null,
      parsedFields: (row as any).parsedFields ?? null,
      // Assignment / completion tracking — only surfaced to admins
      ...(isAdmin
        ? {
            assignedTo: (row as any).assignedTo ?? null,
            assignedToOpenId: (row as any).assignedToOpenId ?? null,
            assignedAt: (row as any).assignedAt ?? null,
            completedBy: (row as any).completedBy ?? null,
            completedAt: (row as any).completedAt ?? null,
          }
        : {}),
      payload,
      attachments,
    },
  });
});

submissionsApiRouter.get("/:id/attachments/:index/download", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  const id = Number(req.params.id);
  const index = Number(req.params.index);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  if (!Number.isInteger(index) || index < 0) {
    res.status(400).json({ success: false, error: "Invalid attachment index" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const attachments = buildSubmissionAttachments({
    id: row.id,
    formType: row.formType,
    pdfFileKey: row.pdfFileKey ?? null,
    pdfUrl: row.pdfUrl ?? null,
    payload: parseSubmissionPayload(row.payload),
  });
  const attachment = attachments[index];

  if (!attachment) {
    res.status(404).json({ success: false, error: "Attachment not found" });
    return;
  }

  const storageKey = attachment.fileKey || attachment.url;
  if (!storageKey) {
    res.status(404).json({ success: false, error: "Attachment storage key missing" });
    return;
  }

  try {
    const { bytes } = await storageGetBytes(storageKey);
    res.setHeader("Content-Type", attachment.mimeType || mimeTypeFromFilename(attachment.filename));
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `attachment; filename=\"${downloadFileName(attachment.filename)}\"`);
    res.status(200).send(bytes);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || "Failed to download attachment" });
  }
});

submissionsApiRouter.get("/:id/queue", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const [{ count: totalActiveRaw }] = await db.execute(
    sql`select count(*) as count from submissions where status in (${sql.join(ACTIVE_QUEUE_STATUSES.map(s => sql`${s}`), sql`, `)})`
  ) as any;
  const totalActive = Number(totalActiveRaw ?? 0) || 0;

  if (!isActiveQueueStatus(row.status)) {
    res.json({
      success: true,
      data: { position: null, totalActive, aheadOfYou: null },
    });
    return;
  }

  const queueRows = await db.execute(
    sql`
      with queue as (
        select
          id,
          row_number() over (order by createdAt asc, id asc) as position,
          count(*) over () as totalActive
        from submissions
        where status in (${sql.join(ACTIVE_QUEUE_STATUSES.map(s => sql`${s}`), sql`, `)})
      )
      select position, totalActive
      from queue
      where id = ${id}
      limit 1
    `
  ) as any[];

  const q = queueRows[0] as any;
  const position = q?.position ? Number(q.position) : null;
  const totalFromWindow = q?.totalActive ? Number(q.totalActive) : totalActive;

  res.json({
    success: true,
    data: {
      position,
      totalActive: totalFromWindow,
      aheadOfYou: position ? position - 1 : null,
    },
  });
});

submissionsApiRouter.post("/:id/push-dealius", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  let payload: any = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }

  try {
    const parsedBody = pushDealiusBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
      return;
    }

    const overrides = parsedBody.data.overrides;
    const feePercentOverrideRaw = overrides?.feePercent;
    const feePercentOverride =
      feePercentOverrideRaw === null || feePercentOverrideRaw === undefined || feePercentOverrideRaw === ""
        ? null
        : Number(feePercentOverrideRaw);

    const requestedMode =
      parsedBody.data.entryMode ??
      (row.formType === "listing" ? "listing" : row.formType === "voucher" ? "deal" : undefined);

    if (!requestedMode) {
      res.status(400).json({ success: false, error: `Dealius push not implemented for formType "${row.formType}" yet.` });
      return;
    }

    const bodyEntry = parsedBody.data.entry;
    const pushPayload =
      bodyEntry && typeof bodyEntry === "object"
        ? { ...bodyEntry }
        : feePercentOverride != null && Number.isFinite(feePercentOverride) && feePercentOverride > 0
          ? { ...payload, feePercent: feePercentOverride }
          : payload;

    if (requestedMode === "deal" && feePercentOverride != null && Number.isFinite(feePercentOverride) && feePercentOverride > 0) {
      (pushPayload as any).feePercent = feePercentOverride;
    }

    const validation =
      requestedMode === "listing"
        ? validateListingEntryForDealiusPush(pushPayload)
        : validateVoucherPayloadForDealiusPush(pushPayload);
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        error: validation.errors.join(" "),
        errors: validation.errors,
      });
      return;
    }

    const result =
      requestedMode === "listing"
        ? await pushListingEntryToDealius({ entry: pushPayload })
        : bodyEntry
          ? await pushDealEntryToDealius({ entry: pushPayload })
          : await pushVoucherSubmissionToDealius({ payload: pushPayload });

    const nextPayload = {
      ...payload,
      dealiusPush: {
        ...result,
        pushedAt: new Date().toISOString(),
        entryMode: requestedMode,
        submittedEntry: pushPayload,
        feePercentOverride: feePercentOverride ?? null,
      },
    };

    await db
      .update(submissions)
      .set({
        status: "approved",
        payload: JSON.stringify(nextPayload),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id));

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

submissionsApiRouter.post("/:id/dealius-documents", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string; name?: string | null };
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const parsedBody = dealiusDocumentBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  let payload: any = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }

  const client = new DealiusClient();
  let token: string;
  try {
    token = await authenticateConfiguredDealius(client);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
    return;
  }

  const { entityType, entityId, files } = parsedBody.data;
  const maxBytes = 100 * 1024 * 1024;
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

    const fileKey = `broker-docs/submissions/dealius/${id}/${nanoid(10)}-${safeFilename}`;
    const stored = await storagePut(fileKey, buffer, file.mimeType);
    await db.insert(uploads).values({
      fileKey,
      url: stored.url,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: buffer.length,
      category: "dealius-document",
      reference: `submission:${id}`,
      uploaderName: user.name ?? "Admin",
      uploaderOpenId: user.openId,
    });

    const uploaded = await client.uploadDocument({
      token,
      entityType,
      entityId,
      filename: file.filename,
      mimeType: file.mimeType,
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

  const previous = Array.isArray(payload.dealiusDocuments) ? payload.dealiusDocuments : [];
  const nextPayload = {
    ...payload,
    dealiusDocuments: [
      ...previous,
      ...results.map(r => ({
        uploadedAt: new Date().toISOString(),
        entityType,
        entityId,
        ...r,
      })),
    ],
  };

  await db
    .update(submissions)
    .set({ payload: JSON.stringify(nextPayload), updatedAt: new Date() })
    .where(eq(submissions.id, id));

  const failed = results.filter(r => !r.success);
  res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    data: { entityType, entityId, results },
    error: failed.length ? `${failed.length} document(s) failed to attach to Dealius.` : undefined,
  });
});

/** Admin: merge Lee voucher Excel (.xlsx / .xlsm) into submission payload (same grid as legacy tool). */
submissionsApiRouter.post("/:id/import-voucher-excel", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const parsedBody = importVoucherExcelBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const fn = parsedBody.data.filename.toLowerCase();
  if (!fn.endsWith(".xlsx") && !fn.endsWith(".xlsm") && !fn.endsWith(".xls")) {
    res.status(400).json({ success: false, error: "filename must end in .xlsx, .xlsm, or .xls" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  if (row.formType !== "voucher") {
    res.status(400).json({ success: false, error: "Excel import is only supported for voucher submissions." });
    return;
  }

  let payload: any = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsedBody.data.base64Data, "base64");
  } catch {
    res.status(400).json({ success: false, error: "Invalid base64 data" });
    return;
  }
  if (!buffer.length) {
    res.status(400).json({ success: false, error: "Empty file" });
    return;
  }
  const maxBytes = 100 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).json({ success: false, error: "File too large (max 100MB)" });
    return;
  }

  try {
    const parsed = parseLeeVoucherExcelBuffer(buffer);
    const patch = submissionPayloadPatchFromParsedVoucher(parsed);
    const prevImport = (patch.excelImport && typeof patch.excelImport === "object" ? patch.excelImport : {}) as Record<
      string,
      unknown
    >;
    patch.excelImport = { ...prevImport, filename: parsedBody.data.filename };

    const nextPayload = { ...payload, ...patch };

    await db
      .update(submissions)
      .set({
        payload: JSON.stringify(nextPayload),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id));

    res.json({
      success: true,
      data: {
        dealName: parsed.dealName,
        address: parsed.address,
        city: parsed.city,
        zip: parsed.zip,
        transactionType: parsed.transactionType,
        representationType: parsed.representationType,
        feePercent: patch.feePercent ?? null,
        rentRowCount: Array.isArray(parsed.rentRows) ? parsed.rentRows.length : 0,
        brokerCount: Array.isArray(parsed.brokers) ? parsed.brokers.length : 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

submissionsApiRouter.post("/:id/import-listing-pdf", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const parsedBody = importListingPdfBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }

  const filename = parsedBody.data.filename.toLowerCase();
  if (!filename.endsWith(".pdf")) {
    res.status(400).json({ success: false, error: "filename must end in .pdf" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  if (row.formType !== "listing") {
    res.status(400).json({ success: false, error: "Listing PDF import is only supported for listing submissions." });
    return;
  }

  let payload: any = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsedBody.data.base64Data, "base64");
  } catch {
    res.status(400).json({ success: false, error: "Invalid base64 data" });
    return;
  }
  if (!buffer.length) {
    res.status(400).json({ success: false, error: "Empty file" });
    return;
  }
  const maxBytes = 100 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).json({ success: false, error: "File too large (max 100MB)" });
    return;
  }

  try {
    const parsed = await parseListingFormPdfBuffer(buffer);
    if (!parsed.address && !parsed.city && parsed.spaces.length === 0) {
      throw new Error("No filled listing input form fields were found in this PDF.");
    }
    const patch = listingFormPatchFromParsed(parsed);
    const prevImport = (patch.listingFormImport && typeof patch.listingFormImport === "object" ? patch.listingFormImport : {}) as Record<
      string,
      unknown
    >;
    patch.listingFormImport = { ...prevImport, filename: parsedBody.data.filename };

    const nextPayload = { ...payload, ...patch };

    await db
      .update(submissions)
      .set({
        payload: JSON.stringify(nextPayload),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id));

    res.json({
      success: true,
      data: {
        listingName: parsed.listingName,
        address: parsed.address,
        city: parsed.city,
        zip: parsed.zip,
        propertyType: parsed.propertyType,
        transactionType: parsed.transactionType,
        spaceCount: parsed.spaces.length,
        totalBldgSF: parsed.totalBldgSF,
        sqft: parsed.sqft,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

submissionsApiRouter.put("/:id", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string; name?: string | null; email?: string | null };
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const nextStatus = parsed.data.status;
  if (nextStatus !== undefined && !isAdmin) {
    res.status(403).json({ success: false, error: "Only admins can change status" });
    return;
  }

  // Compute assignment side-effects for admin status transitions.
  // "Claim" (→ in_review): record who picked it up and when.
  // "Complete" (→ approved | closed): record who finished it and when.
  const now = new Date();
  const adminName = user.name || user.openId;
  const assignmentPatch: Record<string, unknown> = {};
  if (isAdmin && nextStatus !== undefined && nextStatus !== row.status) {
    if (nextStatus === "in_review") {
      // Always update assignedTo so re-assignment works
      assignmentPatch.assignedTo = adminName;
      assignmentPatch.assignedToOpenId = user.openId;
      assignmentPatch.assignedAt = now;
    } else if (nextStatus === "approved" || nextStatus === "closed") {
      assignmentPatch.completedBy = adminName;
      assignmentPatch.completedAt = now;
    }
  }

  await db
    .update(submissions)
    .set({
      status: nextStatus ?? row.status,
      reference: parsed.data.reference ?? row.reference,
      payload:
        parsed.data.payload !== undefined ? JSON.stringify(parsed.data.payload) : row.payload,
      updatedAt: now,
      ...(assignmentPatch as any),
    })
    .where(eq(submissions.id, id));

  res.json({ success: true });
});

submissionsApiRouter.delete("/:id", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  const rows = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  await db.delete(submissions).where(eq(submissions.id, id));
  res.json({ success: true });
});
