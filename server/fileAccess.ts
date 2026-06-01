import { eq } from "drizzle-orm";
import { uploads } from "../drizzle/schema";
import { sanitizeStorageKey, storedFileKeyFromReference } from "./storage";

export type StoredFileAccessUser = {
  openId: string;
  role?: string | null;
};

export type StoredFileAccessRecord = {
  fileKey: string;
  filename: string | null;
  mimeType: string | null;
  uploaderOpenId: string | null;
  reference: string | null;
};

export class FileAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FileAccessError";
    this.status = status;
  }
}

function normalizeUserRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

export function isStoredFileAdmin(user: StoredFileAccessUser): boolean {
  return normalizeUserRole(user.role) === "admin";
}

export function storedKeyForAccess(input: string): string {
  return sanitizeStorageKey(storedFileKeyFromReference(input) ?? input);
}

export async function requireStoredFileAccess(
  db: {
    select: (selection?: unknown) => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          limit: (limit: number) => Promise<StoredFileAccessRecord[]>;
        };
      };
    };
  },
  user: StoredFileAccessUser,
  keyOrUrl: string
): Promise<{ key: string; upload: StoredFileAccessRecord }> {
  const key = storedKeyForAccess(keyOrUrl);
  const rows = await db
    .select({
      fileKey: uploads.fileKey,
      filename: uploads.filename,
      mimeType: uploads.mimeType,
      uploaderOpenId: uploads.uploaderOpenId,
      reference: uploads.reference,
    })
    .from(uploads)
    .where(eq(uploads.fileKey, key))
    .limit(1);
  const upload = rows[0];

  if (!upload) {
    throw new FileAccessError(404, "File not found");
  }

  if (isStoredFileAdmin(user) || upload.uploaderOpenId === user.openId) {
    return { key, upload };
  }

  throw new FileAccessError(403, "Forbidden");
}
