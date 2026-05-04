import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { decryptSettingEnvelope, encryptSettingPlaintext, isEncryptedEnvelope } from "./settingsEncryption";

describe("settings encryption", () => {
  const prev = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = prev;
  });

  it("roundtrips plaintext", () => {
    const enc = encryptSettingPlaintext("secret-value");
    expect(isEncryptedEnvelope(enc)).toBe(true);
    expect(decryptSettingEnvelope(enc)).toBe("secret-value");
  });
});
