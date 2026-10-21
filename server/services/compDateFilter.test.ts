import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { leaseComps, saleComps } from "../../drizzle/schema";
import { getDb } from "../db";
import { searchCompRows } from "./compData";

const IMPORT_ID = 987_654_321;

function isLocalDatabase(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

const hasDatabase = isLocalDatabase(process.env.DATABASE_URL);

const leaseTableSql = sql.raw(`
  CREATE TABLE IF NOT EXISTS leaseComps (
    id int AUTO_INCREMENT PRIMARY KEY,
    importId int NOT NULL,
    externalId int NULL,
    sourceSheet varchar(128) NOT NULL,
    address varchar(512) NOT NULL DEFAULT '',
    city varchar(128) NOT NULL DEFAULT '',
    state varchar(32) NOT NULL DEFAULT '',
    zipCode varchar(32) NOT NULL DEFAULT '',
    market varchar(128) NOT NULL DEFAULT '',
    subMarket varchar(128) NOT NULL DEFAULT '',
    projectName varchar(255) NOT NULL DEFAULT '',
    propertyType varchar(128) NOT NULL DEFAULT '',
    propertySubType varchar(128) NOT NULL DEFAULT '',
    transactionDate varchar(32) NOT NULL DEFAULT '',
    listingBroker varchar(255) NOT NULL DEFAULT '',
    procuringBroker varchar(255) NOT NULL DEFAULT '',
    source varchar(128) NOT NULL DEFAULT '',
    rawPayload text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const saleTableSql = sql.raw(`
  CREATE TABLE IF NOT EXISTS saleComps (
    id int AUTO_INCREMENT PRIMARY KEY,
    importId int NOT NULL,
    externalId int NULL,
    sourceSheet varchar(128) NOT NULL,
    address varchar(512) NOT NULL DEFAULT '',
    city varchar(128) NOT NULL DEFAULT '',
    state varchar(32) NOT NULL DEFAULT '',
    zipCode varchar(32) NOT NULL DEFAULT '',
    market varchar(128) NOT NULL DEFAULT '',
    subMarket varchar(128) NOT NULL DEFAULT '',
    projectName varchar(255) NOT NULL DEFAULT '',
    propertyType varchar(128) NOT NULL DEFAULT '',
    propertySubType varchar(128) NOT NULL DEFAULT '',
    transactionDate varchar(32) NOT NULL DEFAULT '',
    listingBroker varchar(255) NOT NULL DEFAULT '',
    procuringBroker varchar(255) NOT NULL DEFAULT '',
    source varchar(128) NOT NULL DEFAULT '',
    rawPayload text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

function payload(address: string, transactionDate: string) {
  return JSON.stringify({
    address,
    city: "Irvine",
    state: "CA",
    projectName: address,
    transactionDate,
    propertyType: "Industrial",
    source: "test",
  });
}

describe.skipIf(!hasDatabase)("comp transaction date filter", () => {
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(leaseComps)
      .where(sql`${leaseComps.importId} = ${IMPORT_ID}`);
    await db.delete(saleComps).where(sql`${saleComps.importId} = ${IMPORT_ID}`);
  });

  it("keeps importer ISO dates and legacy MM/DD/YYYY rows inside the selected range", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    await db.execute(leaseTableSql);
    await db.execute(saleTableSql);
    await db
      .delete(leaseComps)
      .where(sql`${leaseComps.importId} = ${IMPORT_ID}`);
    await db.delete(saleComps).where(sql`${saleComps.importId} = ${IMPORT_ID}`);

    await db.insert(leaseComps).values([
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Iso Lease",
        transactionDate: "2026-02-10",
        rawPayload: payload("Iso Lease", "2026-02-10"),
      },
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Legacy Lease",
        transactionDate: "02/10/2025",
        rawPayload: payload("Legacy Lease", "2025-02-10"),
      },
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Outside Lease",
        transactionDate: "2024-01-15",
        rawPayload: payload("Outside Lease", "2024-01-15"),
      },
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Undated Lease",
        transactionDate: "",
        rawPayload: payload("Undated Lease", ""),
      },
    ]);

    await db.insert(saleComps).values([
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Iso Sale",
        transactionDate: "2026-06-01",
        rawPayload: payload("Iso Sale", "2026-06-01"),
      },
      {
        importId: IMPORT_ID,
        sourceSheet: "test",
        address: "Legacy Sale",
        transactionDate: "6/15/2025",
        rawPayload: payload("Legacy Sale", "2025-06-15"),
      },
    ]);

    const filters = { dateFrom: "2025-01-01", dateTo: "2026-12-31", limit: 20 };
    const lease = await searchCompRows({
      db,
      compType: "lease",
      importId: IMPORT_ID,
      filters,
    });
    const sale = await searchCompRows({
      db,
      compType: "sale",
      importId: IMPORT_ID,
      filters,
    });

    expect(lease.results.map(row => row.address).sort()).toEqual([
      "Iso Lease",
      "Legacy Lease",
    ]);
    expect(lease.total).toBe(2);
    expect(sale.results.map(row => row.address).sort()).toEqual([
      "Iso Sale",
      "Legacy Sale",
    ]);
    expect(sale.total).toBe(2);
  });
});
