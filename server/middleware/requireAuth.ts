import type { RequestHandler } from "express";
import {
  resolvePlatformUserFromRequest,
  findAppUserByUsernameOrEmail,
} from "../auth/platformSession";
import type { PlatformAuthUser, PlatformRole } from "../auth/platformAuthTypes";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { isAdminByPolicy } from "../auth/isAdminByPolicy";

export const requireAuth: RequestHandler = async (req, res, next) => {
  // 1. Try platform session (lbt_session cookie)
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    const role: PlatformRole =
      platformUser.role === "admin" ||
      isAdminByPolicy(
        platformUser.email,
        platformUser.fullName,
        platformUser.username
      )
        ? "admin"
        : platformUser.role;
    req.user = { ...platformUser, role };
    next();
    return;
  }

  // 2. Try legacy JWT session (app_session_id cookie)
  try {
    const legacyUser = await sdk.authenticateRequest(req);
    const email = legacyUser.email ?? "";
    let appUser: Awaited<
      ReturnType<typeof findAppUserByUsernameOrEmail>
    > | null = null;
    try {
      const db = await getDb();
      appUser =
        db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
    } catch (error) {
      console.error(
        "[requireAuth] Could not resolve platform user for legacy session:",
        error
      );
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (appUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const grantedRole: PlatformRole =
      legacyUser.role === "admin" ? "admin" : "broker";
    req.user = {
      id: appUser?.id ?? String(legacyUser.id),
      email,
      username: appUser?.username ?? email,
      fullName: appUser?.fullName ?? legacyUser.name ?? "",
      role: grantedRole,
      office: appUser?.office ?? null,
    };
    next();
    return;
  } catch {
    // JWT auth failed or cookie not present
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
