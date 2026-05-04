import type { Request } from "express";
import { auditLog } from "../../drizzle/schema";
import { getDb } from "../db";
import { getRequestIp } from "./requestIp";

/**
 * Append an audit row. Safe to call without awaiting in fire-and-forget paths,
 * but callers should await for login flows if ordering matters.
 */
export async function writeAuditLog(
  userId: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, unknown>,
  req: Request
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[audit] skipped (no database):", action);
    return;
  }

  const id = crypto.randomUUID();
  const ip = getRequestIp(req);

  try {
    await db.insert(auditLog).values({
      id,
      userId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: ip,
    });
  } catch (error) {
    console.error("[audit] insert failed:", action, error);
  }
}
