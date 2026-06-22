import { findBrokerDirectoryEntry, isBrokerDirectoryAdmin } from "@shared/brokerDirectory";
import { ENV } from "../_core/env";

const LEE_EMAIL_DOMAIN = "lee-associates.com";
const SIMPLE_USERNAME_RE = /^[a-z0-9._-]{2,64}$/;

function emailCandidates(...values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();

  for (const value of values) {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) continue;

    out.add(normalized);
    if (!normalized.includes("@") && SIMPLE_USERNAME_RE.test(normalized)) {
      out.add(`${normalized}@${LEE_EMAIL_DOMAIN}`);
    }
  }

  return [...out];
}

/**
 * Returns true if the email/name combination should be treated as admin
 * under any of the configured admin policies:
 *   1. LOCAL_ADMIN_EMAILS env var (email or Lee username)
 *   2. LOCAL_ADMIN_NAMES env var
 *   3. Broker directory "Office Admin" role
 */
export function isAdminByPolicy(
  email: string | null | undefined,
  name: string | null | undefined,
  username?: string | null | undefined
): boolean {
  const nameLower = (name ?? "").trim().toLowerCase();

  for (const candidate of emailCandidates(email, username)) {
    if (ENV.localAdminEmails.includes(candidate)) return true;
    const entry = findBrokerDirectoryEntry(candidate);
    if (isBrokerDirectoryAdmin(entry)) return true;
  }

  if (nameLower && ENV.localAdminNames.includes(nameLower)) return true;

  return false;
}

/**
 * Resolves the display name to use for LOCAL_ADMIN_NAMES policy checks.
 * Only stored app-user names or broker-directory entries are trusted here —
 * never a client-supplied login field or a name embedded in a session
 * token, both of which a user can set to any value they like.
 */
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
