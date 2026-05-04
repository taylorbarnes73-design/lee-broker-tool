import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

export type EncEnvelope = {
  _v: 1;
  iv: string;
  ct: string;
  tag: string;
};

let ephemeralKeyPrinted = false;
let ephemeralKey: Buffer | null = null;

function resolveKey32(): Buffer {
  const env = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!env) {
    if (!ephemeralKey) {
      ephemeralKey = randomBytes(32);
    }
    if (!ephemeralKeyPrinted) {
      console.warn(
        "[settings] SETTINGS_ENCRYPTION_KEY is not set; using an ephemeral in-memory key (settings will not decrypt after restart). Set SETTINGS_ENCRYPTION_KEY to a base64-encoded 32-byte secret."
      );
      ephemeralKeyPrinted = true;
    }
    return ephemeralKey;
  }
  try {
    const buf = Buffer.from(env, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(env, "utf8").digest();
}

export function isEncryptedEnvelope(v: unknown): v is EncEnvelope {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o._v === 1 && typeof o.iv === "string" && typeof o.ct === "string" && typeof o.tag === "string";
}

export function encryptSettingPlaintext(plain: string): EncEnvelope {
  const key = resolveKey32();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    _v: 1,
    iv: iv.toString("base64"),
    ct: enc.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSettingEnvelope(env: EncEnvelope): string {
  const key = resolveKey32();
  const iv = Buffer.from(env.iv, "base64");
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]);
  return out.toString("utf8");
}
