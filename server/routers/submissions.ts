import { submissions } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

const submissionSummarySchema = z
  .object({
    clientSubmissionId: z.string().optional(),
    type: z.string(),
    status: z.string().optional(),
    propertyType: z.string().optional(),
    transactionType: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    brokerName: z.string().optional(),
    brokerEmail: z.union([z.string().email(), z.literal("")]).optional(),
    office: z.string().optional(),
    submittedAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .catchall(z.unknown());

function parsePayload(payload: string | null) {
  if (!payload) return {};

  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

export const submissionsRouter = router({
  create: protectedProcedure
    .input(submissionSummarySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      if (!db) {
        return {
          success: false as const,
          stored: false as const,
          error: "Database unavailable",
        };
      }

      const reference = [input.address, input.city].filter(Boolean).join(", ") || null;
      const [result] = await db.insert(submissions).values({
        formType: input.type,
        payload: JSON.stringify(input),
        reference,
        submittedBy: input.brokerName || ctx.user.name || ctx.user.email || ctx.user.openId,
        submittedByOpenId: ctx.user.openId,
        submittedByEmail: ctx.user.email ?? (input.brokerEmail || null),
      });

      return {
        success: true as const,
        stored: true as const,
        submissionId: (result as { insertId?: number }).insertId ?? null,
      };
    }),

  mine: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 25;

      const rows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.submittedByOpenId, ctx.user.openId))
        .orderBy(desc(submissions.createdAt))
        .limit(limit);

      return rows.map(row => ({
        id: row.id,
        formType: row.formType,
        reference: row.reference,
        submittedBy: row.submittedBy,
        submittedByEmail: row.submittedByEmail,
        createdAt: row.createdAt,
        payload: parsePayload(row.payload),
      }));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const rows = await db.select().from(submissions).where(eq(submissions.id, input.id)).limit(1);
      const row = rows[0];

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }

      if (row.submittedByOpenId !== ctx.user.openId && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Submission not available" });
      }

      return {
        id: row.id,
        formType: row.formType,
        reference: row.reference,
        submittedBy: row.submittedBy,
        submittedByEmail: row.submittedByEmail,
        createdAt: row.createdAt,
        payload: parsePayload(row.payload),
      };
    }),
});
