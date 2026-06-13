import { eq } from "drizzle-orm";
import { submissions, uploads } from "../drizzle/schema";
import { localAuth } from "./_core/sdk";
import { getDb } from "./db";
import { storageKeyFromReference } from "./storage";

export type StoredFileAccessUser = {
  role?: string | null;
  openId?: string | null;
  email?: string | null;
};

export class StoredFileAccessDeniedError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "StoredFileAccessDeniedError";
  }
}

function isAdmin(user: StoredFileAccessUser | null | undefined): boolean {
  return user?.role === "admin";
}

function readableOpenIds(user: StoredFileAccessUser): Set<string> {
  const ids = new Set<string>();
  const openId = user.openId?.trim();
  if (openId) ids.add(openId);

  const email = user.email?.trim();
  if (email) ids.add(localAuth.toLocalOpenId(email));

  return ids;
}

function uploadOwnerCanRead(user: StoredFileAccessUser, row: { uploaderOpenId?: string | null }): boolean {
  const owner = row.uploaderOpenId?.trim();
  return Boolean(owner && readableOpenIds(user).has(owner));
}

function submissionOwnerCanRead(user: StoredFileAccessUser, row: { submittedByOpenId?: string | null }): boolean {
  const owner = row.submittedByOpenId?.trim();
  return Boolean(owner && readableOpenIds(user).has(owner));
}

export function filterReadableUploads<T extends { uploaderOpenId?: string | null }>(
  user: StoredFileAccessUser,
  rows: T[]
): T[] {
  if (isAdmin(user)) return rows;
  return rows.filter(row => uploadOwnerCanRead(user, row));
}

export async function canReadStoredFile(
  user: StoredFileAccessUser | null | undefined,
  fileReference: string
): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const key = storageKeyFromReference(fileReference);
  if (key.startsWith("broker-admin/") || key.startsWith("broker-docusign/")) {
    return false;
  }

  const db = await getDb();
  if (!db) return false;

  const uploadRows = await db
    .select({ uploaderOpenId: uploads.uploaderOpenId })
    .from(uploads)
    .where(eq(uploads.fileKey, key))
    .limit(1);
  const uploadRow = uploadRows[0];
  if (uploadRow) {
    return uploadOwnerCanRead(user, uploadRow);
  }

  const submissionRows = await db
    .select({ submittedByOpenId: submissions.submittedByOpenId })
    .from(submissions)
    .where(eq(submissions.pdfFileKey, key))
    .limit(1);
  const submissionRow = submissionRows[0];
  if (submissionRow) {
    return submissionOwnerCanRead(user, submissionRow);
  }

  return false;
}

export async function assertCanReadStoredFile(
  user: StoredFileAccessUser | null | undefined,
  fileReference: string
): Promise<void> {
  if (!(await canReadStoredFile(user, fileReference))) {
    throw new StoredFileAccessDeniedError();
  }
}
