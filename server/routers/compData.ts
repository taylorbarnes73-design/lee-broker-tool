import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { compImports } from "../../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  fetchWorkbookBufferFromStorage,
  getLatestCompImport,
  importCompWorkbookBuffer,
  searchCompRows,
} from "../services/compData";

const compTypeSchema = z.enum(["lease", "sale"]);

const searchInputSchema = z.object({
  compType: compTypeSchema,
  query: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  market: z.string().trim().max(120).optional(),
  subMarket: z.string().trim().max(120).optional(),
  propertyType: z.string().trim().max(120).optional(),
  dateFrom: z.string().trim().max(32).optional(),
  dateTo: z.string().trim().max(32).optional(),
  limit: z.number().min(1).max(100).default(24),
});

export const compDataRouter = router({
  latest: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const latest = await getLatestCompImport(db);
    if (!latest) return null;

    return {
      id: latest.id,
      workbookName: latest.workbookName,
      canonicalLeaseSheet: latest.canonicalLeaseSheet,
      canonicalSaleSheet: latest.canonicalSaleSheet,
      leaseCount: latest.leaseCount,
      saleCount: latest.saleCount,
      sourceFilename: latest.sourceFilename,
      sourceUrl: latest.sourceUrl,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  }),

  listImports: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(12) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 12;

      return db
        .select()
        .from(compImports)
        .orderBy(desc(compImports.createdAt))
        .limit(limit);
    }),

  importWorkbook: adminProcedure
    .input(
      z.object({
        fileKey: z.string().min(1),
        filename: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const { buffer, sourceUrl } = await fetchWorkbookBufferFromStorage(input.fileKey);
      const result = await importCompWorkbookBuffer({
        db,
        buffer,
        workbookName: input.filename,
        sourceFilename: input.filename,
        sourceFileKey: input.fileKey,
        sourceUrl,
        importedByOpenId: ctx.user.openId,
        importedByEmail: ctx.user.email ?? null,
      });

      return {
        success: true as const,
        ...result,
      };
    }),

  search: protectedProcedure.input(searchInputSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return {
        latestImport: null,
        results: [],
      };
    }

    const latestImport = await getLatestCompImport(db);
    if (!latestImport) {
      return {
        latestImport: null,
        results: [],
      };
    }

    const results = await searchCompRows({
      db,
      compType: input.compType,
      importId: latestImport.id,
      filters: {
        query: input.query,
        city: input.city,
        market: input.market,
        subMarket: input.subMarket,
        propertyType: input.propertyType,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
      },
    });

    return {
      latestImport: {
        id: latestImport.id,
        workbookName: latestImport.workbookName,
        canonicalLeaseSheet: latestImport.canonicalLeaseSheet,
        canonicalSaleSheet: latestImport.canonicalSaleSheet,
        leaseCount: latestImport.leaseCount,
        saleCount: latestImport.saleCount,
        sourceFilename: latestImport.sourceFilename,
        createdAt: latestImport.createdAt,
      },
      results,
    };
  }),
});
