import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storagePut, storageGet } from "./storage";
import { getDb } from "./db";
import { uploads } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { aiAssistRouter } from "./routers/aiAssist";
import { emailRouter } from "./routers/email";

export const appRouter = router({
  system: systemRouter,
  aiAssist: aiAssistRouter,
  email: emailRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
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
      .mutation(async ({ input }) => {
        const { filename, mimeType, base64Data, category, reference, uploaderName } = input;

        // Decode base64 to buffer
        const buffer = Buffer.from(base64Data, "base64");
        const fileSize = buffer.length;

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
            uploaderName: uploaderName ?? null,
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
