import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { findBrokerDirectoryEntry } from "@shared/brokerDirectory";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storagePut, storageGet } from "./storage";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { uploads } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { aiAssistRouter } from "./routers/aiAssist";
import { listingImportRouter } from "./routers/listingImport";
import { compDataRouter } from "./routers/compData";
import { emailRouter } from "./routers/email";
import { contractsRouter } from "./routers/contracts";
import { submissionsRouter } from "./routers/submissions";
import { brokersRouter } from "./routers/brokers";
import { localAuth, sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { handlePlatformLogout } from "./auth/passwordPlatformAuth";
import { findAppUserByUsernameOrEmail } from "./auth/platformSession";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const LISTING_BROCHURE_CATEGORY = "listing_brochure";
const LISTING_BROCHURE_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeLeeLogin(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value || value.includes("@")) return localAuth.normalizeEmail(value);
  return localAuth.normalizeEmail(`${value}@lee-associates.com`);
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

        const email = normalizeLeeLogin(input.email);
        if (!z.string().email().safeParse(email).success) {
          return {
            success: false as const,
            error: "Enter your Lee username or email address.",
          };
        }
        const enteredName = input.name?.trim() || "";
        const allowedDomain = (process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "")
          .trim()
          .toLowerCase();
        if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
          return {
            success: false as const,
            error: `Use your ${allowedDomain} email address.`,
          };
        }

        try {
          const db = await getDb();
          if (db) {
            const appUserRecord = await findAppUserByUsernameOrEmail(db, email);
            if (appUserRecord) {
              return {
                success: false as const,
                error: appUserRecord.isActive
                  ? "Enter your password to sign in."
                  : "This account has been deactivated. Contact your admin.",
              };
            }
          }
        } catch (err) {
          console.error("[auth.login] Database query failed:", err);
          return {
            success: false as const,
            error: "Sign-in service is temporarily unavailable.",
          };
        }

        const brokerEntry = findBrokerDirectoryEntry(email);
        if (!brokerEntry) {
          return {
            success: false as const,
            error: "Email not recognized. Use your @lee-associates.com email.",
          };
        }
        const resolvedName = brokerEntry?.name || enteredName;
        const openId = localAuth.toLocalOpenId(email);
        const role = "user";

        if (ENV.isProduction && !String(ENV.cookieSecret ?? "").trim()) {
          console.error(
            "[auth.login] JWT_SECRET is not set; cannot sign session cookies."
          );
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
    upload: publicProcedure
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
        const {
          filename,
          mimeType,
          base64Data,
          category,
          reference,
          uploaderName,
        } = input;

        // Decode base64 to buffer
        const buffer = Buffer.from(base64Data, "base64");
        const fileSize = buffer.length;

        if (fileSize > MAX_UPLOAD_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
          });
        }
        if (
          category === LISTING_BROCHURE_CATEGORY &&
          !LISTING_BROCHURE_MIMES.has(mimeType)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Brochure uploads must be PDF, JPEG, PNG, or WebP.",
          });
        }

        // Build a unique S3 key with random suffix to prevent enumeration
        const ext = filename.split(".").pop() ?? "bin";
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `broker-docs/${category}/${nanoid(10)}-${safeName}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, mimeType);

        // Save metadata to database
        const db = await getDb();
        if (db) {
          await db.insert(uploads).values({
            fileKey,
            url,
            filename,
            mimeType,
            fileSize,
            category,
            reference: reference ?? null,
            uploaderName: uploaderName ?? ctx.user?.name ?? null,
            uploaderOpenId: ctx.user?.openId ?? null,
          });
        }

        return { success: true, url, fileKey, filename };
      }),

    /**
     * Get a fresh download URL for a file by its key.
     */
    getUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const { url } = await storageGet(input.fileKey);
        return { url };
      }),

    /**
     * List recent uploads, optionally filtered by category or reference.
     */
    list: publicProcedure
      .input(
        z.object({
          category: z.string().optional(),
          reference: z.string().optional(),
          limit: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const rows = await db
          .select()
          .from(uploads)
          .orderBy(desc(uploads.createdAt))
          .limit(input.limit);

        // Filter in JS if needed (simple approach)
        return rows.filter(r => {
          if (input.category && r.category !== input.category) return false;
          if (input.reference && r.reference !== input.reference) return false;
          return true;
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
