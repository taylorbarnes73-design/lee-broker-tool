import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

// ── Local filesystem fallback (used when AWS_S3_BUCKET is not set) ───────────
// Files are stored under <cwd>/local-uploads/ and served through the authenticated
// /api/files/content proxy. /local-uploads/ is still parsed for legacy stored URLs.

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "local-uploads");
const LOCAL_URL_PREFIX = "/local-uploads/";
const PUBLIC_FILE_PROXY_PREFIX = "/api/files/content?key=";
const CONTROL_CHAR_PATTERN = /[\0-\x1F\x7F]/;

export function sanitizeStorageKey(rawKey: string): string {
  const trimmed = String(rawKey).trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("Invalid storage key");
  }
  if (segments.some((segment) => segment === "." || segment === ".." || CONTROL_CHAR_PATTERN.test(segment))) {
    throw new Error("Invalid storage key");
  }
  return segments.join("/");
}

/** True when no S3 bucket is configured and the local FS fallback is active. */
export function isLocalStorage(): boolean {
  return !ENV.awsS3Bucket?.trim();
}

let _localStorageWarned = false;
function warnLocalStorage() {
  if (_localStorageWarned) return;
  _localStorageWarned = true;
  console.warn(
    "[storage] AWS_S3_BUCKET is not set — using local filesystem storage (./local-uploads/)." +
    " Set AWS_S3_BUCKET + AWS_S3_REGION for production use."
  );
}

async function localPut(
  relKey: string,
  data: Buffer,
): Promise<{ key: string; url: string }> {
  warnLocalStorage();
  const safeKey = sanitizeStorageKey(relKey);
  const filePath = path.join(LOCAL_UPLOADS_DIR, ...safeKey.split("/"));
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, data);
  return { key: safeKey, url: storagePublicUrl(safeKey) };
}

function localGet(relKey: string): { key: string; url: string } {
  const safeKey = sanitizeStorageKey(relKey);
  return { key: safeKey, url: storagePublicUrl(safeKey) };
}

export function storagePublicUrl(relKey: string): string {
  const safeKey = sanitizeStorageKey(relKey);
  return `${PUBLIC_FILE_PROXY_PREFIX}${encodeURIComponent(safeKey)}`;
}

export function storedFileKeyFromReference(input: string | null | undefined): string | null {
  const raw = String(input ?? "");
  if (!raw.trim()) return null;
  return tryParseStoredKey(raw);
}

function tryParseStoredKey(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith("/api/files/content")) {
    const [, query = ""] = value.split("?", 2);
    const key = new URLSearchParams(query).get("key");
    return key ? key.trim() : null;
  }

  if (value.startsWith(LOCAL_URL_PREFIX)) {
    return value.slice(LOCAL_URL_PREFIX.length);
  }

  if (value.startsWith(PUBLIC_FILE_PROXY_PREFIX)) {
    return decodeURIComponent(value.slice(PUBLIC_FILE_PROXY_PREFIX.length));
  }

  if (/^(broker-docs|broker-admin|broker-docusign)\//.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const bucket = ENV.awsS3Bucket?.trim().toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (parsed.pathname === "/api/files/content") {
      const key = parsed.searchParams.get("key");
      return key ? key.trim() : null;
    }

    if (!pathname) return null;

    if (bucket && host === `${bucket}.s3.${(ENV.awsS3Region || ENV.awsRegion || "").toLowerCase()}.amazonaws.com`) {
      return pathname;
    }

    if (bucket && host === `${bucket}.s3.amazonaws.com`) {
      return pathname;
    }

    if (host === "s3.amazonaws.com" || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host)) {
      const [first, ...rest] = pathname.split("/");
      if (bucket && first === bucket && rest.length > 0) {
        return rest.join("/");
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isStoredFileReference(input: string | null | undefined): boolean {
  const value = String(input ?? "").trim();
  if (!value) return false;
  return Boolean(tryParseStoredKey(value));
}

export function normalizeStoredFileUrl(urlOrKey: string | null | undefined, fileKey?: string | null): string | null {
  const explicitKey = String(fileKey ?? "").trim();
  if (explicitKey) return storagePublicUrl(explicitKey);

  const raw = String(urlOrKey ?? "").trim();
  if (!raw) return null;

  const parsedKey = tryParseStoredKey(raw);
  return parsedKey ? storagePublicUrl(parsedKey) : raw;
}

async function localGetBytes(relKey: string): Promise<{ key: string; bytes: Buffer }> {
  const safeKey = sanitizeStorageKey(relKey);
  const filePath = path.join(LOCAL_UPLOADS_DIR, ...safeKey.split("/"));
  const bytes = await fs.promises.readFile(filePath);
  return { key: safeKey, bytes };
}

/**
 * Read bytes for a file that may be stored either in S3 or on the local
 * filesystem (depending on whether AWS_S3_BUCKET is set).
 * Can also be called with a `/local-uploads/…` URL path directly.
 */
export async function storageGetBytes(urlOrKey: string): Promise<{ key: string; bytes: Buffer }> {
  const relKey = sanitizeStorageKey(tryParseStoredKey(urlOrKey) ?? urlOrKey);

  if (isLocalStorage()) {
    return localGetBytes(relKey);
  }

  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");
  const key = relKey;
  const resp = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await streamToBuffer(resp.Body);
  return { key, bytes };
}

function getS3Client() {
  const config: import("@aws-sdk/client-s3").S3ClientConfig = { region: ENV.awsS3Region || ENV.awsRegion };
  if (ENV.awsAccessKeyId && ENV.awsSecretAccessKey) {
    config.credentials = {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey,
    };
  }
  return new S3Client(config);
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.from([]);
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  // AWS SDK v3 GetObject Body is usually a Node.js Readable stream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const body = Buffer.isBuffer(data) ? data : typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const key = sanitizeStorageKey(relKey);

  if (isLocalStorage()) {
    return localPut(key, body);
  }

  const bucket = ENV.awsS3Bucket!;

  await getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );

  return { key, url: storagePublicUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = sanitizeStorageKey(relKey);
  if (isLocalStorage()) {
    return localGet(key);
  }

  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");

  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}
