import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request } from "express";
import { and, eq, gt, or } from "drizzle-orm";
import { appSessions, appUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { parse as parseCookieHeader } from "cookie";
import type { PlatformAuthUser, PlatformRole } from "./platformAuthTypes";
import { LBT_SESSION_COOKIE, LBT_SESSION_MAX_AGE_MS } from "./constants";
import { getRequestIp } from "./requestIp";

type AppDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function readLbtCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parsed = parseCookieHeader(raw);
  const v = parsed[LBT_SESSION_COOKIE];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function findAppUserByUsernameOrEmail(
  db: AppDb,
  usernameOrEmail: string
): Promise<(typeof appUsers.$inferSelect) | undefined> {
  const key = usernameOrEmail.trim().toLowerCase();
  if (!key) return undefined;

  const rows = await db
    .select()
    .from(appUsers)
    .where(or(eq(appUsers.email, key), eq(appUsers.username, key)))
    .limit(1);

  return rows[0];
}

export function toPlatformAuthUser(row: typeof appUsers.$inferSelect): PlatformAuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.fullName,
    role: row.role as PlatformRole,
    office: row.office ?? null,
  };
}

/**
 * Validates `lbt_session` cookie against `sessions` + `app_users`.
 */
export async function resolvePlatformUserFromRequest(req: Request): Promise<PlatformAuthUser | null> {
  const token = readLbtCookie(req);
  if (!token) return null;

  const db = await getDb();
  if (!db) return null;

  const tokenHash = hashSessionToken(token);
  const now = new Date();

  let rows: Array<{ user: typeof appUsers.$inferSelect }>;
  try {
    rows = await db
      .select({ user: appUsers })
      .from(appSessions)
      .innerJoin(appUsers, eq(appUsers.id, appSessions.userId))
      .where(and(eq(appSessions.tokenHash, tokenHash), gt(appSessions.expiresAt, now)))
      .limit(1);
  } catch (error) {
    console.error("[auth.session] Could not resolve platform session:", error);
    return null;
  }

  const user = rows[0]?.user;
  if (!user) return null;
  if (!user.isActive) return null;

  return toPlatformAuthUser(user);
}

export async function createPlatformSession(
  db: AppDb,
  userId: string,
  req: Request
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + LBT_SESSION_MAX_AGE_MS);

  const rip = getRequestIp(req);
  const ip = rip === "unknown" ? null : rip;

  const userAgent =
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : null;

  await db.insert(appSessions).values({
    id: sessionId,
    userId,
    tokenHash,
    expiresAt,
    ipAddress: ip,
    userAgent,
  });

  return { rawToken, expiresAt };
}

export async function destroyPlatformSessionByCookie(req: Request): Promise<string | null> {
  const token = readLbtCookie(req);
  if (!token) return null;

  const db = await getDb();
  if (!db) return null;

  const tokenHash = hashSessionToken(token);
  const rows = await db.select({ userId: appSessions.userId }).from(appSessions).where(eq(appSessions.tokenHash, tokenHash)).limit(1);
  const userId = rows[0]?.userId ?? null;

  await db.delete(appSessions).where(eq(appSessions.tokenHash, tokenHash));
  return userId;
}
