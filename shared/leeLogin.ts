const DEFAULT_LEE_DOMAIN = "lee-associates.com";

/** Local part before @lee-associates.com (e.g. jsmith). */
const LEE_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export type LeeLoginIdentifier = {
  email: string;
  username: string;
  /** Passed to user lookup (username or full Lee email). */
  lookupKey: string;
};

export function leeAuthEmailDomain(domain?: string): string {
  const normalized = String(domain ?? DEFAULT_LEE_DOMAIN).trim().toLowerCase();
  return normalized || DEFAULT_LEE_DOMAIN;
}

export function parseLeeLoginIdentifier(
  raw: string,
  domain?: string
): { ok: true; value: LeeLoginIdentifier } | { ok: false; error: string } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: "Enter your Lee username or @lee-associates.com email." };
  }

  const authDomain = leeAuthEmailDomain(domain);
  const suffix = `@${authDomain}`;

  if (trimmed.includes("@")) {
    if (trimmed.split("@").length !== 2) {
      return { ok: false, error: "Enter your Lee username or @lee-associates.com email." };
    }
    if (!trimmed.endsWith(suffix)) {
      return {
        ok: false,
        error: `Use your @${authDomain} email or Lee username only (e.g. jsmith).`,
      };
    }
    const username = trimmed.slice(0, -suffix.length);
    if (!username || !LEE_USERNAME_PATTERN.test(username)) {
      return { ok: false, error: "Enter a valid @lee-associates.com email address." };
    }
    return {
      ok: true,
      value: { email: trimmed, username, lookupKey: trimmed },
    };
  }

  if (!LEE_USERNAME_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Enter your Lee username (e.g. jsmith) or full @lee-associates.com email.",
    };
  }

  const email = `${trimmed}${suffix}`;
  return {
    ok: true,
    value: { email, username: trimmed, lookupKey: trimmed },
  };
}

/**
 * @deprecated Use parseLeeLoginIdentifier — kept for call sites that only need the email string.
 */
export function normalizeLeeLoginEmail(raw: string, domain?: string): string | null {
  const parsed = parseLeeLoginIdentifier(raw, domain);
  return parsed.ok ? parsed.value.email : null;
}
