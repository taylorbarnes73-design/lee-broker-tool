import { and, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import {
  compImports,
  leaseComps,
  saleComps,
  type CompImport,
  type LeaseComp,
  type SaleComp,
} from "../../drizzle/schema";
import {
  buildLeaseReportCard,
  buildSaleReportCard,
  parseCompWorkbookBuffer,
  type LeaseCompRecord,
  type SaleCompRecord,
} from "../../shared/comp-data";
import { storageGet } from "../storage";

const INSERT_BATCH_SIZE = 500;

export type CompType = "lease" | "sale";

export type CompImportSummary = {
  importId: number;
  workbookName: string;
  canonicalLeaseSheet: string;
  canonicalSaleSheet: string;
  leaseCount: number;
  saleCount: number;
  sourceFilename: string | null;
  createdAt: Date;
};

export type CompSearchFilters = {
  query?: string;
  city?: string;
  market?: string;
  subMarket?: string;
  propertyType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset?: number;
};

export type CompSearchResult = {
  id: number;
  importId: number;
  compType: CompType;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  market: string;
  subMarket: string;
  propertyType: string;
  propertySubType: string;
  transactionDate: string;
  source: string;
  reportCard: ReturnType<typeof buildLeaseReportCard> | ReturnType<typeof buildSaleReportCard>;
  metricLine: string;
  metaLine: string;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function numberFromCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function stringifyRecord(value: LeaseCompRecord | SaleCompRecord) {
  return JSON.stringify(value);
}

function parseLeasePayload(value: string): LeaseCompRecord {
  return JSON.parse(value) as LeaseCompRecord;
}

function parseSalePayload(value: string): SaleCompRecord {
  return JSON.parse(value) as SaleCompRecord;
}

function normalizeFilterText(value: string | undefined) {
  return value?.trim() ?? "";
}

function buildLeaseMetricLine(record: LeaseCompRecord) {
  const pieces = [
    record.leasedSqFt ? `${record.leasedSqFt.toLocaleString("en-US")} SF leased` : "",
    record.rentPerSqFt ? `Rent ${buildLeaseReportCard(record).fields["Rent/SqFt"]}` : "",
    record.transactionDate ? `Trans ${record.transactionDate}` : "",
  ].filter(Boolean);
  return pieces.join(" • ");
}

function buildSaleMetricLine(record: SaleCompRecord) {
  const saleCard = buildSaleReportCard(record);
  const pieces = [
    record.buildingSqFt ? `${record.buildingSqFt.toLocaleString("en-US")} SF` : "",
    saleCard.fields["Sale Price"] ? saleCard.fields["Sale Price"] : "",
    record.transactionDate ? `Trans ${record.transactionDate}` : "",
  ].filter(Boolean);
  return pieces.join(" • ");
}

function buildMetaLine(record: LeaseCompRecord | SaleCompRecord) {
  return [record.market, record.subMarket, record.propertyType, record.propertySubType]
    .filter(Boolean)
    .join(" • ");
}

function mapLeaseSearchResult(row: LeaseComp): CompSearchResult {
  const record = parseLeasePayload(row.rawPayload);
  return {
    id: row.id,
    importId: row.importId,
    compType: "lease",
    title: record.projectName || record.address || "Lease Comp",
    address: record.address,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    market: record.market,
    subMarket: record.subMarket,
    propertyType: record.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    source: record.source,
    reportCard: buildLeaseReportCard(record),
    metricLine: buildLeaseMetricLine(record),
    metaLine: buildMetaLine(record),
  };
}

function mapSaleSearchResult(row: SaleComp): CompSearchResult {
  const record = parseSalePayload(row.rawPayload);
  return {
    id: row.id,
    importId: row.importId,
    compType: "sale",
    title: record.projectName || record.address || "Sale Comp",
    address: record.address,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    market: record.market,
    subMarket: record.subMarket,
    propertyType: record.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    source: record.source,
    reportCard: buildSaleReportCard(record),
    metricLine: buildSaleMetricLine(record),
    metaLine: buildMetaLine(record),
  };
}

function buildLeaseInsertRows(records: LeaseCompRecord[], importId: number) {
  return records.map(record => ({
    importId,
    externalId: record.id,
    sourceSheet: record.sourceSheet,
    address: record.address,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    market: record.market,
    subMarket: record.subMarket,
    projectName: record.projectName,
    propertyType: record.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    listingBroker: record.listBroker,
    procuringBroker: record.procBroker,
    source: record.source,
    rawPayload: stringifyRecord(record),
  }));
}

function buildSaleInsertRows(records: SaleCompRecord[], importId: number) {
  return records.map(record => ({
    importId,
    externalId: record.id,
    sourceSheet: record.sourceSheet,
    address: record.address,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    market: record.market,
    subMarket: record.subMarket,
    projectName: record.projectName,
    propertyType: record.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    listingBroker: record.listBroker,
    procuringBroker: record.procBroker,
    source: record.source,
    rawPayload: stringifyRecord(record),
  }));
}

async function insertLeaseBatches(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  rows: ReturnType<typeof buildLeaseInsertRows>
) {
  for (const batch of chunkArray(rows, INSERT_BATCH_SIZE)) {
    if (!batch.length) continue;
    await db.insert(leaseComps).values(batch);
  }
}

async function insertSaleBatches(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  rows: ReturnType<typeof buildSaleInsertRows>
) {
  for (const batch of chunkArray(rows, INSERT_BATCH_SIZE)) {
    if (!batch.length) continue;
    await db.insert(saleComps).values(batch);
  }
}

export async function seedDirectRecords(params: {
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
  workbookName: string;
  sourceFilename?: string | null;
  canonicalLeaseSheet?: string;
  canonicalSaleSheet?: string;
  leaseRecords: LeaseCompRecord[];
  saleRecords: SaleCompRecord[];
}) {
  const {
    db,
    workbookName,
    sourceFilename,
    canonicalLeaseSheet = "Seeded-Lease",
    canonicalSaleSheet = "Seeded-Sale",
    leaseRecords,
    saleRecords,
  } = params;

  const [inserted] = await db.insert(compImports).values({
    sourceFileKey: null,
    sourceUrl: null,
    sourceFilename: sourceFilename ?? null,
    workbookName,
    canonicalLeaseSheet,
    canonicalSaleSheet,
    leaseCount: leaseRecords.length,
    saleCount: saleRecords.length,
    status: "failed",
    importedByOpenId: null,
    importedByEmail: null,
  });

  const importId = (inserted as { insertId?: number }).insertId;
  if (!importId) throw new Error("Failed to create comp import record.");

  try {
    await insertLeaseBatches(db, buildLeaseInsertRows(leaseRecords, importId));
    await insertSaleBatches(db, buildSaleInsertRows(saleRecords, importId));

    await db
      .update(compImports)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(compImports.status, "active"), ne(compImports.id, importId)));

    await db
      .update(compImports)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(compImports.id, importId));

    return {
      importId,
      workbookName,
      canonicalLeaseSheet,
      canonicalSaleSheet,
      leaseCount: leaseRecords.length,
      saleCount: saleRecords.length,
    };
  } catch (error) {
    await db.delete(leaseComps).where(eq(leaseComps.importId, importId));
    await db.delete(saleComps).where(eq(saleComps.importId, importId));
    await db
      .update(compImports)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(compImports.id, importId));
    throw error;
  }
}

