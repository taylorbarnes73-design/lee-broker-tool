import { submissions } from "../../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { and, eq, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod/v4";
import { addSingleComp } from "../services/compData";
import type { LeaseCompRecord, SaleCompRecord } from "../../shared/comp-data";
import { normalizeStoredFileUrl } from "../storage";
import { maybeNotifySubmissionStatusChange } from "../services/submissionNotifications";
import { findAppUserByUsernameOrEmail } from "../auth/platformSession";
import { createSubmissionRecord } from "../services/submissionCreate";
import { applySubmissionStatusChange } from "../services/submissionStatusUpdate";
import { notifyAdminOfSubmission } from "../services/adminNotification";
import {
  deriveSubmissionReference,
  normalizeSubmissionFormType,
  parseSubmissionObject,
  toIsoString,
} from "../submissionsApi";

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

const adminStatusSchema = z.enum(["pending", "in_review", "approved", "rejected", "closed"]);
const ACTIVE_QUEUE_STATUSES = ["pending", "in_review"] as const;

type SubmissionCompatRow = {
  id: number;
  formType: string;
  status: string;
  payload: string | null;
  reference: string | null;
  submittedBy: string | null;
  submittedByOpenId: string | null;
  submittedByEmail: string | null;
  pdfFileKey: string | null;
  pdfUrl: string | null;
  source: string | null;
  sourceEmailMessageId: string | null;
  sourceEmailWebLink: string | null;
  parsedFields: unknown;
  assignedTo: string | null;
  assignedToOpenId: string | null;
  assignedAt: string | Date | null;
  completedBy: string | null;
  completedAt: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

const SUBMISSION_SELECT_SPECS: Array<{ column: string; alias: keyof SubmissionCompatRow; fallback?: string }> = [
  { column: "id", alias: "id" },
  { column: "formType", alias: "formType" },
  { column: "status", alias: "status" },
  { column: "payload", alias: "payload" },
  { column: "reference", alias: "reference" },
  { column: "submittedBy", alias: "submittedBy" },
  { column: "submittedByOpenId", alias: "submittedByOpenId" },
  { column: "submittedByEmail", alias: "submittedByEmail" },
  { column: "pdfFileKey", alias: "pdfFileKey" },
  { column: "pdfUrl", alias: "pdfUrl" },
  { column: "source", alias: "source", fallback: "'tool'" },
  { column: "source_email_message_id", alias: "sourceEmailMessageId", fallback: "null" },
  { column: "source_email_web_link", alias: "sourceEmailWebLink", fallback: "null" },
  { column: "parsed_fields", alias: "parsedFields", fallback: "null" },
  { column: "assignedTo", alias: "assignedTo", fallback: "null" },
  { column: "assignedToOpenId", alias: "assignedToOpenId", fallback: "null" },
  { column: "assignedAt", alias: "assignedAt", fallback: "null" },
  { column: "completedBy", alias: "completedBy", fallback: "null" },
  { column: "completedAt", alias: "completedAt", fallback: "null" },
  { column: "createdAt", alias: "createdAt" },
  { column: "updatedAt", alias: "updatedAt" },
];

let cachedSubmissionColumns: { loadedAt: number; columns: Set<string> } | null = null;

function activeQueueStatusCondition() {
  return sql`${submissions.status} in (${sql.join(ACTIVE_QUEUE_STATUSES.map(status => sql`${status}`), sql`, `)})`;
}

function isMysqlFieldMetadataRow(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("name" in value || "columnType" in value || "charsetNr" in value)
  );
}

function normalizeExecuteRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (
      result.length === 2 &&
      Array.isArray(result[0]) &&
      Array.isArray(result[1]) &&
      (result[1].length === 0 || isMysqlFieldMetadataRow(result[1][0]))
    ) {
      return result[0] as T[];
    }
    return result as T[];
  }
  if (result && typeof result === "object" && Array.isArray((result as any).rows)) {
    return (result as any).rows as T[];
  }
  return [];
}

async function getSubmissionColumnSet(db: any): Promise<Set<string>> {
  const now = Date.now();
  if (cachedSubmissionColumns && now - cachedSubmissionColumns.loadedAt < 30_000) {
    return cachedSubmissionColumns.columns;
  }

  const result = await db.execute(sql`show columns from submissions`);
  const rows = normalizeExecuteRows<Record<string, unknown>>(result);
  const columns = new Set(
    rows
      .map(row => String(row.Field ?? row.field ?? row.COLUMN_NAME ?? "").trim())
      .filter(Boolean)
  );
  cachedSubmissionColumns = { loadedAt: now, columns };
  return columns;
}

