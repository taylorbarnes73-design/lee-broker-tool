import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { invalidateSettingsCache, getSetting, patchSettings, buildGrouped } from "./settingsStore";
import { SETTINGS_BY_KEY, SETTING_KEYS, type SettingKey } from "./settingsSchema";
import { getDb } from "../db";
import { writeAuditLog } from "../auth/writeAuditLog";
import { AdminUserError } from "../adminUsers/adminErrors";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../auth/writeAuditLog", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("getSetting", () => {
  beforeEach(() => {
    invalidateSettingsCache();
    vi.mocked(getDb).mockResolvedValue(null);
  });

  it("returns schema default when DB is unavailable", async () => {
    expect(await getSetting("branding.company_name")).toBe("Lee & Associates Newport Beach");
  });

  it("throws for keys not in the schema", async () => {
    await expect(getSetting("not.a.real.key")).rejects.toThrow(/Unknown setting key/);
  });
});

describe("buildGrouped masking", () => {
  it("masks sensitive integration secrets", () => {
    const merged = new Map<SettingKey, unknown>();
    for (const k of SETTING_KEYS) {
      merged.set(k, SETTINGS_BY_KEY[k].defaultValue);
    }
    merged.set("integrations.dealius.username", "alice");
    merged.set("integrations.dealius.password", "hunter2");
    merged.set("integrations.buildout.api_key", "secret-buildout-key");

    const grouped = buildGrouped(merged, true);
    expect(grouped.integrations.dealius.username).toMatch(/••••/);
    expect(grouped.integrations.dealius.password).toMatch(/••••/);
    expect((grouped.integrations as { buildout?: { api_key?: unknown } }).buildout?.api_key).toMatch(/••••/);
    expect(grouped.branding.company_name).toBe("Lee & Associates Newport Beach");
  });
});

describe("patchSettings", () => {
  const prevEnc = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    invalidateSettingsCache();
    vi.mocked(writeAuditLog).mockClear();
    vi.mocked(getDb).mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevEnc === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = prevEnc;
  });

  it("rejects unknown keys", async () => {
    const mockDb = {
      insert: () => ({
        values: () => ({
          onDuplicateKeyUpdate: () => Promise.resolve(),
        }),
      }),
    } as any;
    await expect(
      patchSettings(mockDb, { "unknown.key": true }, "actor", { headers: {} } as any)
    ).rejects.toBeInstanceOf(AdminUserError);
  });

  it("writes audit without leaking sensitive values", async () => {
    invalidateSettingsCache();
    vi.mocked(getDb).mockResolvedValue(null);
    const mockDb = {
      insert: () => ({
        values: () => ({
          onDuplicateKeyUpdate: () => Promise.resolve(),
        }),
      }),
    } as any;
    await patchSettings(
      mockDb,
      { "integrations.dealius.password": "new-secret" },
      "actor-1",
      { headers: {} } as any
    );
    const call = vi.mocked(writeAuditLog).mock.calls.find(c => c[1] === "settings.updated");
    expect(call).toBeDefined();
    const meta = call![4] as Record<string, unknown>;
    expect(String(meta.before_redacted)).not.toContain("hunter");
    expect(String(meta.after_redacted)).not.toContain("new-secret");
    expect(String(meta.after_redacted)).toMatch(/updated|empty/i);
  });
});