export async function addSingleComp(params: {
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
  compType: CompType;
  record: LeaseCompRecord | SaleCompRecord;
}) {
  const { db, compType, record } = params;

  let activeImport = await getLatestCompImport(db);
  if (!activeImport) {
    const [inserted] = await db.insert(compImports).values({
      workbookName: "Manual Entries",
      canonicalLeaseSheet: "Manual-Lease",
      canonicalSaleSheet: "Manual-Sale",
      leaseCount: 0,
      saleCount: 0,
      status: "active",
    });
    const importId = (inserted as { insertId?: number }).insertId;
    if (!importId) throw new Error("Failed to create import record.");
    const rows = await db.select().from(compImports).where(eq(compImports.id, importId)).limit(1);
    activeImport = rows[0] ?? null;
  }
  if (!activeImport) throw new Error("No active import.");

  if (compType === "lease") {
    const rows = buildLeaseInsertRows([record as LeaseCompRecord], activeImport.id);
    const [inserted] = await db.insert(leaseComps).values(rows);
    await db
      .update(compImports)
      .set({ leaseCount: sql`${compImports.leaseCount} + 1`, updatedAt: new Date() })
      .where(eq(compImports.id, activeImport.id));
    return {
      importId: activeImport.id,
      compId: (inserted as { insertId?: number }).insertId ?? null,
    };
  } else {
    const rows = buildSaleInsertRows([record as SaleCompRecord], activeImport.id);
    const [inserted] = await db.insert(saleComps).values(rows);
    await db
      .update(compImports)
      .set({ saleCount: sql`${compImports.saleCount} + 1`, updatedAt: new Date() })
      .where(eq(compImports.id, activeImport.id));
    return {
      importId: activeImport.id,
      compId: (inserted as { insertId?: number }).insertId ?? null,
    };
  }
}

