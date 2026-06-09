import { eq } from "drizzle-orm";
import { appUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  decryptSettingEnvelope,
  encryptSettingPlaintext,
  isEncryptedEnvelope,
} from "../settings/settingsEncryption";
import { verifyDealiusCredentials } from "../settings/settingsStore";

export type UserDealiusCredentials = {
  username: string;
  password: string;
};

function decryptPassword(raw: unknown): string {
  if (!raw || !isEncryptedEnvelope(raw)) return "";
  try {
    return decryptSettingEnvelope(raw).trim();
  } catch {
    return "";
  }
}

export async function getUserDealiusCredentials(userId: string): Promise<UserDealiusCredentials | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      username: appUsers.dealiusUsername,
      passwordEnc: appUsers.dealiusPasswordEnc,
    })
    .from(appUsers)
    .where(eq(appUsers.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const username = String(row.username ?? "").trim();
  const password = decryptPassword(row.passwordEnc);
  if (!username || !password) return null;
  return { username, password };
}

export async function saveUserDealiusCredentials(
  userId: string,
  username: string,
  password: string,
  options?: { verify?: boolean }
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database is not available." };

  const email = username.trim().toLowerCase();
  const pass = password;
  if (!email || !pass) return { success: false, message: "Dealius email and password are required." };

  if (options?.verify !== false) {
    const verified = await verifyDealiusCredentials(email, pass);
    if (!verified.success) return verified;
  }

  await db
    .update(appUsers)
    .set({
      dealiusUsername: email,
      dealiusPasswordEnc: encryptSettingPlaintext(pass),
    })
    .where(eq(appUsers.id, userId));

  return { success: true, message: "Dealius credentials saved to your account." };
}

export async function clearUserDealiusCredentials(userId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(appUsers)
    .set({ dealiusUsername: null, dealiusPasswordEnc: null })
    .where(eq(appUsers.id, userId));
}
