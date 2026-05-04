import { Router } from "express";
import { and, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { auditLog, appUsers } from "../drizzle/schema";
import { getDb } from "./db";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";

export const adminAuditLogRouter = Router();
adminAuditLogRouter.use(requirePlatformAdmin);

const PAGE_SIZE = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stripLikeWildcards(s: string): string {
  return s.replace(/[%_\\]/g, "").trim().slice(0, 200);
}

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

adminAuditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: { code: "DB_UNAVAILABLE", message: "Database unavailable." } });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const userQ = String(req.query.user ?? "").trim();
    const actionQ = String(req.query.action ?? "").trim();
    const targetQ = String(req.query.target ?? "").trim();
    const fromRaw = String(req.query.from ?? "").trim();
    const toRaw = String(req.query.to ?? "").trim();

    const parts: SQL[] = [];

    if (actionQ) {
      const s = stripLikeWildcards(actionQ);
      if (s.length) {
        parts.push(sql`lower(${auditLog.action}) like lower(${"%" + s.toLowerCase() + "%"})`);
      }
    }

    if (targetQ) {
      const s = stripLikeWildcards(targetQ);
      if (s.length) {
        const pat = "%" + s.toLowerCase() + "%";
        parts.push(
          or(
            sql`lower(${auditLog.targetType}) like lower(${pat})`,
            sql`lower(${auditLog.targetId}) like lower(${pat})`
          )!
        );
      }
    }

    if (fromRaw) {
      const d = new Date(fromRaw);
      if (!Number.isNaN(d.getTime())) {
        parts.push(gte(auditLog.createdAt, d));
      }
    }
    if (toRaw) {
      const d = new Date(toRaw);
      if (!Number.isNaN(d.getTime())) {
        const end = new Date(d);
        end.setUTCHours(23, 59, 59, 999);
        parts.push(lte(auditLog.createdAt, end));
      }
    }

    if (userQ) {
      const s = stripLikeWildcards(userQ);
      const idMatch = UUID_RE.test(userQ) ? eq(auditLog.userId, userQ) : undefined;
      if (s.length) {
        const pat = "%" + s.toLowerCase() + "%";
        const emailMatch = sql`lower(${appUsers.email}) like lower(${pat})`;
        const nameMatch = sql`lower(${appUsers.fullName}) like lower(${pat})`;
        parts.push(idMatch ? or(emailMatch, nameMatch, idMatch)! : or(emailMatch, nameMatch)!);
      } else if (idMatch) {
        parts.push(idMatch);
      }
    }

    const whereClause = parts.length ? and(...parts) : undefined;

    const countRows = await db
      .select({ c: sql<number>`count(*)` })
      .from(auditLog)
      .leftJoin(appUsers, eq(appUsers.id, auditLog.userId))
      .where(whereClause);

    const total = Number(countRows[0]?.c ?? 0);

    const rows = await db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        userEmail: appUsers.email,
        userFullName: appUsers.fullName,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        metadata: auditLog.metadata,
        ipAddress: auditLog.ipAddress,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(appUsers, eq(appUsers.id, auditLog.userId))
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    res.json({
      page,
      page_size: PAGE_SIZE,
      total,
      rows,
    });
  })
);