function buildSubmissionSelectList(tableAlias: string, columns: Set<string>) {
  return sql.join(
    SUBMISSION_SELECT_SPECS.map(spec => {
      if (columns.has(spec.column)) {
        return sql.raw(`${tableAlias}.\`${spec.column}\` as \`${String(spec.alias)}\``);
      }
      return sql.raw(`${spec.fallback ?? "null"} as \`${String(spec.alias)}\``);
    }),
    sql`, `
  );
}

async function selectSubmissionRows(
  db: any,
  options: {
    where?: any[];
    orderBy?: any;
    limit?: number;
  }
): Promise<SubmissionCompatRow[]> {
  const columns = await getSubmissionColumnSet(db);
  const selectList = buildSubmissionSelectList("s", columns);
  const whereSql = options.where?.length ? sql`where ${sql.join(options.where, sql` and `)}` : sql``;
  const orderBySql = options.orderBy ?? sql``;
  const limitSql = typeof options.limit === "number" ? sql`limit ${options.limit}` : sql``;
  const result = await db.execute(sql`
    select ${selectList}
    from submissions s
    ${whereSql}
    ${orderBySql}
    ${limitSql}
  `);
  return normalizeExecuteRows<SubmissionCompatRow>(result);
}

async function selectSubmissionById(db: any, id: number): Promise<SubmissionCompatRow | null> {
  const rows = await selectSubmissionRows(db, {
    where: [sql`s.\`id\` = ${id}`],
    limit: 1,
  });
  return rows[0] ?? null;
}

function parsePayload(payload: string | null) {
  if (!payload) return {};

  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function numberFromCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function parseConfidentialFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "yes" || value === "y" || value === "true" || value === "1";
}

function parseNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const normalized = String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDateOrEmpty(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  // Accept ISO-ish or US dates; normalize to ISO date for comp tables.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

type ZipMarketSubmarketMap = Record<string, { market?: string; submarket?: string }>;

let cachedZipMarketSubmarket: ZipMarketSubmarketMap | null = null;

function loadZipMarketSubmarket(): ZipMarketSubmarketMap {
  if (cachedZipMarketSubmarket) return cachedZipMarketSubmarket;

  const candidates = [
    path.resolve(process.cwd(), "client", "public", "zip_market_submarket.json"),
    path.resolve(process.cwd(), "dist", "public", "zip_market_submarket.json"),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as ZipMarketSubmarketMap;
      cachedZipMarketSubmarket = parsed;
      return parsed;
    } catch {
      // Ignore and try next location.
    }
  }

  cachedZipMarketSubmarket = {};
  return cachedZipMarketSubmarket;
}

function inferMarketSubmarketFromZip(zipCode: string): { market: string; subMarket: string } | null {
  const zip = zipCode.trim();
  if (!/^\d{5}$/.test(zip)) return null;
  const map = loadZipMarketSubmarket();
  const match = map[zip];
  if (!match) return null;
  return {
    market: String(match.market ?? "").trim(),
    subMarket: String(match.submarket ?? "").trim(),
  };
}

