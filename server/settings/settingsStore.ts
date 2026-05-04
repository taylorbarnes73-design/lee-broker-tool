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

  if (!db) {
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
}> {
  const merged = await ensureSettingsCache();
  return {
    company_name: String(merged.get("branding.company_name") ?? ""),
    logo_url: (merged.get("branding.logo_url") as string | null) ?? null,
    primary_color: String(merged.get("branding.primary_color") ?? "#A6192E"),
    support_email: String(merged.get("branding.support_email") ?? ""),
  };
}
