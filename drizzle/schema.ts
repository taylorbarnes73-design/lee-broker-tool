import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tracks uploaded documents (listing agreements, agency disclosures, etc.)
 * File bytes live in S3; this table stores metadata and the S3 URL.
 */
export const uploads = mysqlTable("uploads", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique storage key used to reference the file in S3 */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** Public CDN URL returned by storagePut */
  url: text("url").notNull(),
  /** Original filename from the browser */
  filename: varchar("filename", { length: 255 }).notNull(),
  /** MIME type e.g. application/pdf, image/jpeg */
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  /** File size in bytes */
  fileSize: int("fileSize").notNull(),
  /** Category tag: listing_agreement | agency_disclosure | voucher_doc | comp_doc | other */
  category: varchar("category", { length: 64 }).notNull().default("other"),
  /** Optional: property address or submission reference this file belongs to */
  reference: varchar("reference", { length: 512 }),
  /** Optional: uploader name (broker) */
  uploaderName: varchar("uploaderName", { length: 128 }),
  /** Optional: owning broker identity */
  uploaderOpenId: varchar("uploaderOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = typeof uploads.$inferInsert;

/**
 * Stores form submissions from all 4 broker tool tabs.
 * The full form payload is stored as JSON in the payload column.
 */
export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  /** Which form was submitted: listing | voucher | sign-request | comp */
  formType: varchar("formType", { length: 32 }).notNull(),
  /** Workflow status used by the admin portal */
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  /** Full JSON payload of the submitted form */
  payload: text("payload"),
  /** Property address or other reference string */
  reference: varchar("reference", { length: 512 }),
  /** Name of the submitting broker/agent */
  submittedBy: varchar("submittedBy", { length: 128 }),
  /** Stable owner identity used to scope broker access */
  submittedByOpenId: varchar("submittedByOpenId", { length: 64 }),
  /** Broker email snapshot for convenience */
  submittedByEmail: varchar("submittedByEmail", { length: 320 }),
  /** Archived submission PDF storage key */
  pdfFileKey: varchar("pdfFileKey", { length: 512 }),
  /** Archived submission PDF URL */
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

/**
 * Tracks workbook imports for comp reporting so the app can search against
 * a known active dataset and preserve import history.
 */
export const compImports = mysqlTable("compImports", {
  id: int("id").autoincrement().primaryKey(),
  sourceFileKey: varchar("sourceFileKey", { length: 512 }),
  sourceUrl: text("sourceUrl"),
  sourceFilename: varchar("sourceFilename", { length: 255 }),
  workbookName: varchar("workbookName", { length: 255 }).notNull(),
  canonicalLeaseSheet: varchar("canonicalLeaseSheet", { length: 128 }).notNull(),
  canonicalSaleSheet: varchar("canonicalSaleSheet", { length: 128 }).notNull(),
  leaseCount: int("leaseCount").notNull().default(0),
  saleCount: int("saleCount").notNull().default(0),
  status: mysqlEnum("status", ["active", "archived", "failed"]).notNull().default("active"),
  importedByOpenId: varchar("importedByOpenId", { length: 64 }),
  importedByEmail: varchar("importedByEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompImport = typeof compImports.$inferSelect;
export type InsertCompImport = typeof compImports.$inferInsert;

/**
 * Searchable lease comp rows imported from the canonical workbook sheet.
 * The full normalized row is preserved in rawPayload for report rendering.
 */
export const leaseComps = mysqlTable("leaseComps", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull(),
  externalId: int("externalId"),
  sourceSheet: varchar("sourceSheet", { length: 128 }).notNull(),
  address: varchar("address", { length: 512 }).notNull().default(""),
  city: varchar("city", { length: 128 }).notNull().default(""),
  state: varchar("state", { length: 32 }).notNull().default(""),
  zipCode: varchar("zipCode", { length: 32 }).notNull().default(""),
  market: varchar("market", { length: 128 }).notNull().default(""),
  subMarket: varchar("subMarket", { length: 128 }).notNull().default(""),
  projectName: varchar("projectName", { length: 255 }).notNull().default(""),
  propertyType: varchar("propertyType", { length: 128 }).notNull().default(""),
  propertySubType: varchar("propertySubType", { length: 128 }).notNull().default(""),
  transactionDate: varchar("transactionDate", { length: 32 }).notNull().default(""),
  listingBroker: varchar("listingBroker", { length: 255 }).notNull().default(""),
  procuringBroker: varchar("procuringBroker", { length: 255 }).notNull().default(""),
  source: varchar("source", { length: 128 }).notNull().default(""),
  rawPayload: text("rawPayload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeaseComp = typeof leaseComps.$inferSelect;
export type InsertLeaseComp = typeof leaseComps.$inferInsert;

/**
 * Searchable sale comp rows imported from the canonical workbook sheet.
 * The full normalized row is preserved in rawPayload for report rendering.
 */
export const saleComps = mysqlTable("saleComps", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull(),
  externalId: int("externalId"),
  sourceSheet: varchar("sourceSheet", { length: 128 }).notNull(),
  address: varchar("address", { length: 512 }).notNull().default(""),
  city: varchar("city", { length: 128 }).notNull().default(""),
  state: varchar("state", { length: 32 }).notNull().default(""),
  zipCode: varchar("zipCode", { length: 32 }).notNull().default(""),
  market: varchar("market", { length: 128 }).notNull().default(""),
  subMarket: varchar("subMarket", { length: 128 }).notNull().default(""),
  projectName: varchar("projectName", { length: 255 }).notNull().default(""),
  propertyType: varchar("propertyType", { length: 128 }).notNull().default(""),
  propertySubType: varchar("propertySubType", { length: 128 }).notNull().default(""),
  transactionDate: varchar("transactionDate", { length: 32 }).notNull().default(""),
  listingBroker: varchar("listingBroker", { length: 255 }).notNull().default(""),
  procuringBroker: varchar("procuringBroker", { length: 255 }).notNull().default(""),
  source: varchar("source", { length: 128 }).notNull().default(""),
  rawPayload: text("rawPayload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SaleComp = typeof saleComps.$inferSelect;
export type InsertSaleComp = typeof saleComps.$inferInsert;
