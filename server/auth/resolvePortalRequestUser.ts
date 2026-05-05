import type { Request } from "express";
import type { PlatformRole } from "./platformAuthTypes";
import { resolvePlatformUserFromRequest } from "./platformSession";
import { localAuth, sdk } from "../_core/sdk";

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
    return {
      openId: localAuth.toLocalOpenId(platformUser.email),
      role: platformUser.role === "admin" ? "admin" : "user",
      email: platformUser.email,
      name: platformUser.fullName,
      platformUserId: platformUser.id,
      platformRole: platformUser.role,
    };
  }

  try {
    const legacyUser = await sdk.authenticateRequest(req);
    return {
      openId: legacyUser.openId,
      role: legacyUser.role === "admin" ? "admin" : "user",
      email: legacyUser.email ?? null,
      name: legacyUser.name ?? null,
    };
  } catch {
    return null;
  }
}
