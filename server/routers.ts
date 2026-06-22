import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { findBrokerDirectoryEntry } from "@shared/brokerDirectory";
import { parseLeeLoginIdentifier } from "@shared/leeLogin";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut, storageGet, storagePublicUrl } from "./storage";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { assertCanReadStoredFile, filterReadableUploads } from "./fileAccess";
import { findAppUserByUsernameOrEmail } from "./auth/platformSession";
import { uploads } from "../drizzle/schema";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { aiAssistRouter } from "./routers/aiAssist";
import { listingImportRouter } from "./routers/listingImport";
import { compDataRouter } from "./routers/compData";
import { emailRouter } from "./routers/email";
import { contractsRouter } from "./routers/contracts";
import { submissionsRouter } from "./routers/submissions";
import { brokersRouter } from "./routers/brokers";
import { quickConvertRouter } from "./routers/quickConvert";
import { localAuth, sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { handlePlatformLogout } from "./auth/passwordPlatformAuth";
import { linkPlatformSessionAfterLegacyLogin } from "./auth/linkPlatformSessionAfterLegacyLogin";
import { getTrustedAdminPolicyName, isAdminByPolicy } from "./auth/isAdminByPolicy";
import { getRequestIp } from "./auth/requestIp";
import { isLoginRateLimited, recordLoginFailure } from "./auth/loginRateLimiter";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB per file
const MAX_BATCH_FILES = 20; // maximum files accepted in a single batch request
const MAX_BATCH_CONCURRENCY = 5; // max concurrent S3 uploads within a batch
const LISTING_BROCHURE_CATEGORY = "listing_brochure";
const LISTING_BROCHURE_MIMES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
// Categories are one or more slash-delimited path segments in storage keys.
// Each segment must start with lowercase alphanumeric and then use
// lowercase alphanumeric, underscore, or hyphen (max 64 chars per segment).
const CATEGORY_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// Executables and scripts have no legitimate place in deal documents; everything
// else (pdf/office/images/csv/etc.) stays allowed so existing workflows keep working.
const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  "exe", "msi", "dll", "scr", "com", "bat", "cmd", "ps1", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "sh", "bash", "jar", "apk", "app", "hta", "cpl",
]);

function uploadFileTypeError(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_UPLOAD_EXTENSIONS.has(ext)) {
    return `File type ".${ext}" is not allowed. Upload documents, spreadsheets, or images instead.`;
  }
  return null;
}

function normalizeLeeLogin(raw: string) {
  const parsed = parseLeeLoginIdentifier(raw, ENV.localAuthEmailDomain);
  return parsed.ok ? parsed.value.email : null;
}

function sanitizeUploadCategory(raw: string): string {
  const category = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const segments = category.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      segment => segment.length === 0 || segment === "." || segment === ".." || !CATEGORY_SEGMENT_PATTERN.test(segment)
    )
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid file category.",
    });
  }
  return segments.join("/");
}

/**
 * Estimate decoded byte size before base64 decoding so oversized payloads can
 * be rejected early without allocating a large buffer in memory.
 */