export async function fetchWorkbookBufferFromStorage(fileKey: string) {
  const stored = await storageGet(fileKey);
  const response = await fetch(stored.url);
  if (!response.ok) {
    throw new Error(`Workbook download failed (${response.status} ${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    sourceUrl: stored.url,
  };
}

export async function getLatestCompImport(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>
): Promise<CompImport | null> {
  const rows = await db
    .select()
    .from(compImports)
    .where(eq(compImports.status, "active"))
    .orderBy(desc(compImports.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function importCompWorkbookBuffer(params: {
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
  buffer: Buffer | Uint8Array;
  workbookName: string;
  sourceFilename?: string | null;
  sourceFileKey?: string | null;
  sourceUrl?: string | null;
  importedByOpenId?: string | null;
  importedByEmail?: string | null;
}) {
  const {
    db,
    buffer,
    workbookName,
    sourceFilename,
    sourceFileKey,
    sourceUrl,
    importedByOpenId,
    importedByEmail,
  } = params;

  const parsed = parseCompWorkbookBuffer(buffer, workbookName);
  const [inserted] = await db.insert(compImports).values({
    sourceFileKey: sourceFileKey ?? null,
    sourceUrl: sourceUrl ?? null,
    sourceFilename: sourceFilename ?? null,
    workbookName: parsed.workbookName,
    canonicalLeaseSheet: parsed.canonicalLeaseSheet,
    canonicalSaleSheet: parsed.canonicalSaleSheet,
    leaseCount: parsed.leaseRecords.length,
    saleCount: parsed.saleRecords.length,
    status: "failed",
    importedByOpenId: importedByOpenId ?? null,
    importedByEmail: importedByEmail ?? null,
  });

  const importId = (inserted as { insertId?: number }).insertId;
  if (!importId) {
    throw new Error("Failed to create comp import record.");
  }

  try {
    await insertLeaseBatches(db, buildLeaseInsertRows(parsed.leaseRecords, importId));
    await insertSaleBatches(db, buildSaleInsertRows(parsed.saleRecords, importId));

    await db
      .update(compImports)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(compImports.status, "active"), ne(compImports.id, importId)));

    await db
      .update(compImports)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(compImports.id, importId));

    const createdRows = await db.select().from(compImports).where(eq(compImports.id, importId)).limit(1);
    const created = createdRows[0];
    if (!created) {
      throw new Error("Comp import was created but could not be reloaded.");
    }

    return {
      importId: created.id,
      workbookName: created.workbookName,
      canonicalLeaseSheet: created.canonicalLeaseSheet,
      canonicalSaleSheet: created.canonicalSaleSheet,
      leaseCount: created.leaseCount,
      saleCount: created.saleCount,
      sourceFilename: created.sourceFilename,
      createdAt: created.createdAt,
    } satisfies CompImportSummary;
  } catch (error) {
    await db.delete(leaseComps).where(eq(leaseComps.importId, importId));
    await db.delete(saleComps).where(eq(saleComps.importId, importId));
    await db
      .update(compImports)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(compImports.id, importId));
    throw error;
  }
}

export async function searchCompRows(params: {
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
  compType: CompType;
  importId: number;
  filters: CompSearchFilters;
}) {
  const { db, compType, importId, filters } = params;
  const limit = Math.max(1, filters.limit);
  const offset = Math.max(0, filters.offset ?? 0);
  const queryText = normalizeFilterText(filters.query);
  const city = normalizeFilterText(filters.city);
  const market = normalizeFilterText(filters.market);
  const subMarket = normalizeFilterText(filters.subMarket);
  const propertyType = normalizeFilterText(filters.propertyType);
  const dateFrom = normalizeFilterText(filters.dateFrom);
  const dateTo = normalizeFilterText(filters.dateTo);

  if (compType === "lease") {
    const conditions = [eq(leaseComps.importId, importId)];
    if (queryText) {
      conditions.push(
        or(
          like(leaseComps.address, `%${queryText}%`),
          like(leaseComps.projectName, `%${queryText}%`),
          like(leaseComps.city, `%${queryText}%`),
          like(leaseComps.market, `%${queryText}%`),
          like(leaseComps.subMarket, `%${queryText}%`),
          like(leaseComps.propertyType, `%${queryText}%`)
        )!
      );
    }
    if (city) conditions.push(eq(leaseComps.city, city));
    if (market) conditions.push(eq(leaseComps.market, market));
    if (subMarket) conditions.push(eq(leaseComps.subMarket, subMarket));
    if (propertyType) conditions.push(eq(leaseComps.propertyType, propertyType));
    if (dateFrom) conditions.push(gte(leaseComps.transactionDate, dateFrom));
    if (dateTo) conditions.push(lte(leaseComps.transactionDate, dateTo));

    const whereClause = and(...conditions);
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(leaseComps)
      .where(whereClause);

    const total = numberFromCount(countRows[0]?.count);
    const rows = await db
      .select()
      .from(leaseComps)
      .where(whereClause)
      .orderBy(desc(leaseComps.transactionDate), desc(leaseComps.id))
      .limit(limit)
      .offset(offset);

    const results = rows.map(mapLeaseSearchResult);
    return {
      results,
      total,
      offset,
      limit,
      hasNext: offset + results.length < total,
      hasPrevious: offset > 0,
    };
  }

  const conditions = [eq(saleComps.importId, importId)];
  if (queryText) {
    conditions.push(
      or(
        like(saleComps.address, `%${queryText}%`),
        like(saleComps.projectName, `%${queryText}%`),
        like(saleComps.city, `%${queryText}%`),
        like(saleComps.market, `%${queryText}%`),
        like(saleComps.subMarket, `%${queryText}%`),
        like(saleComps.propertyType, `%${queryText}%`)
      )!
    );
  }
  if (city) conditions.push(eq(saleComps.city, city));
  if (market) conditions.push(eq(saleComps.market, market));
  if (subMarket) conditions.push(eq(saleComps.subMarket, subMarket));
  if (propertyType) conditions.push(eq(saleComps.propertyType, propertyType));
  if (dateFrom) conditions.push(gte(saleComps.transactionDate, dateFrom));
  if (dateTo) conditions.push(lte(saleComps.transactionDate, dateTo));

  const whereClause = and(...conditions);
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(saleComps)
    .where(whereClause);

  const total = numberFromCount(countRows[0]?.count);
  const rows = await db
    .select()
    .from(saleComps)
    .where(whereClause)
    .orderBy(desc(saleComps.transactionDate), desc(saleComps.id))
    .limit(limit)
    .offset(offset);

  const results = rows.map(mapSaleSearchResult);
  return {
    results,
    total,
    offset,
    limit,
    hasNext: offset + results.length < total,
    hasPrevious: offset > 0,
  };
}
