import { findBrokerDirectoryEntry, isBrokerDirectoryAdmin } from "@shared/brokerDirectory";
import { ENV } from "../_core/env";

/**
 * Returns true if the email/name combination should be treated as admin
 * under any of the configured admin policies:
 *   1. LOCAL_ADMIN_EMAILS env var
 *   2. LOCAL_ADMIN_NAMES env var
 *   3. Broker directory "Office Admin" role
 */
export function isAdminByPolicy(
  email: string | null | undefined,
  name: string | null | undefined
): boolean {
  const emailLower = (email ?? "").trim().toLowerCase();
  const nameLower = (name ?? "").trim().toLowerCase();

  if (emailLower && ENV.localAdminEmails.includes(emailLower)) return true;
  if (nameLower && ENV.localAdminNames.includes(nameLower)) return true;
  if (emailLower) {
    const entry = findBrokerDirectoryEntry(emailLower);
    if (isBrokerDirectoryAdmin(entry)) return true;
  }

  return false;
}

export function getTrustedAdminPolicyName(
  email: string | null | undefined,
  storedName: string | null | undefined
): string | undefined {
  const normalizedStoredName = (storedName ?? "").trim();
  if (normalizedStoredName) return normalizedStoredName;

  const emailLower = (email ?? "").trim().toLowerCase();
  if (!emailLower) return undefined;

  return findBrokerDirectoryEntry(emailLower)?.name;
}
