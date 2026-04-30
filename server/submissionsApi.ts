import { Router } from "express";
import { z } from "zod/v4";
import { getDb } from "./db";
import { submissions } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { pushVoucherSubmissionToDealius } from "./services/dealiusPush";

const createSchema = z.object({
  formType: z.string().trim().min(1).max(32),
  reference: z.string().trim().max(512).optional(),
  payload: z.unknown().optional(),
});

const updateSchema = z.object({
  status: z.string().trim().max(32).optional(),
  reference: z.string().trim().max(512).optional(),
  payload: z.unknown().optional(),
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
  const baseQuery = db.select().from(submissions);
  const scopedQuery = isAdmin ? baseQuery : baseQuery.where(eq(submissions.submittedByOpenId, user.openId));
  const rows = await scopedQuery.orderBy(desc(submissions.createdAt)).limit(limit);

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

  const payload = parsed.data.payload ?? {};
  const [result] = await db.insert(submissions).values({
    formType: parsed.data.formType,
    status: "pending",
    payload: JSON.stringify(payload),
    reference: parsed.data.reference ?? null,
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

    const result = await pushVoucherSubmissionToDealius({ payload });
    const nextPayload = {
      ...payload,
      dealiusPush: {
        pushedAt: new Date().toISOString(),
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

