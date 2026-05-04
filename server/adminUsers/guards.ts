import type { PlatformRole } from "../auth/platformAuthTypes";

export type AdminPatch = {
  role?: PlatformRole;
  is_active?: boolean;
};

/**
 * If the target is the only active admin, block demotion or deactivation.
 * `activeAdminCount` = count of users where role=admin AND is_active=true (including target).
 */
export function lastActiveAdminBlocked(
  target: { role: string; isActive: boolean },
  patch: AdminPatch,
  activeAdminCount: number
): string | null {
  if (target.role !== "admin" || !target.isActive) return null;
  const demoted = patch.role !== undefined && patch.role !== "admin";
  const deactivated = patch.is_active === false;
  if (!demoted && !deactivated) return null;
  if (activeAdminCount <= 1) {
    return "This change would remove the last active administrator. Assign another admin first.";
  }
  return null;
}

export function selfRoleOrDeactivationBlocked(
  actorId: string,
  targetId: string,
  patch: AdminPatch
): string | null {
  if (actorId !== targetId) return null;
  if (patch.role !== undefined && patch.role !== "admin") {
    return "You cannot change your own role.";
  }
  if (patch.is_active === false) {
    return "You cannot deactivate your own account.";
  }
  return null;
}

/** Soft-delete (is_active=false) uses the same rule as PATCH deactivation. */
export function selfDeactivationBlocked(actorId: string, targetId: string): string | null {
  if (actorId !== targetId) return null;
  return "You cannot deactivate your own account.";
}
