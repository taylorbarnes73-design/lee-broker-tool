import { Router } from "express";
import { z } from "zod/v4";
import { getDb } from "./db";
import { submissions } from "../drizzle/schema";
import { desc, eq, sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { pushVoucherSubmissionToDealius, validateVoucherPayloadForDealiusPush } from "./services/dealiusPush";
import { parseLeeVoucherExcelBuffer, submissionPayloadPatchFromParsedVoucher } from "./services/voucherExcel";

const ACTIVE_QUEUE_STATUSES = ["pending", "in_review"] as const;
type ActiveQueueStatus = (typeof ACTIVE_QUEUE_STATUSES)[number];

function isActiveQueueStatus(status: string): status is ActiveQueueStatus {
  return (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(status);
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

export const submissionsApiRouter = Router();

submissionsApiRouter.use(async (req, res, next) => {
  try {
    (req as any).user = await sdk.authenticateRequest(req);
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
  const submittedByOpenIdFilter = String(req.query.submittedByOpenId ?? "").trim();
  const submittedByEmailFilter = String(req.query.submittedByEmail ?? "").trim();

  const whereClauses: any[] = [];
  if (!isAdmin) {
    whereClauses.push(sql`${submissions.submittedByOpenId} = ${user.openId}`);
  } else {
    if (statusFilter) whereClauses.push(sql`${submissions.status} = ${statusFilter}`);
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
      payload: (() => {
        try {
          return JSON.parse(row.payload ?? "{}");
        } catch {
          return {};
        }
      })(),
    },
  });
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
    if (row.formType !== "voucher") {
      res.status(400).json({ success: false, error: `Dealius push not implemented for formType "${row.formType}" yet.` });
      return;
    }

    const overrides = (req.body && typeof req.body === "object" ? (req.body as any).overrides : null) as any;
    const feePercentOverrideRaw = overrides?.feePercent;
    const feePercentOverride =
      feePercentOverrideRaw === null || feePercentOverrideRaw === undefined || feePercentOverrideRaw === ""
        ? null
        : Number(feePercentOverrideRaw);

    const pushPayload =
      feePercentOverride != null && Number.isFinite(feePercentOverride) && feePercentOverride > 0
        ? { ...payload, feePercent: feePercentOverride }
        : payload;

    const validation = validateVoucherPayloadForDealiusPush(pushPayload);
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        error: validation.errors.join(" "),
        errors: validation.errors,
      });
      return;
    }

    const result = await pushVoucherSubmissionToDealius({ payload: pushPayload });
    const nextPayload = {
      ...payload,
      dealiusPush: {
        pushedAt: new Date().toISOString(),
        feePercentOverride: feePercentOverride ?? null,
        ...result,
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
  const maxBytes = 25 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).json({ success: false, error: "File too large (max 25MB)" });
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

submissionsApiRouter.put("/:id", async (req, res) => {
  const user = (req as any).user as { openId: string; role: string };
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

  await db
    .update(submissions)
    .set({
      status: nextStatus ?? row.status,
      reference: parsed.data.reference ?? row.reference,
      payload:
        parsed.data.payload !== undefined ? JSON.stringify(parsed.data.payload) : row.payload,
      updatedAt: new Date(),
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

