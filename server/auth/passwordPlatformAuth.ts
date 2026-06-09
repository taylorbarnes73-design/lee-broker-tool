import type { Request, Response } from "express";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { appUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { LBT_SESSION_COOKIE, LBT_SESSION_MAX_AGE_MS } from "./constants";
import { parseLeeLoginIdentifier } from "@shared/leeLogin";
import { isLoginRateLimited, recordLoginFailure } from "./loginRateLimiter";
import {
  createPlatformSession,
  findAppUserByUsernameOrEmail,
  destroyPlatformSessionByCookie,
} from "./platformSession";
import { writeAuditLog } from "./writeAuditLog";
import { getRequestIp } from "./requestIp";
import { isAdminByPolicy } from "./isAdminByPolicy";
import { ENV } from "../_core/env";

const passwordLoginBody = z.object({
  username_or_email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});

export function isPlatformPasswordLoginBody(body: unknown): body is z.infer<typeof passwordLoginBody> {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  return (
    typeof o.username_or_email === "string" &&
    o.username_or_email.trim().length > 0 &&
    typeof o.password === "string" &&
    o.password.length > 0
  );
}

export async function handlePlatformPasswordLogin(req: Request, res: Response): Promise<void> {
  try {
    await handlePlatformPasswordLoginUnsafe(req, res);
  } catch (error) {
    console.error("[auth.login] Platform password login failed:", error);
    if (!res.headersSent) {
      res.status(503).json({ error: "Sign-in service is temporarily unavailable." });
    }
  }
}

async function handlePlatformPasswordLoginUnsafe(req: Request, res: Response): Promise<void> {
  const ip = getRequestIp(req);
  if (isLoginRateLimited(ip)) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }

  const parsed = passwordLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { username_or_email, password } = parsed.data;
  const loginId = parseLeeLoginIdentifier(username_or_email, ENV.localAuthEmailDomain);
  if (!loginId.ok) {
    res.status(400).json({ error: loginId.error });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database unavailable." });
    return;
  }

  const user = await findAppUserByUsernameOrEmail(db, loginId.value.lookupKey);

  if (!user || !user.passwordHash) {
    recordLoginFailure(ip);
    await writeAuditLog(
      null,
      "login.failed",
      null,
      null,
      { reason: "invalid_credentials", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  if (!user.isActive) {
    await writeAuditLog(
      user.id,
      "login.failed",
      "user",
      user.id,
      { reason: "deactivated", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(403).json({ error: "This account has been deactivated. Contact your admin." });
    return;
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(ip);
    await writeAuditLog(
      user.id,
      "login.failed",
      "user",
      user.id,
      { reason: "invalid_credentials", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const resolvedRole =
    user.role === "admin" || isAdminByPolicy(user.email, user.fullName, user.username)
      ? "admin"
      : user.role;

  const { rawToken } = await createPlatformSession(db, user.id, req);

  await db
    .update(appUsers)
    .set({
      lastLoginAt: new Date(),
      ...(resolvedRole === "admin" && user.role !== "admin" ? { role: "admin" as const } : {}),
    })
    .where(eq(appUsers.id, user.id));

  await writeAuditLog(user.id, "login.success", "user", user.id, {}, req);

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LBT_SESSION_COOKIE, rawToken, { ...cookieOptions, maxAge: LBT_SESSION_MAX_AGE_MS });

  res.json({
    success: true,
    id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.fullName,
    role: resolvedRole,
    office: user.office ?? null,
  });
}

export async function handlePlatformLogout(req: Request, res: Response): Promise<void> {
  const userId = await destroyPlatformSessionByCookie(req);
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(LBT_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });

  await writeAuditLog(userId, "logout", null, null, {}, req);
}
