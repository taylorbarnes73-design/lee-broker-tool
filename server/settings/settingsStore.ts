import { eq } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { writeAuditLog } from "../auth/writeAuditLog";
import type { Request } from "express";
import {
  isSettingKey,
  MASKED_SECRET,
  SETTING_KEYS,
  SETTINGS_BY_KEY,
  type SettingKey,
  type SettingsCategory,
} from "./settingsSchema";
import { decryptSettingEnvelope, encryptSettingPlaintext, isEncryptedEnvelope } from "./settingsEncryption";
import { DealiusClient } from "../services/dealiusClient";
import { fetchBuildoutPropertiesSample } from "../services/buildoutClient";
import { AdminUserError } from "../adminUsers/adminErrors";

type AppDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type CacheEntry = {
  /** Decrypted / plain merged values for all known keys. */
  merged: Map<SettingKey, unknown>;
};

let cache: CacheEntry | null = null;

export function invalidateSettingsCache(): void {
  cache = null;
}

function coerceStoredValue(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function parseMergedValue(key: SettingKey, raw: unknown): unknown {
  const def = SETTINGS_BY_KEY[key];
  const base = raw === undefined ? def.defaultValue : coerceStoredValue(raw);
  let val = base;
  if (def.sensitive) {
    if (val === null || val === undefined || val === "") {
      val = def.defaultValue;
    } else if (isEncryptedEnvelope(val)) {
      try {
        val = decryptSettingEnvelope(val);
      } catch {
        val = def.defaultValue;
      }
    }
  }
  const parsed = def.valueSchema.safeParse(val);
  return parsed.success ? parsed.data : def.defaultValue;
}

export async function refreshSettingsCache(): Promise<Map<SettingKey, unknown>> {
  const db = await getDb();
  const merged = new Map<SettingKey, unknown>();

  // Tests often mock `getDb()` with a minimal object that isn't a Drizzle DB.
  // Treat that as "DB unavailable" and fall back to defaults.
  if (!db || typeof (db as any).select !== "function") {
    for (const key of SETTING_KEYS) {
      merged.set(key, SETTINGS_BY_KEY[key].defaultValue);
    }
    cache = { merged };
    return merged;
  }

  const rows = await db.select().from(appSettings);
  const fromDb = new Map<string, unknown>();
  for (const r of rows) {
    fromDb.set(r.key, r.value);
  }

  for (const key of SETTING_KEYS) {
    const raw = fromDb.get(key);
    merged.set(key, parseMergedValue(key, raw));
  }

  cache = { merged };
  return merged;
}

export async function ensureSettingsCache(): Promise<Map<SettingKey, unknown>> {
  if (cache) return cache.merged;
  return refreshSettingsCache();
}

function maskForAdmin(key: SettingKey, val: unknown): unknown {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) return val;
  if (val === null || val === undefined || val === "") return null;
  return MASKED_SECRET;
}

function redactForAudit(key: SettingKey, val: unknown, isBefore: boolean): string {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  if (val === null || val === undefined || val === "") return isBefore ? "(empty)" : "(empty)";
  return isBefore ? "(set)" : "(updated)";
}

function parsedPlainForAudit(key: SettingKey, stored: unknown): unknown {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) return stored;
  if (isEncryptedEnvelope(stored)) {
    try {
      return decryptSettingEnvelope(stored);
    } catch {
      return "(invalid)";
    }
  }
  return stored;
}

function setDeep(target: Record<string, unknown>, parts: string[], value: unknown) {
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value as unknown;
}

export function buildGrouped(
  merged: Map<SettingKey, unknown>,
  mask: boolean
): Record<SettingsCategory, Record<string, unknown>> {
  const out: Record<SettingsCategory, Record<string, unknown>> = {
    branding: {},
    workflow: {},
    notifications: {},
    integrations: {},
    security: {},
  };

  for (const key of SETTING_KEYS) {
    const def = SETTINGS_BY_KEY[key];
    const val = mask ? maskForAdmin(key, merged.get(key)) : merged.get(key);
    const prefix = `${def.category}.`;
    if (!key.startsWith(prefix)) continue;
    const tail = key.slice(prefix.length).split(".");
    setDeep(out[def.category], tail, val);
  }

  return out;
}

export async function getGroupedSettings(mask: boolean): Promise<Record<SettingsCategory, Record<string, unknown>>> {
  const merged = await ensureSettingsCache();
  return buildGrouped(merged, mask);
}

export async function getGroupedCategory(
  category: SettingsCategory,
  mask: boolean
): Promise<Record<string, unknown>> {
  const all = await getGroupedSettings(mask);
  return all[category] ?? {};
}

