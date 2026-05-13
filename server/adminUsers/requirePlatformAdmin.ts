import type { RequestHandler } from "express";
import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "../auth/platformSession";
import { sendAdminError } from "./adminErrors";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";

/** Admin REST API: 401/403 use `{ error: { code, message } }` shape. */
export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  // Try platform session first (lbt_session cookie)
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    if (platformUser.role !== "admin") {
      sendAdminError(res, 403, "FORBIDDEN", "Administrator access is required for this resource.");
      return;
    }
    req.user = platformUser;
    next();
    return;
  }

  // Fall back to legacy JWT session (broker-directory login without an app_users record)
  try {
    const legacyUser = await sdk.authenticateRequest(req);
    if (legacyUser.role !== "admin") {
      sendAdminError(res, 403, "FORBIDDEN", "Administrator access is required for this resource.");
      return;
    }
    const db = await getDb();
    const email = legacyUser.email ?? "";
    const appUser = db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
    req.user = {
      id: appUser?.id ?? String(legacyUser.id),
      email,
      username: appUser?.username ?? email,
      fullName: appUser?.fullName ?? legacyUser.name ?? "",
      role: "admin" as const,
      office: appUser?.office ?? null,
    };
    next();
    return;
  } catch {
    // JWT auth also failed — fall through to 401
  }

  sendAdminError(res, 401, "UNAUTHORIZED", "Authentication required.");
};
