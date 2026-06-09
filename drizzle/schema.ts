import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  datetime,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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
 * UUID-backed directory users (separate from legacy `users` / openId auth).
 */
export const appUsers = mysqlTable(
  "app_users",
  {
    id: char("id", { length: 36 }).notNull().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["admin", "broker", "readonly"]).notNull().default("broker"),
    office: varchar("office", { length: 255 }),
    phone: varchar("phone", { length: 64 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    forcePasswordChangeNextLogin: boolean("force_password_change_next_login").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    createdBy: char("created_by", { length: 36 }),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    deactivatedAt: datetime("deactivated_at", { mode: "date", fsp: 3 }),
    /** Encrypted Dealius login email (per-user, optional). */
    dealiusUsername: varchar("dealius_username", { length: 320 }),
    /** AES-GCM envelope JSON for Dealius password (per-user, optional). */
    dealiusPasswordEnc: json("dealius_password_enc"),
  },
  table => ({
    emailUnique: uniqueIndex("app_users_email_unique").on(table.email),
    usernameUnique: uniqueIndex("app_users_username_unique").on(table.username),
    createdByFk: foreignKey({
      columns: [table.createdBy],
      foreignColumns: [table.id],
      name: "app_users_created_by_fk",
    }).onDelete("set null"),
    emailLowerCheck: check("app_users_email_lowercase", sql`email = LOWER(email)`),
    usernameLowerCheck: check("app_users_username_lowercase", sql`username = LOWER(username)`),
  })
);

export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

/**
 * Server-side session rows for app_users (token stored as hash only).
 */
export const appSessions = mysqlTable(
  "sessions",
  {
    id: char("id", { length: 36 }).notNull().primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
  },
  table => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [appUsers.id],
      name: "sessions_user_id_fk",
    }).onDelete("cascade"),
    tokenHashIdx: index("sessions_token_hash_idx").on(table.tokenHash),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  })
);

export type AppSession = typeof appSessions.$inferSelect;
export type InsertAppSession = typeof appSessions.$inferInsert;

/**
 * Key/value application configuration (JSON values).
 */
export const appSettings = mysqlTable(
  "app_settings",
  {
    key: varchar("key", { length: 255 }).notNull().primaryKey(),
    value: json("value").notNull(),
    description: text("description"),
    category: mysqlEnum("category", [
      "branding",
      "notifications",
      "integrations",
      "workflow",
      "security",
    ]).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedBy: char("updated_by", { length: 36 }),
  },
  table => ({
    updatedByFk: foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [appUsers.id],
      name: "app_settings_updated_by_fk",
    }).onDelete("set null"),
  })
);

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * Append-only audit trail for admin and security events.
 */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: char("id", { length: 36 }).notNull().primaryKey(),
    userId: char("user_id", { length: 36 }),
    action: varchar("action", { length: 128 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 255 }),
    metadata: json("metadata")
      .notNull()
      .default(sql`(JSON_OBJECT())`),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [appUsers.id],
      name: "audit_log_user_id_fk",
    }).onDelete("set null"),
    createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
    userIdIdx: index("audit_log_user_id_idx").on(table.userId),
  })
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type InsertAuditLogRow = typeof auditLog.$inferInsert;

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
  /** Where the submission came from: "tool" (default), "email_ingest", "email_ingest_backfill", or "manual". */
  source: varchar("source", { length: 32 }).notNull().default("tool"),
  /** Graph/Outlook message id when source is an email ingest. */
  sourceEmailMessageId: varchar("source_email_message_id", { length: 512 }),
  /** Outlook deep link when source is an email ingest. */
  sourceEmailWebLink: text("source_email_web_link"),
  /** Smart-parsed structured fields when source is an email ingest. */
  parsedFields: json("parsed_fields"),
  /** Display name of the admin who claimed / started work on this submission. */
  assignedTo: varchar("assignedTo", { length: 128 }),
  /** Stable identity (openId) of the admin who claimed this submission. */
  assignedToOpenId: varchar("assignedToOpenId", { length: 64 }),
  /** Timestamp when the submission was claimed (status moved to in_review). */
  assignedAt: timestamp("assignedAt"),
  /** Display name of the admin who marked this submission complete. */
  completedBy: varchar("completedBy", { length: 128 }),
  /** Timestamp when the submission was marked complete. */
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  statusCreatedAtIdIdx: index("submissions_status_createdAt_id_idx").on(
    table.status,
    table.createdAt,
    table.id
  ),
  brokerStatusCreatedAtIdIdx: index("submissions_broker_status_createdAt_id_idx").on(
    table.submittedByOpenId,
    table.status,
    table.createdAt,
    table.id
  ),
  sourceEmailMessageIdIdx: index("submissions_source_email_message_id_idx").on(
    table.sourceEmailMessageId
  ),
}));

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