export async function patchSettings(
  db: AppDb,
  body: Record<string, unknown>,
  actorId: string,
  req: Request
): Promise<Record<SettingsCategory, Record<string, unknown>>> {
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new AdminUserError(400, "NO_KEYS", "At least one setting key is required.");
  }

  const merged = await ensureSettingsCache();
  const updates: Array<{ key: SettingKey; stored: unknown; category: SettingsCategory }> = [];

  for (const rawKey of keys) {
    if (!isSettingKey(rawKey)) {
      throw new AdminUserError(400, "UNKNOWN_KEY", `Unknown setting key: ${rawKey}`, rawKey);
    }
    const key = rawKey as SettingKey;
    const def = SETTINGS_BY_KEY[key];
    const parsed = def.valueSchema.safeParse(body[rawKey]);
    if (!parsed.success) {
      throw new AdminUserError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Validation failed",
        rawKey
      );
    }
    let stored: unknown = parsed.data;
    if (def.sensitive) {
      if (stored === null || stored === undefined || stored === "") {
        stored = null;
      } else if (typeof stored === "string") {
        stored = encryptSettingPlaintext(stored);
      }
    }
    updates.push({ key, stored, category: def.category });
  }

  for (const u of updates) {
    const def = SETTINGS_BY_KEY[u.key];
    const beforeVal = merged.get(u.key);
    const beforeRedacted = redactForAudit(u.key, beforeVal, true);
    const afterRedacted = redactForAudit(u.key, parsedPlainForAudit(u.key, u.stored), false);

    await db
      .insert(appSettings)
      .values({
        key: u.key,
        value: u.stored as any,
        category: u.category,
        description: def.description ?? null,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .onDuplicateKeyUpdate({
        set: {
          value: u.stored as any,
          category: u.category,
          description: def.description ?? null,
          updatedAt: new Date(),
          updatedBy: actorId,
        },
      });

    await writeAuditLog(
      actorId,
      "settings.updated",
      "setting",
      u.key,
      { category: u.category, before_redacted: beforeRedacted, after_redacted: afterRedacted },
      req
    );
  }

  invalidateSettingsCache();
  return getGroupedSettings(true);
}

export async function runDealiusSettingsTest(
  db: AppDb,
  actorId: string,
  req: Request
): Promise<{ success: boolean; message: string; tested_at: string }> {
  const merged = await ensureSettingsCache();
  const user = (merged.get("integrations.dealius.username") as string) ?? "";
  const pass = (merged.get("integrations.dealius.password") as string) ?? "";

  let success = false;
  let message = "";

  if (process.env.SETTINGS_DEALIUS_TEST_STUB === "fail") {
    success = false;
    message = "Stub failure (SETTINGS_DEALIUS_TEST_STUB=fail).";
  } else if (!user || !pass) {
    success = false;
    message = "Dealius username or password is not configured in settings.";
  } else {
    try {
      const client = new DealiusClient();
      await client.authenticate({ email: user, password: pass });
      success = true;
      message = "Authentication succeeded.";
    } catch (e: unknown) {
      success = false;
      message = e instanceof Error ? e.message : String(e);
    }
  }

  const testedAt = new Date().toISOString();
  const result = success ? "success" : "failed";

  const defAt = SETTINGS_BY_KEY["integrations.dealius.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.dealius.last_test_result"];

  await db
    .insert(appSettings)
    .values({
      key: "integrations.dealius.last_test_at",
      value: testedAt as any,
      category: "integrations",
      description: defAt.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({
      set: {
        value: testedAt as any,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });

  await db
    .insert(appSettings)
    .values({
      key: "integrations.dealius.last_test_result",
      value: result as any,
      category: "integrations",
      description: defRes.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({
      set: {
        value: result as any,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });

  await writeAuditLog(
    actorId,
    "settings.updated",
    "setting",
    "integrations.dealius.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );

  invalidateSettingsCache();

  return { success, message, tested_at: testedAt };
}

/** Validate Dealius credentials without persisting (used by admin Settings modal). */
export async function verifyDealiusCredentials(username: string, password: string): Promise<{ success: boolean; message: string }> {
  const user = username.trim();
  const pass = password;
  if (process.env.SETTINGS_DEALIUS_TEST_STUB === "fail") {
    return { success: false, message: "Stub failure (SETTINGS_DEALIUS_TEST_STUB=fail)." };
  }
  if (!user || !pass) {
    return { success: false, message: "Username and password are required." };
  }
  try {
    const client = new DealiusClient();
    await client.authenticate({ email: user, password: pass });
    return { success: true, message: "Authentication succeeded." };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export type BuildoutVerifyResult = {
  success: boolean;
  message: string;
  sample?: { total_count: number; returned: number; first_property_id: number | null; first_property_name: string | null };
};

export async function verifyBuildoutCredentials(
  apiKey: string,
  apiBaseUrl: string | null | undefined,
  defaultCompanyId: number | null | undefined
): Promise<BuildoutVerifyResult> {
  const key = apiKey.trim();
  if (process.env.SETTINGS_BUILDOUT_TEST_STUB === "fail") {
    return { success: false, message: "Stub failure (SETTINGS_BUILDOUT_TEST_STUB=fail)." };
  }
  if (!key) {
    return { success: false, message: "Buildout API key is required." };
  }
  try {
    const { sample } = await fetchBuildoutPropertiesSample({
      apiKey: key,
      apiBaseUrl: apiBaseUrl ?? null,
      defaultCompanyId: defaultCompanyId ?? null,
      limit: 3,
    });
    const detail =
      sample.returned > 0
        ? ` Retrieved ${sample.returned} sample propert${sample.returned === 1 ? "y" : "ies"} (${sample.total_count} total in account filter).`
        : ` No properties returned in this sample (${sample.total_count} total count).`;
    return {
      success: true,
      message: `Buildout API responded successfully.${detail}`,
      sample: {
        total_count: sample.total_count,
        returned: sample.returned,
        first_property_id: sample.first_property_id,
        first_property_name: sample.first_property_name,
      },
    };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function runBuildoutSettingsTest(
  db: AppDb,
  actorId: string,
  req: Request
): Promise<{ success: boolean; message: string; tested_at: string }> {
  const merged = await ensureSettingsCache();
  const apiKey = (merged.get("integrations.buildout.api_key") as string) ?? "";
  const baseUrl = (merged.get("integrations.buildout.api_base_url") as string | null) ?? null;
  const companyId = (merged.get("integrations.buildout.default_company_id") as number | null) ?? null;

  let success = false;
  let message = "";

  if (process.env.SETTINGS_BUILDOUT_TEST_STUB === "fail") {
    success = false;
    message = "Stub failure (SETTINGS_BUILDOUT_TEST_STUB=fail).";
  } else if (!apiKey.trim()) {
    success = false;
    message = "Buildout API key is not configured in settings.";
  } else {
    const v = await verifyBuildoutCredentials(apiKey, baseUrl, companyId);
    success = v.success;
    message = v.message;
  }

  const testedAt = new Date().toISOString();
  const result = success ? "success" : "failed";

  const defAt = SETTINGS_BY_KEY["integrations.buildout.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.buildout.last_test_result"];

  await db
    .insert(appSettings)
    .values({
      key: "integrations.buildout.last_test_at",
      value: testedAt as any,
      category: "integrations",
      description: defAt.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({
      set: {
        value: testedAt as any,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });

  await db
    .insert(appSettings)
    .values({
      key: "integrations.buildout.last_test_result",
      value: result as any,
      category: "integrations",
      description: defRes.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({
      set: {
        value: result as any,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });

  await writeAuditLog(
    actorId,
    "settings.updated",
    "setting",
    "integrations.buildout.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );

  invalidateSettingsCache();

  return { success, message, tested_at: testedAt };
}

export async function getSetting(key: string): Promise<unknown> {
  if (!isSettingKey(key)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  const merged = await ensureSettingsCache();
  return merged.get(key as SettingKey);
}

export async function getPublicBranding(): Promise<{
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  support_email: string;
  marketing_email: string;
}> {
  const merged = await ensureSettingsCache();
  return {
    company_name: String(merged.get("branding.company_name") ?? ""),
    logo_url: (merged.get("branding.logo_url") as string | null) ?? null,
    primary_color: String(merged.get("branding.primary_color") ?? "#A6192E"),
    support_email: String(merged.get("branding.support_email") ?? ""),
    marketing_email: String(merged.get("branding.marketing_email") ?? ""),
  };
}

export async function getPublicToolSettings(): Promise<{
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  support_email: string;
  marketing_email: string;
  workflow: {
    confidential_warning_enabled: boolean;
    confidential_warning_text: string;
    auto_save_interval_seconds: number;
    default_listing_term_months: number;
    commission_split_must_sum_100: boolean;
    require_voucher_attachment: boolean;
  };
  notifications: {
    email_on_submission: boolean;
    email_on_status_change: boolean;
    email_on_dealius_success: boolean;
    admin_digest_enabled: boolean;
    admin_digest_time: string;
  };
}> {
  const merged = await ensureSettingsCache();
  return {
    company_name: String(merged.get("branding.company_name") ?? ""),
    logo_url: (merged.get("branding.logo_url") as string | null) ?? null,
    primary_color: String(merged.get("branding.primary_color") ?? "#A6192E"),
    support_email: String(merged.get("branding.support_email") ?? ""),
    marketing_email: String(merged.get("branding.marketing_email") ?? ""),
    workflow: {
      confidential_warning_enabled: Boolean(merged.get("workflow.confidential_warning_enabled")),
      confidential_warning_text: String(merged.get("workflow.confidential_warning_text") ?? ""),
      auto_save_interval_seconds: Number(merged.get("workflow.auto_save_interval_seconds") ?? 30),
      default_listing_term_months: Number(merged.get("workflow.default_listing_term_months") ?? 12),
      commission_split_must_sum_100: Boolean(merged.get("workflow.commission_split_must_sum_100")),
      require_voucher_attachment: Boolean(merged.get("workflow.require_voucher_attachment")),
    },
    notifications: {
      email_on_submission: Boolean(merged.get("notifications.email_on_submission")),
      email_on_status_change: Boolean(merged.get("notifications.email_on_status_change")),
      email_on_dealius_success: Boolean(merged.get("notifications.email_on_dealius_success")),
      admin_digest_enabled: Boolean(merged.get("notifications.admin_digest_enabled")),
      admin_digest_time: String(merged.get("notifications.admin_digest_time") ?? "08:00"),
    },
  };
}
