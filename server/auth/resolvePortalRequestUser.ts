import type { Request } from "express";
import type { PlatformRole } from "./platformAuthTypes";
import { resolvePlatformUserFromRequest } from "./platformSession";
import { localAuth, sdk } from "../_core/sdk";
import { isAdminByPolicy } from "./isAdminByPolicy";

export type PortalRequestUser = {
  openId: string;
  role: "admin" | "user";
  email?: string | null;
  name?: string | null;
  platformUserId?: string;
  platformRole?: PlatformRole;
};

/**
 * Resolves either the newer platform session or the legacy broker session into
 * the small user shape used by the submissions REST API.
 */
export async function resolvePortalRequestUser(req: Request): Promise<PortalRequestUser | null> {
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    const isAdmin =
      platformUser.role === "admin" || isAdminByPolicy(platformUser.email, platformUser.fullName, platformUser.username);
    return {
      openId: localAuth.toLocalOpenId(platformUser.email),
      role: isAdmin ? "admin" : "user",
      email: platformUser.email,
      name: platformUser.fullName,
      platformUserId: platformUser.id,
      platformRole: platformUser.role,
    };
  }

  try {
    const legacyUser = await sdk.authenticateRequest(req);
    const isAdmin =
      legacyUser.role === "admin" || isAdminByPolicy(legacyUser.email, legacyUser.name);
    return {
      openId: legacyUser.openId,
      role: isAdmin ? "admin" : "user",
      email: legacyUser.email ?? null,
      name: legacyUser.name ?? null,
    };
  } catch {
    return null;
  }
}
