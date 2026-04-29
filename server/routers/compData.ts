import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { compImports } from "../../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  addSingleComp,
  fetchWorkbookBufferFromStorage,
  getLatestCompImport,
  importCompWorkbookBuffer,
  searchCompRows,
} from "../services/compData";
import type { LeaseCompRecord, SaleCompRecord } from "../../shared/comp-data";

const compTypeSchema = z.enum(["lease", "sale"]);

const filterArr = z.array(z.string().trim().max(120)).optional();

const searchInputSchema = z.object({
  compType: compTypeSchema,
  query: z.string().trim().max(200).optional(),
  cities: filterArr,
  markets: filterArr,
  subMarkets: filterArr,
  propertyTypes: filterArr,
  sfMin: z.number().min(0).optional(),
  sfMax: z.number().min(0).optional(),
  dateFrom: z.string().trim().max(32).optional(),
  dateTo: z.string().trim().max(32).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const manualRecordSchema = z.object({}).catchall(z.unknown());

const addCompInputSchema = z.object({
  compType: compTypeSchema,
  record: manualRecordSchema,
});

type ManualRecordInput = z.infer<typeof manualRecordSchema>;

function textValue(input: ManualRecordInput, key: string, fallback = "") {
  const value = input[key];
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function numberValue(input: ManualRecordInput, key: string) {
  const value = input[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized.replace(/[$,%]/g, ""));
  if (Number.isFinite(parsed)) return parsed;
  const firstNumber = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!firstNumber) return null;
  const extracted = Number(firstNumber[0]);
  return Number.isFinite(extracted) ? extracted : null;
}

function dateValue(input: ManualRecordInput, key: string) {
  const raw = textValue(input, key);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

function brokerSubmittedRecord(input: ManualRecordInput, user: { name: string | null; email: string | null }) {
  const submitter = user.name || user.email || "Broker Submission";
  return {
    ...input,
    source: textValue(input, "source") || submitter,
    verifiedBy: textValue(input, "verifiedBy") || submitter,
    lastUpdated: textValue(input, "lastUpdated") || new Date().toISOString().slice(0, 10),
  };
}

function manualLeaseRecord(input: ManualRecordInput): LeaseCompRecord {
  return {
    sourceSheet: textValue(input, "sourceSheet", "Manual-Lease"),
    id: numberValue(input, "id"),
    office: textValue(input, "office"),
    address: textValue(input, "address"),
    city: textValue(input, "city"),
    state: textValue(input, "state", "CA"),
    zipCode: textValue(input, "zipCode"),
    market: textValue(input, "market"),
    subMarket: textValue(input, "subMarket"),
    projectName: textValue(input, "projectName"),
    propertyType: textValue(input, "propertyType", "Indust"),
    propertySubType: textValue(input, "propertySubType"),
    buildingClass: textValue(input, "buildingClass"),
    spaceType: textValue(input, "spaceType"),
    multiTenant: textValue(input, "multiTenant"),
    yearBuilt: numberValue(input, "yearBuilt"),
    constructionType: textValue(input, "constructionType"),
    dhDoors: numberValue(input, "dhDoors"),
    glDoors: numberValue(input, "glDoors"),
    clearHeight: numberValue(input, "clearHeight"),
    amperage: numberValue(input, "amperage"),
    parkingType: textValue(input, "parkingType"),
    parkingRatio: textValue(input, "parkingRatio"),
    sprinklers: textValue(input, "sprinklers"),
    rail: textValue(input, "rail"),
    yard: textValue(input, "yard"),
    pol: textValue(input, "pol"),
    listBroker: textValue(input, "listBroker"),
    procBroker: textValue(input, "procBroker"),
    source: textValue(input, "source", "Manual"),
    verifiedBy: textValue(input, "verifiedBy"),
    lastUpdated: dateValue(input, "lastUpdated") || new Date().toISOString().slice(0, 10),
    monthsOnMarket: numberValue(input, "monthsOnMarket"),
    transactionDate: dateValue(input, "transactionDate"),
    occupancyDate: dateValue(input, "occupancyDate"),
    expirationDate: dateValue(input, "expirationDate"),
    leasedSqFt: numberValue(input, "leasedSqFt"),
    rentPerSqFt: numberValue(input, "rentPerSqFt"),
    rentType: textValue(input, "rentType"),
    askRentPerSqFt: numberValue(input, "askRentPerSqFt"),
    askRentType: textValue(input, "askRentType"),
    termInMonths: numberValue(input, "termInMonths"),
    effectiveRent: numberValue(input, "effectiveRent"),
    freeRentMonths: numberValue(input, "freeRentMonths"),
    rentAdjustments: textValue(input, "rentAdjustments"),
    options: textValue(input, "options"),
    tia: textValue(input, "tia"),
    consideration: textValue(input, "consideration"),
    lessee: textValue(input, "lessee"),
    lesseeBusiness: textValue(input, "lesseeBusiness"),
    lesseeContact: textValue(input, "lesseeContact"),
    lesseePhone: textValue(input, "lesseePhone"),
    lesseePriorLocation: textValue(input, "lesseePriorLocation"),
    lessor: textValue(input, "lessor"),
    comments: textValue(input, "comments"),
    buildingSqFt: numberValue(input, "buildingSqFt"),
    officeSqFt: numberValue(input, "officeSqFt"),
    nnnCharges: numberValue(input, "nnnCharges"),
    landSqFt: numberValue(input, "landSqFt"),
    cam: textValue(input, "cam"),
    confidential: textValue(input, "confidential"),
    expenseStop: textValue(input, "expenseStop"),
    rentUse: textValue(input, "rentUse"),
  };
}

function manualSaleRecord(input: ManualRecordInput): SaleCompRecord {
  return {
    sourceSheet: textValue(input, "sourceSheet", "Manual-Sale"),
    id: numberValue(input, "id"),
    office: textValue(input, "office"),
    address: textValue(input, "address"),
    city: textValue(input, "city"),
    state: textValue(input, "state", "CA"),
    zipCode: textValue(input, "zipCode"),
    market: textValue(input, "market"),
    subMarket: textValue(input, "subMarket"),
    projectName: textValue(input, "projectName"),
    propertyType: textValue(input, "propertyType", "Indust"),
    propertySubType: textValue(input, "propertySubType"),
    buildingClass: textValue(input, "buildingClass"),
    yearBuilt: numberValue(input, "yearBuilt"),
    constructionType: textValue(input, "constructionType"),
    dhDoors: numberValue(input, "dhDoors"),
    glDoors: numberValue(input, "glDoors"),
    clearHeight: numberValue(input, "clearHeight"),
    amperage: numberValue(input, "amperage"),
    parkingType: textValue(input, "parkingType"),
    parkingRatio: textValue(input, "parkingRatio"),
    sprinklers: textValue(input, "sprinklers"),
    rail: textValue(input, "rail"),
    yard: textValue(input, "yard"),
    multiTenant: textValue(input, "multiTenant"),
    floors: numberValue(input, "floors"),
    passengerElevators: numberValue(input, "passengerElevators"),
    freightElevators: numberValue(input, "freightElevators"),
    listBroker: textValue(input, "listBroker"),
    procBroker: textValue(input, "procBroker"),
    source: textValue(input, "source", "Manual"),
    verifiedBy: textValue(input, "verifiedBy"),
    lastUpdated: dateValue(input, "lastUpdated") || new Date().toISOString().slice(0, 10),
    monthsOnMarket: numberValue(input, "monthsOnMarket"),
    transactionDate: dateValue(input, "transactionDate"),
    buildingSqFt: numberValue(input, "buildingSqFt"),
    landSqFt: numberValue(input, "landSqFt"),
    officeSqFt: numberValue(input, "officeSqFt"),
    salePrice: numberValue(input, "salePrice"),
    salePricePerSqFt: numberValue(input, "salePricePerSqFt"),
    capRate: numberValue(input, "capRate"),
    transactionType: textValue(input, "transactionType"),
    buyer: textValue(input, "buyer"),
    buyerBusiness: textValue(input, "buyerBusiness"),
    buyerContact: textValue(input, "buyerContact"),
    buyerPhone: textValue(input, "buyerPhone"),
    buyerPriorLocation: textValue(input, "buyerPriorLocation"),
    seller: textValue(input, "seller"),
    sellerContact: textValue(input, "sellerContact"),
    sellerPhone: textValue(input, "sellerPhone"),
    comments: textValue(input, "comments"),
    askingPrice: numberValue(input, "askingPrice"),
  };
}

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

  addComp: adminProcedure.input(addCompInputSchema).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const record = input.compType === "lease"
      ? manualLeaseRecord(input.record)
      : manualSaleRecord(input.record);

    const stored = await addSingleComp({
      db,
      compType: input.compType,
      record,
    });

    return { success: true as const, ...stored };
  }),

  submitComp: protectedProcedure.input(addCompInputSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const recordInput = brokerSubmittedRecord(input.record, ctx.user);
    const record = input.compType === "lease"
      ? manualLeaseRecord(recordInput)
      : manualSaleRecord(recordInput);

    const stored = await addSingleComp({
      db,
      compType: input.compType,
      record,
    });

    return { success: true as const, ...stored };
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

    const page = await searchCompRows({
      db,
      compType: input.compType,
      importId: latestImport.id,
      filters: {
        query: input.query,
        cities: input.cities,
        markets: input.markets,
        subMarkets: input.subMarkets,
        propertyTypes: input.propertyTypes,
        sfMin: input.sfMin,
        sfMax: input.sfMax,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
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
      results: page.results,
      pageInfo: {
        total: page.total,
        offset: page.offset,
        limit: page.limit,
        returned: page.results.length,
        hasNext: page.hasNext,
        hasPrevious: page.hasPrevious,
        nextOffset: page.hasNext ? page.offset + page.limit : null,
        previousOffset: page.hasPrevious ? Math.max(0, page.offset - page.limit) : null,
      },
    };
  }),
});