/**
 * Broker Admin shared-inbox requests.
 *
 * Trackable request record created for each inbound email that hits the
 * Broker Admin shared mailbox via Power Automate.
 *
 * Attachments are stored in S3 and tracked via `uploads` with:
 *   reference = `brokerAdminRequest:<id>`
 */
export const brokerAdminRequests = mysqlTable(
  "brokerAdminRequests",
  {
    id: int("id").autoincrement().primaryKey(),

    // Intake metadata
    title: varchar("title", { length: 512 }).notNull().default(""),
    receivedAt: timestamp("receivedAt"),
    fromEmail: varchar("fromEmail", { length: 320 }),

    // Classification / routing
    category: varchar("category", { length: 64 }),
    confidential: int("confidential").notNull().default(0),
    systemImpact: text("systemImpact"), // JSON string
    owner: varchar("owner", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    dueDate: timestamp("dueDate"),
    priority: varchar("priority", { length: 16 }),

    // Thread / source linking
    // Microsoft Graph / Outlook message identifiers are commonly >256 chars.
    emailMessageId: varchar("emailMessageId", { length: 512 }).notNull(),
    internetMessageId: varchar("internetMessageId", { length: 512 }),
    outlookWebLink: text("outlookWebLink"),
    threadKey: varchar("threadKey", { length: 512 }),

    // External system mapping
    dealiusDealId: varchar("dealiusDealId", { length: 64 }),
    dealiusListingId: varchar("dealiusListingId", { length: 64 }),
    docusignEnvelopeId: varchar("docusignEnvelopeId", { length: 128 }),
    matchStatus: mysqlEnum("matchStatus", ["matched", "needs_match"]).default("matched").notNull(),

    // Convenience
    reference: varchar("reference", { length: 512 }),
    bodyPreview: text("bodyPreview"),
    attachmentsSummary: text("attachmentsSummary"),
    notes: text("notes"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    statusCreatedAtIdIdx: index("bar_status_createdAt_id_idx").on(table.status, table.createdAt, table.id),
    emailMessageIdIdx: index("bar_emailMessageId_idx").on(table.emailMessageId),
    docusignEnvelopeIdIdx: index("bar_docusignEnvelopeId_idx").on(table.docusignEnvelopeId),
  })
);

export type BrokerAdminRequest = typeof brokerAdminRequests.$inferSelect;
export type InsertBrokerAdminRequest = typeof brokerAdminRequests.$inferInsert;

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

/**
 * Dedupe + observability log for the BrokerAdmin email ingest pipeline.
 * Each Graph message processed yields one row; submission_id is null if filtered out.
 */
export const emailIngestLog = mysqlTable(
  "email_ingest_log",
  {
    id: int("id").autoincrement().primaryKey(),
    messageId: varchar("message_id", { length: 512 }).notNull(),
    internetMessageId: varchar("internet_message_id", { length: 512 }),
    threadId: varchar("thread_id", { length: 512 }),
    receivedAt: datetime("received_at", { mode: "date", fsp: 3 }),
    fromEmail: varchar("from_email", { length: 320 }),
    toEmails: json("to_emails"),
    ccEmails: json("cc_emails"),
    subject: varchar("subject", { length: 1024 }),
    submissionId: int("submission_id"),
    ingestStatus: varchar("ingest_status", { length: 32 }).notNull().default("imported"),
    errorMessage: text("error_message"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => ({
    messageIdUnique: uniqueIndex("email_ingest_log_message_id_unique").on(table.messageId),
    internetMessageIdUnique: uniqueIndex("email_ingest_log_internet_message_id_unique").on(
      table.internetMessageId
    ),
    receivedAtIdx: index("eil_received_at_idx").on(table.receivedAt),
    ingestStatusIdx: index("eil_ingest_status_idx").on(table.ingestStatus),
  })
);

export type EmailIngestLogRow = typeof emailIngestLog.$inferSelect;
export type InsertEmailIngestLogRow = typeof emailIngestLog.$inferInsert;

/**
 * Small key/value scratchpad for non-setting state (e.g. last poll timestamp).
 */
export const kvState = mysqlTable("kv_state", {
  key: varchar("key", { length: 255 }).notNull().primaryKey(),
  value: json("value").notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export type KvStateRow = typeof kvState.$inferSelect;
export type InsertKvStateRow = typeof kvState.$inferInsert;