function estimatedBase64ByteLength(base64Data: string): number {
  const raw = String(base64Data ?? "").trim();
  const payload = raw.startsWith("data:") ? raw.slice(raw.indexOf(",") + 1) : raw;
  const normalized = payload.replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

async function storeUploadForBrowser(
  fileKey: string,
  data: Buffer,
  mimeType: string
): Promise<{ fileKey: string; storedUrl: string; browserUrl: string }> {
  const stored = await storagePut(fileKey, data, mimeType);
  const stableKey = stored.key;
  const { url: browserUrl } = await storageGet(stableKey);
  return {
    fileKey: stableKey,
    storedUrl: storagePublicUrl(stableKey),
    browserUrl,
  };
}

export const appRouter = router({
  system: systemRouter,
  aiAssist: aiAssistRouter,
  listingImport: listingImportRouter,
  compData: compDataRouter,
  email: emailRouter,
  contracts: contractsRouter,
  submissions: submissionsRouter,
  brokers: brokersRouter,
  quickConvert: quickConvertRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;

      const brokerEntry = user.email
        ? findBrokerDirectoryEntry(user.email)
        : null;

      return {
        ...user,
        office: brokerEntry?.office ?? null,
      };
    }),
    login: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120).optional(),
          email: z.string().trim().min(1).max(320),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!localAuth.isEnabled()) {
          return { success: false as const, error: "Local auth is disabled." };
        }

        const ip = getRequestIp(ctx.req);
        if (isLoginRateLimited(ip)) {
          return { success: false as const, error: "Too many login attempts. Try again later." };
        }

        const loginId = parseLeeLoginIdentifier(input.email, ENV.localAuthEmailDomain);
        if (!loginId.ok) {
          return { success: false as const, error: loginId.error };
        }

        const email = loginId.value.email;
        if (!z.string().email().safeParse(email).success) {
          return {
            success: false as const,
            error: "Enter your Lee username or email address.",
          };
        }
        const enteredName = input.name?.trim() || "";
        const allowedDomain = (ENV.localAuthEmailDomain ?? "").trim().toLowerCase();
        if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
          return {
            success: false as const,
            error: `Use your @${allowedDomain} email or Lee username only.`,
          };
        }

        let appUserRecord: Awaited<ReturnType<typeof findAppUserByUsernameOrEmail>> = undefined;
        try {
          const db = await getDb();
          if (db) {
            appUserRecord = await findAppUserByUsernameOrEmail(db, email);
          }
        } catch (err) {
          console.error("[auth.login] Could not resolve app user:", err);
        }

        if (appUserRecord && !appUserRecord.isActive) {
          return {
            success: false as const,
            error: "Your account is inactive. Contact an administrator for access.",
          };
        }

        const brokerEntry = findBrokerDirectoryEntry(email);
        if (!brokerEntry) {
          recordLoginFailure(ip);
          return {
            success: false as const,
            error: "Email not recognized. Use your @lee-associates.com email.",
          };
        }
        const resolvedName = brokerEntry?.name || enteredName;
        const openId = localAuth.toLocalOpenId(email);
        const role = isAdminByPolicy(
          email,
          getTrustedAdminPolicyName(email, appUserRecord?.fullName),
          appUserRecord?.username
        )
          ? "admin"
          : "user";

        if (ENV.isProduction && !String(ENV.cookieSecret ?? "").trim()) {
          console.error("[auth.login] JWT_SECRET is not set; cannot sign session cookies.");
          return {
            success: false as const,
            error:
              "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy.",
          };
        }

        try {
          try {
            await upsertUser({
              openId,
              name: resolvedName,
              email,
              loginMethod: "local",
              role,
              lastSignedIn: new Date(),
            });
          } catch (dbErr) {
            console.error("[auth.login] Database write failed:", dbErr);
            return {
              success: false as const,
              error:
                "Could not complete sign-in (database error). Please try again or contact support.",
            };
          }

          let sessionToken: string;
          try {
            sessionToken = await sdk.createSessionToken(openId, {
              name: resolvedName,
              email,
            });
          } catch (sessionErr) {
            const secretSet = Boolean(String(ENV.cookieSecret ?? "").trim());
            console.error("[auth.login] Session token signing failed:", {
              secretSet,
              err: sessionErr,
            });
            return {
              success: false as const,
              error: secretSet
                ? "Could not complete sign-in (session error). Please try again or contact support."
                : "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy.",
            };
          }

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          try {
            await linkPlatformSessionAfterLegacyLogin(ctx.req, ctx.res, email);
          } catch (linkErr) {
            console.error("[auth.login] Platform session link failed (legacy session cookie is set):", linkErr);
          }

          return {
            success: true as const,
            user: {
              name: resolvedName,
              email,
              role,
              office: brokerEntry?.office ?? null,
            },
          };
        } catch (err) {
          console.error("[auth.login] Sign-in failed:", err);
          return {
            success: false as const,
            error:
              "Could not complete sign-in (database or session error). Please try again or contact support.",
          };
        }
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await handlePlatformLogout(ctx.req, ctx.res);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  files: router({
    /**
     * Upload a file to S3 and record metadata in the database.
     * The client sends the file as a base64-encoded string.
     */
    upload: protectedProcedure
      .input(
        z.object({
          filename: z.string(),
          mimeType: z.string(),
          base64Data: z.string(),
          category: z.string().default("other"),
          reference: z.string().optional(),
          uploaderName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { filename, mimeType, base64Data, reference, uploaderName } = input;
        const category = sanitizeUploadCategory(input.category);
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database unavailable; cannot record file upload metadata.",
          });
        }

        const estimatedSize = estimatedBase64ByteLength(base64Data);
        if (estimatedSize > MAX_UPLOAD_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
          });
        }

        // Decode base64 to buffer
        const buffer = Buffer.from(base64Data, "base64");
        const fileSize = buffer.length;

        if (fileSize > MAX_UPLOAD_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
          });
        }
        if (category === LISTING_BROCHURE_CATEGORY && !LISTING_BROCHURE_MIMES.has(mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Brochure uploads must be PDF, JPEG, PNG, or WebP.",
          });
        }
        const typeError = uploadFileTypeError(filename);
        if (typeError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: typeError });
        }

        // Build a unique S3 key with random suffix to prevent enumeration
        const ext = filename.split(".").pop() ?? "bin";
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `broker-docs/${category}/${nanoid(10)}-${safeName}`;

        const stored = await storeUploadForBrowser(fileKey, buffer, mimeType);

        // Save metadata to database
        await db.insert(uploads).values({
          fileKey: stored.fileKey,
          url: stored.storedUrl,
          filename,
          mimeType,
          fileSize,
          category,
          reference: reference ?? null,
          uploaderName: uploaderName ?? ctx.user?.name ?? null,
          uploaderOpenId: ctx.user?.openId ?? null,
        });

        return { success: true, url: stored.browserUrl, fileKey: stored.fileKey, filename };
      }),

    /**
     * Upload multiple files in a single request.
     * Files are validated individually and uploaded to S3 concurrently
     * (capped at MAX_BATCH_CONCURRENCY to avoid overwhelming storage).
     * A per-file result is returned so the client can show partial success.
     */
    uploadBatch: protectedProcedure
      .input(
        z.object({
          files: z
            .array(
              z.object({
                filename: z.string(),
                mimeType: z.string(),
                base64Data: z.string(),
                category: z.string().default("other"),
                reference: z.string().optional(),
              })
            )
            .min(1)
            .max(MAX_BATCH_FILES),
          uploaderName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const uploadDb = await getDb();
        if (!uploadDb) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database unavailable; cannot record file upload metadata.",
          });
        }
        const ensuredUploadDb = uploadDb;

        type FileResult =
          | { filename: string; success: true; url: string; fileKey: string }
          | { filename: string; success: false; error: string };

        async function uploadOne(
          file: (typeof input.files)[number]
        ): Promise<FileResult> {
          try {
            const { filename, mimeType, base64Data, reference } = file;
            const category = sanitizeUploadCategory(file.category);
            const estimatedSize = estimatedBase64ByteLength(base64Data);
            if (estimatedSize > MAX_UPLOAD_BYTES) {
              return {
                filename,
                success: false,
                error: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
              };
            }

            const buffer = Buffer.from(base64Data, "base64");
            const fileSize = buffer.length;

            if (fileSize > MAX_UPLOAD_BYTES) {
              return {
                filename,
                success: false,
                error: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
              };
            }
            if (category === LISTING_BROCHURE_CATEGORY && !LISTING_BROCHURE_MIMES.has(mimeType)) {
              return {
                filename,
                success: false,
                error: "Brochure uploads must be PDF, JPEG, PNG, or WebP.",
              };
            }
            const typeError = uploadFileTypeError(filename);
            if (typeError) {
              return { filename, success: false, error: typeError };
            }

            const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
            const fileKey = `broker-docs/${category}/${nanoid(10)}-${safeName}`;
            const stored = await storeUploadForBrowser(fileKey, buffer, mimeType);

            await ensuredUploadDb.insert(uploads).values({
              fileKey: stored.fileKey,
              url: stored.storedUrl,
              filename,
              mimeType,
              fileSize,
              category,
              reference: reference ?? null,
              uploaderName:
                input.uploaderName ?? ctx.user?.name ?? null,
              uploaderOpenId: ctx.user?.openId ?? null,
            });

            return { filename, success: true, url: stored.browserUrl, fileKey: stored.fileKey };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { filename: file.filename, success: false, error: msg };
          }
        }

        // Concurrency-limited pool — upload MAX_BATCH_CONCURRENCY files at once
        const results: FileResult[] = [];
        const queue = [...input.files];

        async function runWorker() {
          while (queue.length > 0) {
            const file = queue.shift();
            if (!file) break;
            results.push(await uploadOne(file));
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(MAX_BATCH_CONCURRENCY, input.files.length) }, runWorker)
        );

        const successCount = results.filter(r => r.success).length;
        return { results, successCount, totalCount: results.length };
      }),

    /**
     * Get a fresh download URL for a file by its key.
     */
    getUrl: protectedProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ ctx, input }) => {
        try {
          await assertCanReadStoredFile(ctx.user, input.fileKey);
        } catch {
          throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
        }
        const { url } = await storageGet(input.fileKey);
        return { url };
      }),

    /**
     * List recent uploads, optionally filtered by category or reference.
     */
    list: protectedProcedure
      .input(
        z.object({
          category: z.string().optional(),
          reference: z.string().optional(),
          limit: z.number().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const whereClauses: SQL[] = [];
        if (ctx.user.role !== "admin") {
          whereClauses.push(eq(uploads.uploaderOpenId, ctx.user.openId));
        }
        if (input.category) {
          whereClauses.push(eq(uploads.category, input.category));
        }
        if (input.reference) {
          whereClauses.push(eq(uploads.reference, input.reference));
        }

        const baseQuery = db.select().from(uploads);
        const filteredQuery = whereClauses.length > 0 ? baseQuery.where(and(...whereClauses)) : baseQuery;
        const rows = await filteredQuery.orderBy(desc(uploads.createdAt)).limit(input.limit);

        return filterReadableUploads(ctx.user, rows);
      }),
  }),
});

export type AppRouter = typeof appRouter;
