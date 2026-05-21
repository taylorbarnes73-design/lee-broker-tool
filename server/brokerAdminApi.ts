import { Router } from "express";
import { z } from "zod/v4";
import { normalizeStoredFileUrl } from "./storage";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { brokerAdminRequests, uploads } from "../drizzle/schema";
import { requireAuth, requireRole } from "./middleware/requireAuth";

export const brokerAdminApiRouter = Router();

brokerAdminApiRouter.use(requireAuth, requireRole("admin"));

brokerAdminApiRouter.get("/requests", async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const status = String(req.query.status ?? "").trim();
  const owner = String(req.query.owner ?? "").trim();
  const q = String(req.query.q ?? "").trim().toLowerCase();

  let rows = await db
    .select({
      id: brokerAdminRequests.id,
      title: brokerAdminRequests.title,
      status: brokerAdminRequests.status,
      owner: brokerAdminRequests.owner,
      category: brokerAdminRequests.category,
      confidential: brokerAdminRequests.confidential,
      fromEmail: brokerAdminRequests.fromEmail,
      receivedAt: brokerAdminRequests.receivedAt,
      reference: brokerAdminRequests.reference,
      createdAt: brokerAdminRequests.createdAt,
      updatedAt: brokerAdminRequests.updatedAt,
      attachmentsSummary: brokerAdminRequests.attachmentsSummary,
    })
    .from(brokerAdminRequests)
    .orderBy(desc(brokerAdminRequests.id))
    .limit(limit);

  if (status) rows = rows.filter(r => r.status === status);
  if (owner) rows = rows.filter(r => (r.owner ?? "") === owner);
  if (q) {
    rows = rows.filter(r => {
      const hay = `${r.title ?? ""} ${r.fromEmail ?? ""} ${r.reference ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  res.json({
    success: true,
    data: rows,
  });
});

brokerAdminApiRouter.get("/stats", async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

  const staleDays = Math.max(0, parseInt(String(req.query.staleDays ?? "3"), 10) || 3);
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const staleBefore = new Date(Date.now() - staleMs);

  const recent = await db
    .select({
      id: brokerAdminRequests.id,
      status: brokerAdminRequests.status,
      owner: brokerAdminRequests.owner,
      createdAt: brokerAdminRequests.createdAt,
      updatedAt: brokerAdminRequests.updatedAt,
      title: brokerAdminRequests.title,
    })
    .from(brokerAdminRequests)
    .orderBy(desc(brokerAdminRequests.id))
    .limit(500);

  const countsByStatus = new Map<string, number>();
  for (const row of recent) {
    countsByStatus.set(row.status, (countsByStatus.get(row.status) ?? 0) + 1);
  }
  const counts = [...countsByStatus.entries()].map(([status, count]) => ({ status, count }));
  const stale = recent
    .filter(row => row.updatedAt && new Date(row.updatedAt).getTime() < staleBefore.getTime())
    .slice(0, 50);

  res.json({
    success: true,
    data: {
      counts,
      staleDays,
      staleCount: stale.length,
      stale,
    },
  });
});

brokerAdminApiRouter.get("/requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

  const rows = await db.select().from(brokerAdminRequests).where(eq(brokerAdminRequests.id, id)).limit(1);
  const row = rows[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });

  const files = await db
    .select()
    .from(uploads)
    .where(eq(uploads.reference, `brokerAdminRequest:${id}`))
    .orderBy(desc(uploads.createdAt))
    .limit(500);

  res.json({
    success: true,
    data: {
      request: row,
      attachments: files.map(file => ({
        ...file,
        url: normalizeStoredFileUrl(file.url, file.fileKey),
      })),
    },
  });
});

const updateSchema = z.object({
  title: z.string().trim().max(512).optional(),
  status: z.string().trim().max(32).optional(),
  owner: z.string().trim().max(64).optional().nullable(),
  category: z.string().trim().max(64).optional().nullable(),
  confidential: z.boolean().optional(),
  systemImpact: z.array(z.string()).optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.string().trim().max(16).optional().nullable(),
  dealiusDealId: z.string().trim().max(64).optional().nullable(),
  dealiusListingId: z.string().trim().max(64).optional().nullable(),
  docusignEnvelopeId: z.string().trim().max(128).optional().nullable(),
  reference: z.string().trim().max(512).optional().nullable(),
  notes: z.string().trim().max(50_000).optional().nullable(),
});

brokerAdminApiRouter.put("/requests/:id", async (req, res) => {
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
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });

  const patch: Record<string, any> = {};
  const v = parsed.data;
  if (v.title !== undefined) patch.title = v.title;
  if (v.status !== undefined) patch.status = v.status;
  if (v.owner !== undefined) patch.owner = v.owner;
  if (v.category !== undefined) patch.category = v.category;
  if (v.confidential !== undefined) patch.confidential = v.confidential ? 1 : 0;
  if (v.systemImpact !== undefined) patch.systemImpact = JSON.stringify(v.systemImpact);
  if (v.dueDate !== undefined) patch.dueDate = v.dueDate ? new Date(v.dueDate) : null;
  if (v.priority !== undefined) patch.priority = v.priority;
  if (v.dealiusDealId !== undefined) patch.dealiusDealId = v.dealiusDealId;
  if (v.dealiusListingId !== undefined) patch.dealiusListingId = v.dealiusListingId;
  if (v.docusignEnvelopeId !== undefined) patch.docusignEnvelopeId = v.docusignEnvelopeId;
  if (v.reference !== undefined) patch.reference = v.reference;
  if (v.notes !== undefined) patch.notes = v.notes;

  await db.update(brokerAdminRequests).set({ ...patch, updatedAt: new Date() }).where(eq(brokerAdminRequests.id, id));
  res.json({ success: true });
});
