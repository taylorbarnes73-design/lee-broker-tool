import type { RequestHandler } from "express";
import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "../auth/platformSession";
import { sendAdminError } from "./adminErrors";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import type { PlatformAuthUser } from "../auth/platformAuthTypes";

function isEnvAdmin(email: string | null | undefined, fullName: string | null | undefined): boolean {
  const emailLower = (email ?? "").trim().toLowerCase();
  const nameLower = (fullName ?? "").trim().toLowerCase();
  return (
    (emailLower.length > 0 && ENV.localAdminEmails.includes(emailLower)) ||
    (nameLower.length > 0 && ENV.localAdminNames.includes(nameLower))
  );
}

/** Admin REST API: 401/403 use `{ error: { code, message } }` shape. */
export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  let isAuthenticated = false;

  // 1. Try platform session (lbt_session cookie)
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    isAuthenticated = true;
    // Accept if app_users.role is admin OR email/name is in the ENV admin override list.
    if (platformUser.role === "admin" || isEnvAdmin(platformUser.email, platformUser.fullName)) {
      req.user = { ...platformUser, role: "admin" };
      next();
      return;
    }
  }

  // 2. Try legacy JWT session (app_session_id cookie) — covers admins without an
  //    app_users record and the 12-hour lbt_session expiry window.
  try {
    const legacyUser = await sdk.authenticateRequest(req);
    isAuthenticated = true;
    if (legacyUser.role === "admin" || isEnvAdmin(legacyUser.email, legacyUser.name)) {
      const db = await getDb();
      const email = legacyUser.email ?? "";
      const appUser = db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
      req.user = {
        id: appUser?.id ?? String(legacyUser.id),
        email,
        username: appUser?.username ?? email,
        fullName: appUser?.fullName ?? legacyUser.name ?? "",
        role: "admin" as PlatformAuthUser["role"],
        office: appUser?.office ?? null,
      };
      next();
      return;
    }
  } catch {
    // JWT auth failed or cookie not present
  }

  if (isAuthenticated) {
    sendAdminError(res, 403, "FORBIDDEN", "Administrator access is required for this resource.");
  } else {
    sendAdminError(res, 401, "UNAUTHORIZED", "Authentication required.");
  }
};