function toCompRecordFromVoucher(params: {
  input: Record<string, unknown>;
  submittedBy: string;
}): { compType: "lease" | "sale"; record: LeaseCompRecord | SaleCompRecord } | null {
  const { input, submittedBy } = params;
  const txnType = String(input.txnType ?? input.transactionType ?? "").trim().toLowerCase();
  const isSale = txnType.includes("sale");
  const isLease = txnType.includes("lease");
  if (!isSale && !isLease) return null;

  const address = String(input.address ?? input.propertyAddress ?? "").trim();
  const suite = String(input.suite ?? "").trim();
  const fullAddress = [address, suite].filter(Boolean).join(" ");
  const city = String(input.city ?? "").trim();
  const state = String(input.state ?? "CA").trim() || "CA";
  const zipCode = String(input.zip ?? input.zipCode ?? "").trim();
  const propertyType = String(input.propType ?? input.propertyType ?? "").trim() || "Indust";

  const listAgent1 = String(input.laName ?? input.listAgent1 ?? "").trim();
  const procAgent1 = String(input.paName ?? input.procAgent1 ?? "").trim();

  const inferredMarket = inferMarketSubmarketFromZip(zipCode);
  const marketFromInput = String(input.market ?? "").trim();
  const subMarketFromInput = String(input.submarket ?? input.subMarket ?? "").trim();
  const market = marketFromInput || inferredMarket?.market || "";
  const subMarket = subMarketFromInput || inferredMarket?.subMarket || "";

  const base = {
    sourceSheet: isLease ? "Voucher-Lease" : "Voucher-Sale",
    id: null,
    office: String(input.office ?? "").trim(),
    address: fullAddress,
    city,
    state,
    zipCode,
    market,
    subMarket,
    projectName: String(input.projectName ?? "").trim(),
    propertyType,
    propertySubType: String(input.subtype ?? input.propertySubType ?? "").trim(),
    buildingClass: String(input.bldgClass ?? input.buildingClass ?? "").trim(),
    constructionType: String(input.constType ?? input.constructionType ?? "").trim(),
    dhDoors: parseNumberOrNull(input.dh),
    glDoors: parseNumberOrNull(input.gl),
    clearHeight: parseNumberOrNull(input.clearance),
    amperage: parseNumberOrNull(input.amps),
    parkingType: String(input.parkingType ?? "").trim(),
    parkingRatio: String(input.parkRatio ?? input.parkingRatio ?? "").trim(),
    sprinklers: String(input.sprinklers ?? "").trim(),
    rail: String(input.rail ?? "").trim(),
    yard: String(input.yard ?? "").trim(),
    listBroker: String(input.lbCompany ?? input.listBroker ?? "").trim(),
    procBroker: String(input.lsCompany ?? input.procBroker ?? "").trim(),
    source: `Voucher · ${submittedBy}`,
    verifiedBy: submittedBy,
    lastUpdated: new Date().toISOString().slice(0, 10),
    monthsOnMarket: parseNumberOrNull(input.lMktMonths ?? input.sMktMonths),
    photo: String(input.photo ?? "").trim(),
    listAgent1,
    listAgent2: String(input.listAgent2 ?? "").trim(),
    procAgent1,
    procAgent2: String(input.procAgent2 ?? "").trim(),
    verified: "",
    updatedBy: submittedBy,
    apn: String(input.apn ?? "").trim(),
  } as const;

  if (isLease) {
    const record: LeaseCompRecord = {
      ...base,
      spaceType: String(input.spaceType ?? input.occType ?? "").trim(),
      multiTenant: String(input.multiTenant ?? "").trim(),
      yearBuilt: parseNumberOrNull(input.yearBuilt),
      pol: String(input.pol ?? "").trim(),
      transactionDate: isoDateOrEmpty(input.lStart ?? input.transactionDate ?? input.dateFilled),
      occupancyDate: isoDateOrEmpty(input.lOcc ?? input.occupancyDate),
      expirationDate: isoDateOrEmpty(input.lEnd ?? input.expirationDate),
      leasedSqFt: parseNumberOrNull(input.lDealSF ?? input.dealSF),
      rentPerSqFt: parseNumberOrNull(input.lRate ?? input.rentPerSqFt),
      rentType: String(input.lRateType ?? input.rentType ?? "").trim(),
      askRentPerSqFt: parseNumberOrNull(input.lAskingRate ?? input.askRentPerSqFt),
      askRentType: String(input.askRentType ?? "").trim(),
      termInMonths: parseNumberOrNull(input.lTerm ?? input.termInMonths),
      effectiveRent: parseNumberOrNull(input.lNnnEff ?? input.effectiveRent),
      freeRentMonths: null,
      rentAdjustments: String(input.lEscalations ?? input.rentAdjustments ?? "").trim(),
      options: "",
      tia: String(input.lTiTotal ?? input.tia ?? "").trim(),
      consideration: String(input.lConsideration ?? input.consideration ?? "").trim(),
      lessee: String(input.lsCompany ?? input.lessee ?? "").trim(),
      lesseeBusiness: "",
      lesseeContact: String(input.lsContact ?? "").trim(),
      lesseePhone: String(input.lsPhone ?? "").trim(),
      lesseePriorLocation: String(input.priorLoc ?? input.lesseePriorLocation ?? "").trim(),
      lessor: String(input.lbCompany ?? input.lessor ?? "").trim(),
      comments: String(input.notes ?? input.comments ?? "").trim(),
      buildingSqFt: parseNumberOrNull(input.bldgSF),
      officeSqFt: parseNumberOrNull(input.officeSF),
      nnnCharges: parseNumberOrNull(input.lNnnTotal ?? input.nnnCharges),
      landSqFt: parseNumberOrNull(input.landSF),
      cam: String(input.opex ?? input.cam ?? "").trim(),
      confidential: "",
      expenseStop: "",
      rentUse: "",
    };
    return { compType: "lease", record };
  }

  const record: SaleCompRecord = {
    ...base,
    yearBuilt: parseNumberOrNull(input.yearBuilt),
    multiTenant: String(input.multiTenant ?? "").trim(),
    floors: parseNumberOrNull(input.floors),
    passengerElevators: null,
    freightElevators: null,
    transactionDate: isoDateOrEmpty(input.sClose ?? input.transactionDate ?? input.dateFilled),
    buildingSqFt: parseNumberOrNull(input.bldgSF),
    landSqFt: parseNumberOrNull(input.landSF),
    officeSqFt: parseNumberOrNull(input.officeSF),
    salePrice: parseNumberOrNull(input.sPrice ?? input.salePrice),
    salePricePerSqFt: parseNumberOrNull(input.sPriceSF ?? input.salePricePerSqFt),
    capRate: parseNumberOrNull(input.sCapRate ?? input.capRate),
    transactionType: String(input.dealType ?? input.transactionType ?? "Sale").trim(),
    buyer: String(input.lsCompany ?? input.buyer ?? "").trim(),
    buyerBusiness: "",
    buyerContact: String(input.lsContact ?? "").trim(),
    buyerPhone: String(input.lsPhone ?? "").trim(),
    buyerPriorLocation: String(input.priorLoc ?? input.buyerPriorLocation ?? "").trim(),
    seller: String(input.lbCompany ?? input.seller ?? "").trim(),
    sellerContact: String(input.lbContact ?? "").trim(),
    sellerPhone: String(input.lbPhone ?? "").trim(),
    comments: String(input.notes ?? input.comments ?? "").trim(),
    askingPrice: null,
  };
  return { compType: "sale", record };
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
      const brokerName = input.brokerName || ctx.user.name || ctx.user.email || ctx.user.openId;
      const appUser =
        ctx.user.email && db ? await findAppUserByUsernameOrEmail(db, ctx.user.email) : null;
      const { submissionId } = await createSubmissionRecord({
        db,
        input: {
          formType: input.type,
          status: input.status?.trim() || "pending",
          payload: input,
          reference,
          submittedBy: brokerName,
          submittedByOpenId: ctx.user.openId,
          submittedByEmail: ctx.user.email ?? (input.brokerEmail || null),
        },
        actor: {
          openId: ctx.user.openId,
          name: brokerName,
          email: ctx.user.email ?? null,
          platformUserId: appUser?.id ?? null,
        },
        req: ctx.req,
      });

      // Best-effort: push voucher deals into comps dataset when NOT confidential.
      // Confidential vouchers remain only in the submissions table.
      try {
        if (input.type === "voucher" && !parseConfidentialFlag((input as any).confidential)) {
          const submittedBy =
            input.brokerName || ctx.user.name || ctx.user.email || ctx.user.openId;
          const comp = toCompRecordFromVoucher({ input: input as any, submittedBy });
          if (comp) {
            await addSingleComp({
              db,
              compType: comp.compType,
              record: comp.record,
            });
          }
        }
      } catch {
        // Intentionally ignore comps write failures; the voucher submission is already stored.
      }

      notifyAdminOfSubmission({
        formType: input.type,
        brokerName,
        propertyAddress: reference,
        submittedByEmail: ctx.user.email ?? (input.brokerEmail || null),
        submissionId,
        notes: typeof input.notes === "string" ? input.notes : null,
      });

      return {
        success: true as const,
        stored: true as const,
        submissionId,
      };
    }),

  mine: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 25;
      const columns = await getSubmissionColumnSet(db);
      const brokerCondition = columns.has("submittedByOpenId")
        ? sql`s.\`submittedByOpenId\` = ${ctx.user.openId}`
        : columns.has("submittedByEmail")
          ? sql`s.\`submittedByEmail\` = ${ctx.user.email}`
          : sql`s.\`submittedBy\` = ${ctx.user.name ?? ctx.user.email}`;

      const rows = await selectSubmissionRows(db, {
        where: [brokerCondition],
        orderBy: sql`order by s.\`createdAt\` desc`,
        limit,
      });

      return rows
        .filter(row => row.id != null)
        .map(row => {
          const payload = parsePayload(row.payload);
          const parsedFields = parseSubmissionObject(row.parsedFields);
          return {
            id: row.id,
            formType: normalizeSubmissionFormType(row.formType, payload, parsedFields),
            status: row.status,
            reference: deriveSubmissionReference(row.reference, payload, parsedFields),
            submittedBy: row.submittedBy,
            submittedByEmail: row.submittedByEmail,
            pdfFileKey: row.pdfFileKey,
            pdfUrl: normalizeStoredFileUrl(row.pdfUrl, row.pdfFileKey),
            createdAt: toIsoString(row.createdAt),
            updatedAt: toIsoString(row.updatedAt),
            payload,
          };
        });
    }),

  queueMine: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
        .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { totalPending: 0, requests: [] as any[] };
      const limit = input?.limit ?? 50;
      const columns = await getSubmissionColumnSet(db);
      // Build broker-scoping condition: prefer submittedByOpenId, fall back to submittedByEmail
      const brokerCondition = columns.has("submittedByOpenId")
        ? sql`s.\`submittedByOpenId\` = ${ctx.user.openId}`
        : columns.has("submittedByEmail")
          ? sql`s.\`submittedByEmail\` = ${ctx.user.email}`
          : sql`s.\`submittedBy\` = ${ctx.user.name ?? ctx.user.email}`;
      // 1) Get *my* active queue requests (the broker should only see their own).
      const myQueueRows = await selectSubmissionRows(db, {
        where: [
          brokerCondition,
          sql`s.\`status\` in (${sql.join(ACTIVE_QUEUE_STATUSES.map(status => sql`${status}`), sql`, `)})`,
        ],
        orderBy: sql`order by s.\`createdAt\` asc, s.\`id\` asc`,
        limit,
      });

      // 2) Total active requests in the global queue (used for context / UX).
      const totalActiveRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .where(activeQueueStatusCondition());
      const totalActive = numberFromCount(totalActiveRows[0]?.count);

      // 3) For each of my active requests, compute how many active requests are ahead.
      // Ordering rule: createdAt ASC, then id ASC for stable tie-break.
      const requests = await Promise.all(
        myQueueRows.map(async row => {
          let aheadCount = 0;
          // Only compute position if createdAt is available (column may not exist in older schemas)
          if (row.createdAt != null && row.id != null) {
            const aheadRows = await db
              .select({ count: sql<number>`count(*)` })
              .from(submissions)
              .where(
                and(
                  activeQueueStatusCondition(),
                  or(
                    sql`${submissions.createdAt} < ${row.createdAt}`,
                    and(sql`${submissions.createdAt} = ${row.createdAt}`, sql`${submissions.id} < ${row.id}`)
                  )
                )
              );
            aheadCount = numberFromCount(aheadRows[0]?.count);
          }
          return {
            id: row.id,
            formType: row.formType,
            status: row.status,
            reference: row.reference,
            submittedBy: row.submittedBy,
            submittedByEmail: row.submittedByEmail,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            aheadCount,
            position: aheadCount + 1,
            payload: parsePayload(row.payload),
          };
        })
      );

      return {
        totalPending: totalActive,
        totalActive,
        requests,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const row = await selectSubmissionById(db, input.id);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }

      if (row.submittedByOpenId !== ctx.user.openId && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Submission not available" });
      }

      return {
        id: row.id,
        formType: row.formType,
        status: row.status,
        reference: row.reference,
        submittedBy: row.submittedBy,
        submittedByEmail: row.submittedByEmail,
        pdfFileKey: row.pdfFileKey,
        pdfUrl: normalizeStoredFileUrl(row.pdfUrl, row.pdfFileKey),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        payload: parsePayload(row.payload),
      };
    }),

  adminList: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(200) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 200;

      const rows = await selectSubmissionRows(db, {
        orderBy: sql`order by s.\`createdAt\` desc`,
        limit,
      });

      return rows.map(row => ({
        id: row.id,
        formType: row.formType,
        status: row.status,
        reference: row.reference,
        submittedBy: row.submittedBy,
        submittedByEmail: row.submittedByEmail,
        pdfFileKey: row.pdfFileKey,
        pdfUrl: normalizeStoredFileUrl(row.pdfUrl, row.pdfFileKey),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        payload: parsePayload(row.payload),
      }));
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: adminStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      // Fetch current status to compute assignment side-effects only on actual transitions
      const existingRow = await selectSubmissionById(db, input.id);
      if (!existingRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }
      const currentStatus = existingRow.status ?? "";
      const availableColumns = await getSubmissionColumnSet(db);
      const adminName = ctx.user.name || ctx.user.email || ctx.user.openId;

      await applySubmissionStatusChange({
        db,
        submissionId: input.id,
        previousStatus: currentStatus,
        nextStatus: input.status,
        actor: {
          openId: ctx.user.openId,
          name: adminName,
          email: ctx.user.email ?? null,
          platformUserId: null,
        },
        req: ctx.req,
        availableColumns,
      });

      return { success: true as const };
    }),
});
