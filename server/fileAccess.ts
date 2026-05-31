import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { uploads } from "../drizzle/schema";
import { getDb } from "./db";
import { localAuth } from "./_core/sdk";
import { resolveStoredFileKey } from "./storage";

export type StoredFileAccessUser = {
  role?: string | null;
  openId?: string | null;
  email?: string | null;
};

type DbLike = MySql2Database<any> | Awaited<ReturnType<typeof getDb>>;

function isAdmin(user: StoredFileAccessUser | null | undefined) {
  return user?.role === "admin";
}

function accessUserOpenId(user: StoredFileAccessUser | null | undefined): string | null {
  const openId = String(user?.openId ?? "").trim();
  if (openId) return openId;

  const email = String(user?.email ?? "").trim();
  return email ? localAuth.toLocalOpenId(email) : null;
}

export function normalizedStoredFileKey(input: string): string {
  const key = resolveStoredFileKey(input);
  if (!key) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export async function canAccessStoredFile(params: {
  user: StoredFileAccessUser | null | undefined;
  keyOrUrl: string;
  db?: DbLike;
}): Promise<boolean> {
  const key = normalizedStoredFileKey(params.keyOrUrl);
  if (isAdmin(params.user)) return true;

  const userOpenId = accessUserOpenId(params.user);
  if (!userOpenId) return false;

  const db = params.db ?? await getDb();
  if (!db) return false;

  const rows = await db
    .select({ uploaderOpenId: uploads.uploaderOpenId })
    .from(uploads)
    .where(eq(uploads.fileKey, key))
    .limit(1);

  return rows[0]?.uploaderOpenId === userOpenId;
}

export async function assertCanAccessStoredFile(params: {
  user: StoredFileAccessUser | null | undefined;
  keyOrUrl: string;
  db?: DbLike;
}): Promise<string> {
  const key = normalizedStoredFileKey(params.keyOrUrl);
  const allowed = await canAccessStoredFile({ ...params, keyOrUrl: key });
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to access this file." });
  }
  return key;
}
