import type { RequestHandler } from "express";
import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "../auth/platformSession";
import type { PlatformAuthUser, PlatformRole } from "../auth/platformAuthTypes";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";

export const requireAuth: RequestHandler = async (req, res, next) => {
  // Try platform session first (lbt_session cookie)
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    req.user = platformUser;
    next();
    return;
  }

  // Fall back to legacy JWT session (broker-directory login without an app_users record)
  try {
    const legacyUser = await sdk.authenticateRequest(req);
    const db = await getDb();
    const email = legacyUser.email ?? "";
    const appUser = db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
    req.user = {
      id: appUser?.id ?? String(legacyUser.id),
      email,
      username: appUser?.username ?? email,
      fullName: appUser?.fullName ?? legacyUser.name ?? "",
      role: (legacyUser.role === "admin" ? "admin" : "broker") as PlatformRole,
      office: appUser?.office ?? null,
    };
    next();
    return;
  } catch {
    // JWT auth also failed — fall through to 401
  }

  res.status(401).json({ error: "Not authenticated" });
};

export function requireRole(...allowedRoles: PlatformRole[]): RequestHandler {
  return (req, res, next) => {
    const user = req.user as PlatformAuthUser | undefined;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (user.role === "admin") {
      next();
      return;
    }
    if (allowedRoles.includes(user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}
