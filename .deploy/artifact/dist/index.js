var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
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
  varchar
} from "drizzle-orm/mysql-core";
var users, appUsers, appSessions, appSettings, auditLog, uploads, submissions, brokerAdminRequests, compImports, leaseComps, saleComps;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    appUsers = mysqlTable(
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
        createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(sql`(UTC_TIMESTAMP(3))`),
        createdBy: char("created_by", { length: 36 }),
        updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull().default(sql`(UTC_TIMESTAMP(3))`),
        deactivatedAt: datetime("deactivated_at", { mode: "date", fsp: 3 })
      },
      (table) => ({
        emailUnique: uniqueIndex("app_users_email_unique").on(table.email),
        usernameUnique: uniqueIndex("app_users_username_unique").on(table.username),
        createdByFk: foreignKey({
          columns: [table.createdBy],
          foreignColumns: [table.id],
          name: "app_users_created_by_fk"
        }).onDelete("set null"),
        emailLowerCheck: check("app_users_email_lowercase", sql`email = LOWER(email)`),
        usernameLowerCheck: check("app_users_username_lowercase", sql`username = LOWER(username)`)
      })
    );
    appSessions = mysqlTable(
      "sessions",
      {
        id: char("id", { length: 36 }).notNull().primaryKey(),
        userId: char("user_id", { length: 36 }).notNull(),
        tokenHash: varchar("token_hash", { length: 255 }).notNull(),
        expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
        createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(sql`(UTC_TIMESTAMP(3))`),
        ipAddress: varchar("ip_address", { length: 45 }),
        userAgent: varchar("user_agent", { length: 512 })
      },
      (table) => ({
        userFk: foreignKey({
          columns: [table.userId],
          foreignColumns: [appUsers.id],
          name: "sessions_user_id_fk"
        }).onDelete("cascade"),
        tokenHashIdx: index("sessions_token_hash_idx").on(table.tokenHash),
        userIdIdx: index("sessions_user_id_idx").on(table.userId)
      })
    );
    appSettings = mysqlTable(
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
          "security"
        ]).notNull(),
        updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull().default(sql`(UTC_TIMESTAMP(3))`),
        updatedBy: char("updated_by", { length: 36 })
      },
      (table) => ({
        updatedByFk: foreignKey({
          columns: [table.updatedBy],
          foreignColumns: [appUsers.id],
          name: "app_settings_updated_by_fk"
        }).onDelete("set null")
      })
    );
    auditLog = mysqlTable(
      "audit_log",
      {
        id: char("id", { length: 36 }).notNull().primaryKey(),
        userId: char("user_id", { length: 36 }),
        action: varchar("action", { length: 128 }).notNull(),
        targetType: varchar("target_type", { length: 64 }),
        targetId: varchar("target_id", { length: 255 }),
        metadata: json("metadata").notNull().default(sql`(JSON_OBJECT())`),
        ipAddress: varchar("ip_address", { length: 45 }),
        createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(sql`(UTC_TIMESTAMP(3))`)
      },
      (table) => ({
        userFk: foreignKey({
          columns: [table.userId],
          foreignColumns: [appUsers.id],
          name: "audit_log_user_id_fk"
        }).onDelete("set null"),
        createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
        userIdIdx: index("audit_log_user_id_idx").on(table.userId)
      })
    );
    uploads = mysqlTable("uploads", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    submissions = mysqlTable("submissions", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
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
      )
    }));
    brokerAdminRequests = mysqlTable(
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
        systemImpact: text("systemImpact"),
        // JSON string
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
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
      },
      (table) => ({
        statusCreatedAtIdIdx: index("bar_status_createdAt_id_idx").on(table.status, table.createdAt, table.id),
        emailMessageIdIdx: index("bar_emailMessageId_idx").on(table.emailMessageId),
        docusignEnvelopeIdIdx: index("bar_docusignEnvelopeId_idx").on(table.docusignEnvelopeId)
      })
    );
    compImports = mysqlTable("compImports", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    leaseComps = mysqlTable("leaseComps", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    saleComps = mysqlTable("saleComps", {
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
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createDatabasePool: () => createDatabasePool,
  getDatabasePoolConfig: () => getDatabasePoolConfig,
  getDb: () => getDb,
  getUserByOpenId: () => getUserByOpenId,
  upsertUser: () => upsertUser
});
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}
function resolveSslOptions(hostname) {
  const sslMode = (process.env.DATABASE_SSL_MODE ?? "").trim().toLowerCase();
  const rejectUnauthorized = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? "").trim().toLowerCase() !== "false";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (sslMode === "disabled") return void 0;
  if (sslMode === "require") {
    return { rejectUnauthorized };
  }
  if (process.env.NODE_ENV === "production" && !isLocalHost) {
    return { rejectUnauthorized };
  }
  return void 0;
}
function getDatabasePoolConfig() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  const parsed = new URL(connectionString);
  const database = parsed.pathname.replace(/^\//, "");
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? "10"),
    queueLimit: 0,
    ssl: resolveSslOptions(parsed.hostname)
  };
}
function createDatabasePool() {
  const config = getDatabasePoolConfig();
  if (!config) return null;
  return createPool(config);
}
async function getDb() {
  if (!_db && getDatabaseUrl()) {
    try {
      _pool = createDatabasePool();
      if (!_pool) return null;
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
var _db, _pool;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    _db = null;
    _pool = null;
  }
});

// server/_core/index.ts
import "dotenv/config";
import { webcrypto as webcrypto2 } from "node:crypto";
import express2 from "express";
import fs4 from "node:fs";
import path3 from "node:path";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";

// server/_core/installCrypto.ts
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

// server/_core/sdk.ts
init_db();
import { SignJWT, jwtVerify } from "jose";

// server/_core/env.ts
var ENV = {
  // Public OAuth app metadata used by the custom OAuth service
  appId: process.env.VITE_APP_ID ?? process.env.APP_ID ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? "",
  // AWS identity configuration for future Cognito-based auth
  awsRegion: process.env.AWS_REGION ?? "",
  awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID ?? "",
  awsCognitoClientId: process.env.AWS_COGNITO_CLIENT_ID ?? "",
  awsCognitoDomain: process.env.AWS_COGNITO_DOMAIN ?? "",
  // Session / cookies
  cookieSecret: process.env.JWT_SECRET ?? "",
  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Owner identity subject / openId for the admin user
  ownerOpenId: process.env.OWNER_OPEN_ID ?? process.env.OWNER_USER_ID ?? "",
  // Runtime
  isProduction: process.env.NODE_ENV === "production",
  // Built-in Forge proxy backing storage, LLM, maps, and other managed services
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Google Maps (server-side only). Used to proxy Street View/static map assets so the key
  // is never exposed to the browser.
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  // Direct OpenAI fallback (used when Forge is not configured).
  // The LLM layer prefers Forge when set; otherwise falls back to OPENAI_API_KEY.
  openaiApiUrl: (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  // AWS storage placeholders for future direct-S3 integration
  awsS3Bucket: process.env.AWS_S3_BUCKET ?? "",
  awsS3Region: process.env.AWS_S3_REGION ?? process.env.AWS_REGION ?? "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  // Admin
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  // Sign request vendor
  cimarronEmail: process.env.CIMARRON_EMAIL ?? "",
  // Dealius (server-to-server integration)
  // Base URL should NOT include trailing slash, e.g. https://leenewportbeach.dealius.com
  dealiusBaseUrl: (process.env.DEALIUS_BASE_URL ?? "https://leenewportbeach.dealius.com").replace(/\/$/, ""),
  // Service credentials used when brokers do not provide per-user credentials.
  dealiusEmail: process.env.DEALIUS_EMAIL ?? "",
  dealiusPassword: process.env.DEALIUS_PASSWORD ?? "",
  /** Optional path to Dealius **Users** report (.xlsx) or JSON roster — improves `/brokers` matching on deal push. */
  dealiusUsersDirectory: process.env.DEALIUS_USERS_DIRECTORY ?? "",
  // SMTP email delivery for reliable PDF attachments
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpSecure: (process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? process.env.ADMIN_EMAIL ?? "",
  // Local broker auth
  localAuthEnabled: (process.env.LOCAL_AUTH_ENABLED ?? "").toLowerCase() === "true" || !(process.env.OAUTH_SERVER_URL || process.env.VITE_OAUTH_PORTAL_URL),
  localAuthEmailDomain: process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "",
  localAdminEmails: (process.env.LOCAL_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  localAdminNames: (process.env.LOCAL_ADMIN_NAMES ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
};

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var LOCAL_OPEN_ID_PREFIX = "local:";
var normalizeEmail = (value) => value.trim().toLowerCase();
var toLocalOpenId = (email) => `${LOCAL_OPEN_ID_PREFIX}${normalizeEmail(email)}`;
var isLocalOpenId = (openId) => openId.startsWith(LOCAL_OPEN_ID_PREFIX);
var emailFromLocalOpenId = (openId) => isLocalOpenId(openId) ? openId.slice(LOCAL_OPEN_ID_PREFIX.length) : null;
function isAdminName(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  return normalized === "errissa kat" || normalized === "taylor barnes";
}
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT")) return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first2 = Array.from(set)[0];
    return first2 ? first2.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret || (ENV.isProduction ? "" : "dev-local-broker-tool-secret");
    return new TextEncoder().encode(secret);
  }
  getSessionAppId() {
    return ENV.appId || "lee-broker-tool";
  }
  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: this.getSessionAppId(),
        name: options.name || "",
        email: options.email
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      email: payload.email
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name, email } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name,
        email: isNonEmptyString(email) ? email : void 0
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (isLocalOpenId(sessionUserId)) {
      const email = session.email ?? emailFromLocalOpenId(sessionUserId);
      if (!user) {
        await upsertUser({
          openId: sessionUserId,
          name: session.name || email || "Broker",
          email: email ?? null,
          loginMethod: "local",
          lastSignedIn: signedInAt,
          role: isAdminName(session.name) ? "admin" : "user"
        });
        user = await getUserByOpenId(sessionUserId);
      }
      if (!user) {
        throw ForbiddenError("Local user not found");
      }
      await upsertUser({
        openId: user.openId,
        name: session.name || user.name,
        email: email ?? user.email,
        loginMethod: "local",
        lastSignedIn: signedInAt,
        role: isAdminName(session.name || user.name) ? "admin" : "user"
      });
      return {
        ...user,
        name: session.name || user.name,
        email: email ?? user.email,
        loginMethod: "local",
        lastSignedIn: signedInAt,
        role: isAdminName(session.name || user.name) ? "admin" : "user"
      };
    }
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
      role: isAdminName(user.name) ? "admin" : "user"
    });
    return {
      ...user,
      role: isAdminName(user.name) ? "admin" : "user"
    };
  }
};
var sdk = new SDKServer();
var localAuth = {
  isEnabled: () => ENV.localAuthEnabled,
  normalizeEmail,
  toLocalOpenId
};

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// shared/brokerDirectory.ts
var brokerDirectory = [
  { id: "1001", name: "Eva Abrego", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "eabrego@lee-associates.com" },
  { id: "1002", name: "Frank Adler", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "fadler@lee-associates.com" },
  { id: "1003", name: "Sean Ahern", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "sahern@lee-associates.com" },
  { id: "1004", name: "Tim Arguello", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "targuello@lee-associates.com" },
  { id: "1005", name: "Taylor Barnes", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "tbarnes@lee-associates.com" },
  { id: "1006", name: "Chris Barnett", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "cbarnett@lee-associates.com" },
  { id: "1007", name: "Brian Barson", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bbarson@lee-associates.com" },
  { id: "1008", name: "David Bolt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "dbolt@lee-associates.com" },
  { id: "1009", name: "Matt Christensen", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mchristensen@lee-associates.com" },
  { id: "1010", name: "Ethan Davidson", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "edavidson@lee-associates.com" },
  { id: "1011", name: "Nick Dumke", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "ndumke@lee-associates.com" },
  { id: "1012", name: "Matt Durkin", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mdurkin@lee-associates.com" },
  { id: "1013", name: "Brian Garbutt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bgarbutt@lee-associates.com" },
  { id: "1014", name: "John Gessford", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jgessford@lee-associates.com" },
  { id: "1015", name: "Libby Gessford", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "lgessford@lee-associates.com" },
  { id: "1016", name: "Pitzer Gills", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "pgills@lee-associates.com" },
  { id: "1017", name: "Ken Gould", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "kgould@lee-associates.com" },
  { id: "1018", name: "Bob Griffin", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bgriffin@lee-associates.com" },
  { id: "1019", name: "Jeff Grijalva", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jgrijalva@lee-associates.com" },
  { id: "1020", name: "Carter Harrington", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "charrington@lee-associates.com" },
  { id: "1021", name: "Judd Hietbrink", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhietbrink@lee-associates.com" },
  { id: "1022", name: "Jeff Hirsch", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhirsch@lee-associates.com" },
  { id: "1023", name: "Jack Hogan", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhogan@lee-associates.com" },
  { id: "1024", name: "David Kluver", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "dkluver@lee-associates.com" },
  { id: "1025", name: "Matt Lawer", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mlawer@lee-associates.com" },
  { id: "1026", name: "Mike Long", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mlong@lee-associates.com" },
  { id: "1027", name: "Steve Madigan", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "smadigan@lee-associates.com" },
  { id: "1028", name: "Gary McArdell", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "gmcardell@lee-associates.com" },
  { id: "1029", name: "Jonathan Mejia", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jmejia@lee-associates.com" },
  { id: "1030", name: "Frank Perkins", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "fperkins@lee-associates.com" },
  { id: "1031", name: "Brad Schneider", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bschneider@lee-associates.com" },
  { id: "1032", name: "Alejandro Sherratt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "asherratt@lee-associates.com" },
  { id: "1033", name: "Brendan Smith", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bsmith@lee-associates.com" },
  { id: "1034", name: "Hayden Toland", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "htoland@lee-associates.com" },
  { id: "1035", name: "Miles Toland", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mtoland@lee-associates.com" },
  { id: "1036", name: "Rick Turner", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "rturner@lee-associates.com" },
  { id: "1037", name: "Tim Walker", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "timwalker@lee-associates.com" },
  { id: "1038", name: "Tom West", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "twest@lee-associates.com" },
  { id: "1039", name: "Charlie Winn", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "cwinn@lee-associates.com" },
  { id: "1040", name: "Maddie Zacher", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mzacher@lee-associates.com" },
  { id: "1041", name: "Shannon Zacher", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "szacher@lee-associates.com" },
  { id: "1042", name: "Errissa Kat", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "ekat@lee-associates.com" },
  { id: "1043", name: "Kelsey Morris", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "kmorris@lee-associates.com" }
];
var brokerDirectoryByEmail = new Map(
  brokerDirectory.map((entry) => [entry.email.toLowerCase(), entry])
);
function findBrokerDirectoryEntry(email) {
  return brokerDirectoryByEmail.get(email.trim().toLowerCase()) ?? null;
}
function isBrokerDirectoryAdmin(entry) {
  if (!entry) return false;
  const roles = entry.roles.toLowerCase();
  return roles.includes("admin") || roles.includes("manager");
}

// server/_core/systemRouter.ts
import { z } from "zod/v4";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const safeDetail = detail.replace(/[\r\n]/g, " ").slice(0, 200);
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${safeDetail ? `: ${safeDetail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function getS3Client() {
  const config = { region: ENV.awsS3Region || ENV.awsRegion };
  if (ENV.awsAccessKeyId && ENV.awsSecretAccessKey) {
    config.credentials = {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey
    };
  }
  return new S3Client(config);
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");
  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
  return { key, url };
}
async function storageGet(relKey) {
  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");
  const key = relKey.replace(/^\/+/, "");
  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
  return { key, url };
}

// server/routers.ts
init_db();
init_schema();
import { desc as desc4 } from "drizzle-orm";
import { z as z9 } from "zod/v4";
import { nanoid as nanoid2 } from "nanoid";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
function resolveBackend() {
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 && ENV.forgeApiKey) {
    return {
      url: `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`,
      key: ENV.forgeApiKey,
      model: "gemini-2.5-flash"
    };
  }
  if (ENV.openaiApiKey) {
    return {
      url: `${ENV.openaiApiUrl}/chat/completions`,
      key: ENV.openaiApiKey,
      model: ENV.openaiModel || "gpt-4.1-mini"
    };
  }
  throw new Error(
    "No LLM backend configured. Set BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY or OPENAI_API_KEY."
  );
}
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  const backend = resolveBackend();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: backend.model,
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = params.maxTokens ?? params.max_tokens ?? 4096;
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(backend.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${backend.key}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/routers/aiAssist.ts
import { z as z3 } from "zod/v4";

// server/settings/settingsStore.ts
init_schema();
init_db();

// server/auth/writeAuditLog.ts
init_schema();
init_db();

// server/auth/requestIp.ts
function getRequestIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

// server/auth/writeAuditLog.ts
async function writeAuditLog(userId, action, targetType, targetId, metadata, req) {
  const db = await getDb();
  if (!db) {
    console.warn("[audit] skipped (no database):", action);
    return;
  }
  const id = crypto.randomUUID();
  const ip = getRequestIp(req);
  try {
    await db.insert(auditLog).values({
      id,
      userId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress: ip
    });
  } catch (error) {
    console.error("[audit] insert failed:", action, error);
  }
}

// server/settings/settingsSchema.ts
import { z as z2 } from "zod/v4";
var hexColor = z2.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a #RRGGBB hex color.").default("#A6192E");
var optionalUrl = z2.preprocess(
  (v) => v === "" || v === void 0 ? null : v,
  z2.union([z2.string().url(), z2.null()]).optional()
);
var hhmm = z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be "HH:MM" in 24h format.').default("08:00");
var testResultSchema = z2.enum(["success", "failed"]).nullable().default(null);
var MASKED_SECRET = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (set)";
var SETTING_KEYS = [
  "branding.company_name",
  "branding.support_email",
  "branding.logo_url",
  "branding.primary_color",
  "branding.letterhead_template_url",
  "workflow.confidential_warning_enabled",
  "workflow.confidential_warning_text",
  "workflow.auto_save_interval_seconds",
  "workflow.default_listing_term_months",
  "workflow.commission_split_must_sum_100",
  "workflow.require_voucher_attachment",
  "notifications.email_on_submission",
  "notifications.email_on_status_change",
  "notifications.email_on_dealius_success",
  "notifications.admin_digest_enabled",
  "notifications.admin_digest_time",
  "integrations.dealius.username",
  "integrations.dealius.password",
  "integrations.dealius.last_test_at",
  "integrations.dealius.last_test_result",
  "security.session_timeout_hours"
];
var defs = [
  {
    key: "branding.company_name",
    category: "branding",
    sensitive: false,
    valueSchema: z2.string().min(1).max(100),
    defaultValue: "Lee & Associates Newport Beach",
    description: "Public-facing company name"
  },
  {
    key: "branding.support_email",
    category: "branding",
    sensitive: false,
    valueSchema: z2.string().email(),
    defaultValue: "tbarnes@lee-associates.com"
  },
  {
    key: "branding.logo_url",
    category: "branding",
    sensitive: false,
    valueSchema: optionalUrl,
    defaultValue: null
  },
  {
    key: "branding.primary_color",
    category: "branding",
    sensitive: false,
    valueSchema: hexColor,
    defaultValue: "#A6192E"
  },
  {
    key: "branding.letterhead_template_url",
    category: "branding",
    sensitive: false,
    valueSchema: optionalUrl,
    defaultValue: null
  },
  {
    key: "workflow.confidential_warning_enabled",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "workflow.confidential_warning_text",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.string().min(1).max(2e3),
    defaultValue: "Confidential deals follow restricted handling per the deal team's instructions."
  },
  {
    key: "workflow.auto_save_interval_seconds",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.coerce.number().int().min(10).max(300),
    defaultValue: 30
  },
  {
    key: "workflow.default_listing_term_months",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.coerce.number().int().min(1).max(60),
    defaultValue: 12
  },
  {
    key: "workflow.commission_split_must_sum_100",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "workflow.require_voucher_attachment",
    category: "workflow",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "notifications.email_on_submission",
    category: "notifications",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "notifications.email_on_status_change",
    category: "notifications",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "notifications.email_on_dealius_success",
    category: "notifications",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: true
  },
  {
    key: "notifications.admin_digest_enabled",
    category: "notifications",
    sensitive: false,
    valueSchema: z2.boolean(),
    defaultValue: false
  },
  {
    key: "notifications.admin_digest_time",
    category: "notifications",
    sensitive: false,
    valueSchema: hhmm,
    defaultValue: "08:00"
  },
  {
    key: "integrations.dealius.username",
    category: "integrations",
    sensitive: true,
    valueSchema: z2.string().max(320),
    defaultValue: ""
  },
  {
    key: "integrations.dealius.password",
    category: "integrations",
    sensitive: true,
    valueSchema: z2.string().max(512),
    defaultValue: ""
  },
  {
    key: "integrations.dealius.last_test_at",
    category: "integrations",
    sensitive: false,
    valueSchema: z2.union([z2.string().min(4), z2.null()]),
    defaultValue: null
  },
  {
    key: "integrations.dealius.last_test_result",
    category: "integrations",
    sensitive: false,
    valueSchema: testResultSchema,
    defaultValue: null
  },
  {
    key: "security.session_timeout_hours",
    category: "security",
    sensitive: false,
    valueSchema: z2.coerce.number().int().min(1).max(72),
    defaultValue: 12
  }
];
var SETTINGS_BY_KEY = Object.fromEntries(defs.map((d) => [d.key, d]));
var SETTINGS_KEYS_SET = new Set(SETTING_KEYS);
function isSettingKey(key) {
  return SETTINGS_KEYS_SET.has(key);
}

// server/settings/settingsEncryption.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
var ALGO = "aes-256-gcm";
var IV_LEN = 12;
var TAG_LEN = 16;
var ephemeralKeyPrinted = false;
var ephemeralKey = null;
function resolveKey32() {
  const env = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!env) {
    if (!ephemeralKey) {
      ephemeralKey = randomBytes(32);
    }
    if (!ephemeralKeyPrinted) {
      console.warn(
        "[settings] SETTINGS_ENCRYPTION_KEY is not set; using an ephemeral in-memory key (settings will not decrypt after restart). Set SETTINGS_ENCRYPTION_KEY to a base64-encoded 32-byte secret."
      );
      ephemeralKeyPrinted = true;
    }
    return ephemeralKey;
  }
  try {
    const buf = Buffer.from(env, "base64");
    if (buf.length === 32) return buf;
  } catch {
  }
  return createHash("sha256").update(env, "utf8").digest();
}
function isEncryptedEnvelope(v) {
  if (!v || typeof v !== "object") return false;
  const o = v;
  return o._v === 1 && typeof o.iv === "string" && typeof o.ct === "string" && typeof o.tag === "string";
}
function encryptSettingPlaintext(plain) {
  const key = resolveKey32();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    _v: 1,
    iv: iv.toString("base64"),
    ct: enc.toString("base64"),
    tag: tag.toString("base64")
  };
}
function decryptSettingEnvelope(env) {
  const key = resolveKey32();
  const iv = Buffer.from(env.iv, "base64");
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]);
  return out.toString("utf8");
}

// server/services/dealiusClient.ts
import axios2 from "axios";

// server/services/dealiusUserDirectory.ts
import fs from "fs";
import XLSX from "xlsx";
function str(v) {
  return String(v ?? "").trim();
}
function num(v) {
  if (v === null || v === void 0 || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number.parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function normDirName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function stripDirectoryDisplayName(raw) {
  return String(raw || "").replace(/\s*\([^)]*\)\s*$/g, "").replace(/\*\s*$/g, "").trim();
}
function parseDealiusUsersReportXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (str(r[0]) === "ID" && str(r[1]) === "Name") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const userId = num(r[0]);
    const displayName = str(r[1]);
    if (userId == null || !displayName) continue;
    const emailRaw = str(r[4]);
    const email = emailRaw && !emailRaw.toLowerCase().includes("@example.com") && emailRaw.includes("@") ? emailRaw : null;
    out.push({
      userId,
      name: displayName,
      email,
      roles: str(r[2]),
      office: str(r[3])
    });
  }
  return out;
}
function normalizeJsonRow(raw) {
  const userId = num(raw.userId ?? raw.UserID ?? raw.id ?? raw.ID);
  const name = str(raw.name ?? raw.Name);
  if (userId == null || !name) return null;
  const emailRaw = str(raw.email ?? raw.Email ?? raw.emailAddress ?? raw["Email Address"]);
  const email = emailRaw && !emailRaw.toLowerCase().includes("@example.com") && emailRaw.includes("@") ? emailRaw : null;
  return {
    userId,
    name,
    email,
    roles: str(raw.roles ?? raw.Roles),
    office: str(raw.office ?? raw.Office)
  };
}
function parseDealiusUsersDirectoryJson(text2) {
  const data = JSON.parse(text2);
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const u = normalizeJsonRow(row);
    if (u) out.push(u);
  }
  return out;
}
function directoryHintsForBrokerName(clean, directory) {
  const searchTerms = /* @__PURE__ */ new Set();
  const boostEmails = /* @__PURE__ */ new Set();
  if (!clean.trim() || !directory.length) {
    return { searchTerms: [], boostEmails };
  }
  const needle = normDirName(clean);
  const commaParts = clean.split(",").map((s) => s.trim()).filter(Boolean);
  const flippedInput = commaParts.length >= 2 ? `${commaParts.slice(1).join(" ")} ${commaParts[0]}`.trim() : "";
  const needleFlipInput = normDirName(flippedInput);
  for (const u of directory) {
    const display = stripDirectoryDisplayName(u.name);
    const n = normDirName(display);
    if (!n) continue;
    const parts = display.split(/\s+/).filter(Boolean);
    const flippedDisplay = parts.length >= 2 ? `${parts.slice(1).join(" ")} ${parts[0]}`.trim() : "";
    const nFlip = normDirName(flippedDisplay);
    const match = n === needle || n === needleFlipInput || needle === nFlip || needleFlipInput === n || needle.length >= 4 && (n.includes(needle) || needle.includes(n));
    if (match) {
      if (display && normDirName(display) !== needle) searchTerms.add(display);
      if (u.email) {
        searchTerms.add(u.email);
        boostEmails.add(u.email.toLowerCase());
      }
    }
  }
  return { searchTerms: Array.from(searchTerms), boostEmails };
}
var cachedPath = null;
var cachedList = null;
function getDealiusUserDirectory() {
  const p = ENV.dealiusUsersDirectory.trim();
  if (!p) return [];
  if (cachedList != null && cachedPath === p) return cachedList;
  try {
    if (!fs.existsSync(p)) {
      cachedPath = p;
      cachedList = [];
      return [];
    }
    const buf = fs.readFileSync(p);
    const lower = p.toLowerCase();
    const list = lower.endsWith(".json") ? parseDealiusUsersDirectoryJson(buf.toString("utf8")) : parseDealiusUsersReportXlsx(buf);
    cachedPath = p;
    cachedList = list;
    return list;
  } catch {
    cachedPath = p;
    cachedList = [];
    return [];
  }
}

// server/services/dealiusClient.ts
var DealiusClient = class {
  http;
  baseUrl;
  constructor(params) {
    this.baseUrl = (params?.baseUrl ?? ENV.dealiusBaseUrl).replace(/\/$/, "");
    this.http = axios2.create({
      baseURL: this.baseUrl,
      timeout: 3e4,
      headers: { Accept: "application/json" }
      // Dealius sits behind HTTPS; if your environment MITMs or requires custom certs,
      // handle that at the Node runtime/agent level rather than disabling TLS here.
    });
  }
  async authenticate(params) {
    const email = (params?.email ?? ENV.dealiusEmail).trim();
    const password = (params?.password ?? ENV.dealiusPassword).trim();
    if (!email || !password) {
      console.warn("[DealiusClient] Credentials not configured. Using dummy mode.");
      return "dummy-token";
    }
    const res = await this.http.post("/api/account/authenticate", {
      Email: email,
      Password: password
    });
    const token = res.data?.Token ?? res.data?.token;
    if (!token) throw new Error("Dealius auth succeeded but returned no Token.");
    return token;
  }
  apiUrl(path4, token) {
    const clean = path4.startsWith("/api/") ? path4 : `/api${path4.startsWith("/") ? "" : "/"}${path4}`;
    const sep = clean.includes("?") ? "&" : "?";
    return `${clean}${sep}token=${encodeURIComponent(token)}`;
  }
  async request(params) {
    if (params.token === "dummy-token") {
      console.warn(`[DealiusClient] Mocking request: ${params.method} ${params.path}`);
      return { status: 200, data: params.path.includes("SearchTerm") ? [] : {} };
    }
    const url = this.apiUrl(params.path, params.token);
    const res = await this.http.request({
      url,
      method: params.method,
      headers: { "Content-Type": "application/json" },
      data: params.data,
      validateStatus: () => true
    });
    return { status: res.status, data: res.data };
  }
  /**
   * Upload a document to a deal or listing.
   *
   * Dealius endpoints (confirmed in your existing tool):
   * - POST /api/deals/{id}/documents
   * - POST /api/listings/{id}/documents
   *
   * Uses token query param auth for consistency with other API calls.
   */
  async uploadDocument(params) {
    const id = String(params.entityId).trim();
    if (!id) throw new Error("uploadDocument: entityId is required");
    if (params.token === "dummy-token") {
      console.warn(`[DealiusClient] Mocking upload to ${params.entityType} ${id}`);
      return { status: 200, text: "Mock upload success" };
    }
    const path4 = params.entityType === "listing" ? `/listings/${encodeURIComponent(id)}/documents` : `/deals/${encodeURIComponent(id)}/documents`;
    const urlPath = this.apiUrl(path4, params.token);
    const url = `${this.baseUrl}${urlPath}`;
    const fd = new FormData();
    const bytes = new Uint8Array(params.buffer);
    fd.append("file", new Blob([bytes], { type: params.mimeType || "application/octet-stream" }), params.filename);
    fd.append("Name", params.filename);
    if (params.documentType) fd.append("DocumentType", params.documentType);
    const res = await fetch(url, { method: "POST", body: fd });
    const text2 = await res.text();
    return { status: res.status, text: text2 };
  }
};
function normName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
async function resolveBrokerContactId(params) {
  const clean = params.name.trim();
  if (!clean) return null;
  const needle = normName(clean);
  const first2 = needle.split(" ")[0] || needle;
  const commaParts = clean.split(",").map((s) => s.trim()).filter(Boolean);
  const flipped = commaParts.length >= 2 ? `${commaParts.slice(1).join(" ")} ${commaParts[0]}`.trim() : "";
  const dirHints = directoryHintsForBrokerName(clean, params.directory ?? []);
  const searchTerms = Array.from(
    new Set(
      [
        clean,
        clean.replace(/,/g, " "),
        flipped,
        flipped.replace(/,/g, " "),
        ...dirHints.searchTerms
      ].map((s) => s.trim()).filter(Boolean)
    )
  );
  const all = [];
  for (const term of searchTerms) {
    const { status, data } = await params.client.request({
      token: params.token,
      method: "GET",
      path: `/brokers?SearchTerm=${encodeURIComponent(term)}&PageSize=50`
    });
    if (status < 200 || status >= 300) continue;
    const list2 = Array.isArray(data) ? data : Array.isArray(data?.Data) ? data.Data : [];
    all.push(...list2);
    if (all.length >= 50) break;
  }
  const byBrokerId = /* @__PURE__ */ new Map();
  for (const br of all) {
    const rawId = br.ContactID || br.BrokerID || br.ID || br.id;
    const id = typeof rawId === "number" ? rawId : Number.parseInt(String(rawId), 10);
    if (!Number.isFinite(id)) continue;
    if (!byBrokerId.has(id)) byBrokerId.set(id, br);
  }
  const list = Array.from(byBrokerId.values());
  const scored = list.map((br) => {
    const id = br.ContactID || br.BrokerID || br.ID || br.id || null;
    const full = normName(br.ContactName || br.FullName || br.Name || br.DisplayName || "");
    const brokerEmail = String(br.Email || br.email || "").trim().toLowerCase();
    let score = 0;
    if (full === needle) score += 100;
    if (full.includes(needle)) score += 60;
    if (first2 && full.includes(first2)) score += 20;
    if (brokerEmail && dirHints.boostEmails.has(brokerEmail)) score += 45;
    return { id, score };
  }).filter((x) => x.id).sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

// server/adminUsers/adminErrors.ts
function sendAdminError(res, status, code, message, field) {
  const body = { error: { code, message } };
  if (field !== void 0) body.error.field = field;
  res.status(status).json(body);
}
var AdminUserError = class extends Error {
  status;
  code;
  field;
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
};
function sendAdminUserError(res, err2) {
  sendAdminError(res, err2.status, err2.code, err2.message, err2.field);
}

// server/settings/settingsStore.ts
var cache = null;
function invalidateSettingsCache() {
  cache = null;
}
function coerceStoredValue(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
function parseMergedValue(key, raw) {
  const def = SETTINGS_BY_KEY[key];
  const base = raw === void 0 ? def.defaultValue : coerceStoredValue(raw);
  let val = base;
  if (def.sensitive) {
    if (val === null || val === void 0 || val === "") {
      val = def.defaultValue;
    } else if (isEncryptedEnvelope(val)) {
      try {
        val = decryptSettingEnvelope(val);
      } catch {
        val = def.defaultValue;
      }
    }
  }
  const parsed = def.valueSchema.safeParse(val);
  return parsed.success ? parsed.data : def.defaultValue;
}
async function refreshSettingsCache() {
  const db = await getDb();
  const merged = /* @__PURE__ */ new Map();
  if (!db || typeof db.select !== "function") {
    for (const key of SETTING_KEYS) {
      merged.set(key, SETTINGS_BY_KEY[key].defaultValue);
    }
    cache = { merged };
    return merged;
  }
  const rows = await db.select().from(appSettings);
  const fromDb = /* @__PURE__ */ new Map();
  for (const r of rows) {
    fromDb.set(r.key, r.value);
  }
  for (const key of SETTING_KEYS) {
    const raw = fromDb.get(key);
    merged.set(key, parseMergedValue(key, raw));
  }
  cache = { merged };
  return merged;
}
async function ensureSettingsCache() {
  if (cache) return cache.merged;
  return refreshSettingsCache();
}
function maskForAdmin(key, val) {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) return val;
  if (val === null || val === void 0 || val === "") return null;
  return MASKED_SECRET;
}
function redactForAudit(key, val, isBefore) {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  if (val === null || val === void 0 || val === "") return isBefore ? "(empty)" : "(empty)";
  return isBefore ? "(set)" : "(updated)";
}
function parsedPlainForAudit(key, stored) {
  const def = SETTINGS_BY_KEY[key];
  if (!def.sensitive) return stored;
  if (isEncryptedEnvelope(stored)) {
    try {
      return decryptSettingEnvelope(stored);
    } catch {
      return "(invalid)";
    }
  }
  return stored;
}
function setDeep(target, parts, value) {
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}
function buildGrouped(merged, mask) {
  const out = {
    branding: {},
    workflow: {},
    notifications: {},
    integrations: {},
    security: {}
  };
  for (const key of SETTING_KEYS) {
    const def = SETTINGS_BY_KEY[key];
    const val = mask ? maskForAdmin(key, merged.get(key)) : merged.get(key);
    const prefix = `${def.category}.`;
    if (!key.startsWith(prefix)) continue;
    const tail = key.slice(prefix.length).split(".");
    setDeep(out[def.category], tail, val);
  }
  return out;
}
async function getGroupedSettings(mask) {
  const merged = await ensureSettingsCache();
  return buildGrouped(merged, mask);
}
async function getGroupedCategory(category, mask) {
  const all = await getGroupedSettings(mask);
  return all[category] ?? {};
}
async function patchSettings(db, body, actorId, req) {
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new AdminUserError(400, "NO_KEYS", "At least one setting key is required.");
  }
  const merged = await ensureSettingsCache();
  const updates = [];
  for (const rawKey of keys) {
    if (!isSettingKey(rawKey)) {
      throw new AdminUserError(400, "UNKNOWN_KEY", `Unknown setting key: ${rawKey}`, rawKey);
    }
    const key = rawKey;
    const def = SETTINGS_BY_KEY[key];
    const parsed = def.valueSchema.safeParse(body[rawKey]);
    if (!parsed.success) {
      throw new AdminUserError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Validation failed",
        rawKey
      );
    }
    let stored = parsed.data;
    if (def.sensitive) {
      if (stored === null || stored === void 0 || stored === "") {
        stored = null;
      } else if (typeof stored === "string") {
        stored = encryptSettingPlaintext(stored);
      }
    }
    updates.push({ key, stored, category: def.category });
  }
  for (const u of updates) {
    const def = SETTINGS_BY_KEY[u.key];
    const beforeVal = merged.get(u.key);
    const beforeRedacted = redactForAudit(u.key, beforeVal, true);
    const afterRedacted = redactForAudit(u.key, parsedPlainForAudit(u.key, u.stored), false);
    await db.insert(appSettings).values({
      key: u.key,
      value: u.stored,
      category: u.category,
      description: def.description ?? null,
      updatedAt: /* @__PURE__ */ new Date(),
      updatedBy: actorId
    }).onDuplicateKeyUpdate({
      set: {
        value: u.stored,
        category: u.category,
        description: def.description ?? null,
        updatedAt: /* @__PURE__ */ new Date(),
        updatedBy: actorId
      }
    });
    await writeAuditLog(
      actorId,
      "settings.updated",
      "setting",
      u.key,
      { category: u.category, before_redacted: beforeRedacted, after_redacted: afterRedacted },
      req
    );
  }
  invalidateSettingsCache();
  return getGroupedSettings(true);
}
async function runDealiusSettingsTest(db, actorId, req) {
  const merged = await ensureSettingsCache();
  const user = merged.get("integrations.dealius.username") ?? "";
  const pass = merged.get("integrations.dealius.password") ?? "";
  let success = false;
  let message = "";
  if (process.env.SETTINGS_DEALIUS_TEST_STUB === "fail") {
    success = false;
    message = "Stub failure (SETTINGS_DEALIUS_TEST_STUB=fail).";
  } else if (!user || !pass) {
    success = false;
    message = "Dealius username or password is not configured in settings.";
  } else {
    try {
      const client = new DealiusClient();
      await client.authenticate({ email: user, password: pass });
      success = true;
      message = "Authentication succeeded.";
    } catch (e) {
      success = false;
      message = e instanceof Error ? e.message : String(e);
    }
  }
  const testedAt = (/* @__PURE__ */ new Date()).toISOString();
  const result = success ? "success" : "failed";
  const defAt = SETTINGS_BY_KEY["integrations.dealius.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.dealius.last_test_result"];
  await db.insert(appSettings).values({
    key: "integrations.dealius.last_test_at",
    value: testedAt,
    category: "integrations",
    description: defAt.description ?? null,
    updatedAt: /* @__PURE__ */ new Date(),
    updatedBy: actorId
  }).onDuplicateKeyUpdate({
    set: {
      value: testedAt,
      updatedAt: /* @__PURE__ */ new Date(),
      updatedBy: actorId
    }
  });
  await db.insert(appSettings).values({
    key: "integrations.dealius.last_test_result",
    value: result,
    category: "integrations",
    description: defRes.description ?? null,
    updatedAt: /* @__PURE__ */ new Date(),
    updatedBy: actorId
  }).onDuplicateKeyUpdate({
    set: {
      value: result,
      updatedAt: /* @__PURE__ */ new Date(),
      updatedBy: actorId
    }
  });
  await writeAuditLog(
    actorId,
    "settings.updated",
    "setting",
    "integrations.dealius.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );
  invalidateSettingsCache();
  return { success, message, tested_at: testedAt };
}
async function verifyDealiusCredentials(username, password) {
  const user = username.trim();
  const pass = password;
  if (process.env.SETTINGS_DEALIUS_TEST_STUB === "fail") {
    return { success: false, message: "Stub failure (SETTINGS_DEALIUS_TEST_STUB=fail)." };
  }
  if (!user || !pass) {
    return { success: false, message: "Username and password are required." };
  }
  try {
    const client = new DealiusClient();
    await client.authenticate({ email: user, password: pass });
    return { success: true, message: "Authentication succeeded." };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}
async function getSetting(key) {
  if (!isSettingKey(key)) {
    throw new Error(`Unknown setting key: ${key}`);
  }
  const merged = await ensureSettingsCache();
  return merged.get(key);
}
async function getPublicToolSettings() {
  const merged = await ensureSettingsCache();
  return {
    company_name: String(merged.get("branding.company_name") ?? ""),
    logo_url: merged.get("branding.logo_url") ?? null,
    primary_color: String(merged.get("branding.primary_color") ?? "#A6192E"),
    support_email: String(merged.get("branding.support_email") ?? ""),
    workflow: {
      confidential_warning_enabled: Boolean(merged.get("workflow.confidential_warning_enabled")),
      confidential_warning_text: String(merged.get("workflow.confidential_warning_text") ?? ""),
      auto_save_interval_seconds: Number(merged.get("workflow.auto_save_interval_seconds") ?? 30),
      default_listing_term_months: Number(merged.get("workflow.default_listing_term_months") ?? 12),
      commission_split_must_sum_100: Boolean(merged.get("workflow.commission_split_must_sum_100")),
      require_voucher_attachment: Boolean(merged.get("workflow.require_voucher_attachment"))
    },
    notifications: {
      email_on_submission: Boolean(merged.get("notifications.email_on_submission")),
      email_on_status_change: Boolean(merged.get("notifications.email_on_status_change")),
      email_on_dealius_success: Boolean(merged.get("notifications.email_on_dealius_success")),
      admin_digest_enabled: Boolean(merged.get("notifications.admin_digest_enabled")),
      admin_digest_time: String(merged.get("notifications.admin_digest_time") ?? "08:00")
    }
  };
}

// server/routers/aiAssist.ts
var listingFields = z3.object({
  propertyType: z3.string().optional(),
  transactionType: z3.string().optional(),
  address: z3.string().optional(),
  city: z3.string().optional(),
  state: z3.string().optional(),
  zip: z3.string().optional(),
  rateSfMo: z3.string().optional(),
  term: z3.string().optional(),
  leaseType: z3.string().optional(),
  buildingSf: z3.string().optional(),
  suiteSf: z3.string().optional(),
  askingPrice: z3.string().optional(),
  listingAgentName: z3.string().optional(),
  listingAgentLicense: z3.string().optional(),
  comments: z3.string().optional()
});
var voucherFields = z3.object({
  representationType: z3.string().optional(),
  clientName: z3.string().optional(),
  transactionType: z3.string().optional(),
  address: z3.string().optional(),
  city: z3.string().optional(),
  state: z3.string().optional(),
  zip: z3.string().optional(),
  dealSf: z3.string().optional(),
  commissionRate: z3.string().optional(),
  term: z3.string().optional(),
  commencementDate: z3.string().optional(),
  expirationDate: z3.string().optional(),
  baseRent: z3.string().optional(),
  lessorName: z3.string().optional(),
  lesseeName: z3.string().optional(),
  listingAgentName: z3.string().optional(),
  procuringAgentName: z3.string().optional(),
  totalConsideration: z3.string().optional(),
  notes: z3.string().optional()
});
var signFields = z3.object({
  propertyAddress: z3.string().optional(),
  city: z3.string().optional(),
  state: z3.string().optional(),
  zip: z3.string().optional(),
  signType: z3.string().optional(),
  signSize: z3.string().optional(),
  quantity: z3.string().optional(),
  nameRider: z3.string().optional(),
  requestedBy: z3.string().optional(),
  specialInstructions: z3.string().optional(),
  accessInstructions: z3.string().optional()
});
var compFields = z3.object({
  compType: z3.string().optional(),
  address: z3.string().optional(),
  city: z3.string().optional(),
  state: z3.string().optional(),
  zip: z3.string().optional(),
  buildingSf: z3.string().optional(),
  dealSf: z3.string().optional(),
  leaseRate: z3.string().optional(),
  term: z3.string().optional(),
  commencementDate: z3.string().optional(),
  tenantName: z3.string().optional(),
  landlordName: z3.string().optional(),
  salePrice: z3.string().optional(),
  pricePerSf: z3.string().optional(),
  propertyType: z3.string().optional(),
  brokerName: z3.string().optional(),
  comments: z3.string().optional()
});
var tabFieldSchemas = {
  listing: listingFields,
  voucher: voucherFields,
  sign: signFields,
  comp: compFields
};
var formTabSchema = z3.enum(["listing", "voucher", "sign", "comp"]);
var aiDocumentMimeSchema = z3.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).default("application/pdf");
var propertyTypeMap = {
  industrial: "Industrial",
  office: "Office",
  retail: "Retail",
  land: "Land",
  other: "Other"
};
var transactionTypeMap = {
  lease: "Lease",
  leasing: "Lease",
  sale: "Sale",
  purchase: "Sale"
};
var representationTypeMap = {
  "tenant rep": "Tenant Rep",
  tenant: "Tenant Rep",
  "landlord rep": "Landlord Rep",
  landlord: "Landlord Rep",
  "buyer rep": "Buyer Rep",
  buyer: "Buyer Rep",
  "seller rep": "Seller Rep",
  seller: "Seller Rep",
  dual: "Dual"
};
var leaseTypeMap = {
  nnn: "NNN",
  triple: "NNN",
  "triple net": "NNN",
  fsg: "FSG",
  "full service": "FSG",
  "full service gross": "FSG",
  mg: "MG",
  modified: "MG",
  "modified gross": "MG",
  gross: "Gross",
  net: "Net"
};
var southernCaliforniaCities = /* @__PURE__ */ new Set([
  "anaheim",
  "brea",
  "buena park",
  "carlsbad",
  "cerritos",
  "chino",
  "chino hills",
  "corona",
  "costa mesa",
  "cypress",
  "foothill ranch",
  "fountain valley",
  "fullerton",
  "garden grove",
  "huntington beach",
  "irvine",
  "la habra",
  "lake forest",
  "laguna beach",
  "laguna hills",
  "laguna niguel",
  "mission viejo",
  "newport beach",
  "orange",
  "placentia",
  "rancho santa margarita",
  "san clemente",
  "san juan capistrano",
  "santa ana",
  "tustin",
  "yorba linda"
]);
function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
function toTitleCase(value) {
  return value.split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}
function normalizeEnum(raw, allowedMap) {
  const value = normalizeWhitespace(cleanString(raw)).toLowerCase();
  if (!value) return void 0;
  return allowedMap[value];
}
function parseScaledNumber(raw) {
  const value = cleanString(raw).toLowerCase().replace(/[$,%]/g, "").replace(/,/g, "").replace(/\s+/g, "");
  if (!value) return void 0;
  let multiplier = 1;
  let numeric = value;
  if (/(million|mm|m)$/.test(value)) {
    multiplier = 1e6;
    numeric = value.replace(/(million|mm|m)$/, "");
  } else if (/(billion|bn|b)$/.test(value)) {
    multiplier = 1e9;
    numeric = value.replace(/(billion|bn|b)$/, "");
  } else if (/(thousand|k)$/.test(value)) {
    multiplier = 1e3;
    numeric = value.replace(/(thousand|k)$/, "");
  }
  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed)) return void 0;
  return parsed * multiplier;
}
function normalizeIntegerString(raw, opts = {}) {
  const parsed = parseScaledNumber(raw);
  if (!Number.isFinite(parsed)) return void 0;
  const numeric = parsed;
  const rounded = Math.round(numeric);
  if (opts.min != null && rounded < opts.min) return void 0;
  if (opts.max != null && rounded > opts.max) return void 0;
  return String(rounded);
}
function normalizeDecimalString(raw, opts = {}) {
  const trimmed = cleanString(raw);
  const parsed = parseScaledNumber(trimmed);
  if (!Number.isFinite(parsed)) return void 0;
  const numeric = parsed;
  if (opts.min != null && numeric < opts.min) return void 0;
  if (opts.max != null && numeric > opts.max) return void 0;
  const cleanedNumeric = trimmed.replace(/[$,%]/g, "").replace(/,/g, "").trim().toLowerCase().replace(/(million|mm|m|billion|bn|b|thousand|k)$/g, "");
  const requestedDecimals = cleanedNumeric.includes(".") ? cleanedNumeric.split(".")[1]?.length ?? 0 : 0;
  const decimals = Math.min(requestedDecimals, opts.maxDecimals ?? 2);
  return decimals > 0 ? numeric.toFixed(decimals) : String(numeric);
}
function normalizeState(raw) {
  const value = cleanString(raw);
  if (!value) return void 0;
  const upper = value.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (value.toLowerCase() === "california") return "CA";
  return void 0;
}
function normalizeZip(raw) {
  const digits = cleanString(raw).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  return void 0;
}
function normalizeDate(raw) {
  const value = cleanString(raw);
  if (!value) return void 0;
  const mmddyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}/${yyyy}`;
  }
  const iso2 = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso2) {
    const [, yyyy, mm, dd] = iso2;
    return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}/${yyyy}`;
  }
  return void 0;
}
function normalizeName(raw) {
  const value = normalizeWhitespace(cleanString(raw));
  if (!value) return void 0;
  const withoutContact = value.replace(/\b\S+@\S+\b/g, "").replace(/\+?[\d().\-\s]{7,}/g, "").replace(/\s{2,}/g, " ").trim();
  if (!withoutContact) return void 0;
  return withoutContact;
}
function sanitizeFieldValue(field, raw) {
  const value = cleanString(raw);
  if (!value) return void 0;
  switch (field) {
    case "propertyType":
      return normalizeEnum(value, propertyTypeMap);
    case "transactionType":
      return normalizeEnum(value, transactionTypeMap);
    case "representationType":
      return normalizeEnum(value, representationTypeMap);
    case "leaseType":
      return normalizeEnum(value, leaseTypeMap);
    case "state":
      return normalizeState(value);
    case "zip":
      return normalizeZip(value);
    case "term":
    case "buildingSf":
    case "suiteSf":
    case "dealSf":
    case "quantity":
      return normalizeIntegerString(value, { min: 1, max: 1e7 });
    case "askingPrice":
    case "salePrice":
    case "totalConsideration":
      return normalizeIntegerString(value, { min: 1, max: 1e11 });
    case "rateSfMo":
    case "leaseRate":
    case "pricePerSf":
    case "commissionRate":
    case "baseRent":
      return normalizeDecimalString(value, { min: 0, max: 1e5, maxDecimals: 2 });
    case "commencementDate":
    case "expirationDate":
      return normalizeDate(value);
    case "listingAgentName":
    case "brokerName":
    case "lessorName":
    case "lesseeName":
    case "requestedBy":
    case "tenantName":
    case "landlordName":
    case "procuringAgentName":
    case "clientName":
      return normalizeName(value);
    case "city":
      return toTitleCase(value);
    default:
      return normalizeWhitespace(value);
  }
}
function sanitizeAiFields(tab, parsed) {
  const validFields = new Set(Object.keys(tabFieldSchemas[tab].shape));
  return Object.fromEntries(
    Object.entries(parsed).filter(([field]) => validFields.has(field)).map(([field, value]) => [field, sanitizeFieldValue(field, value)]).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );
}
function parseJsonObject(raw) {
  try {
    return JSON.parse(typeof raw === "string" ? raw : "{}");
  } catch {
    return {};
  }
}
function parseAddressParts(raw) {
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (!match) return {};
  const [, address, city, state, zip] = match;
  return {
    address: normalizeWhitespace(address),
    city: toTitleCase(city),
    state: normalizeState(state),
    zip: normalizeZip(zip)
  };
}
function parseUsDate(raw) {
  const normalized = normalizeDate(raw);
  if (!normalized) return void 0;
  const [month, day, year] = normalized.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return void 0;
  return { date, normalized };
}
function wholeMonthDiff(start, end) {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return months;
}
function deriveStateFromCity(city) {
  return southernCaliforniaCities.has(city.toLowerCase()) ? "CA" : void 0;
}
function deriveSmartSuggestions(tab, currentFields) {
  const suggestions = {};
  const emptyFields = new Set(
    Object.keys(tabFieldSchemas[tab].shape).filter(
      (key) => !cleanString(currentFields[key])
    )
  );
  const addressValue = cleanString(currentFields.address);
  if (addressValue && addressValue.includes(",")) {
    const parts = parseAddressParts(addressValue);
    if (emptyFields.has("address") && parts.address) suggestions.address = parts.address;
    if (emptyFields.has("city") && parts.city) suggestions.city = parts.city;
    if (emptyFields.has("state") && parts.state) suggestions.state = parts.state;
    if (emptyFields.has("zip") && parts.zip) suggestions.zip = parts.zip;
  }
  const cityValue = cleanString(currentFields.city);
  if (emptyFields.has("state") && cityValue) {
    const derivedState = deriveStateFromCity(cityValue);
    if (derivedState) suggestions.state = derivedState;
  }
  if (tab === "voucher" || tab === "comp") {
    const start = parseUsDate(currentFields.commencementDate);
    const end = parseUsDate(currentFields.expirationDate);
    if (emptyFields.has("term") && start && end && end.date > start.date) {
      const months = wholeMonthDiff(start.date, end.date);
      if (months > 0) suggestions.term = String(months);
    }
  }
  if (tab === "comp" && emptyFields.has("pricePerSf")) {
    const salePrice = parseScaledNumber(currentFields.salePrice);
    const buildingSf = parseScaledNumber(currentFields.buildingSf);
    if (Number.isFinite(salePrice) && Number.isFinite(buildingSf) && buildingSf > 0) {
      suggestions.pricePerSf = Number(salePrice / buildingSf).toFixed(2);
    }
  }
  return sanitizeAiFields(tab, suggestions);
}
function parseNumber(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const value = cleanString(raw);
  if (!value) return void 0;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : void 0;
}
function parseBoolean(raw) {
  return raw === true || raw === "true" || raw === 1;
}
function makeVoucherSuggestion(field, issue, reason, inputId, suggestion = "") {
  return { field, issue, suggestion, reason, inputId };
}
function runVoucherAudit(dealData) {
  const suggestions = [];
  const isLease = parseBoolean(dealData.isLease);
  const isSale = parseBoolean(dealData.isSale);
  const start = parseUsDate(dealData.startDate);
  const end = parseUsDate(dealData.endDate);
  const term = parseNumber(dealData.term);
  const rentRowMonthTotal = parseNumber(dealData.rentRowMonthTotal);
  const address = cleanString(dealData.address);
  const city = cleanString(dealData.city);
  const zip = cleanString(dealData.zip);
  const sqft = parseNumber(dealData.sqft);
  const totalConsideration = parseNumber(dealData.totalConsideration);
  const saleCommPct = parseNumber(dealData.saleCommPct);
  if (start && end && end.date <= start.date) {
    suggestions.push(
      makeVoucherSuggestion(
        "Lease End",
        "Lease end date is before the start date.",
        "The lease end must be later than the commencement date.",
        "dx_endDate"
      )
    );
  }
  if (start && end && term != null && end.date > start.date) {
    const computedMonths = wholeMonthDiff(start.date, end.date);
    if (computedMonths > 0 && Math.abs(computedMonths - term) > 1) {
      suggestions.push(
        makeVoucherSuggestion(
          "Term",
          "Term does not match the lease date range.",
          `The date range implies about ${computedMonths} months, but the form says ${term}.`,
          "dx_term",
          String(computedMonths)
        )
      );
    }
  }
  if (isLease && term != null && rentRowMonthTotal != null && Math.abs(rentRowMonthTotal - term) > 1) {
    suggestions.push(
      makeVoucherSuggestion(
        "Rent Schedule",
        "Rent rows do not add up to the stated term.",
        `The schedule totals ${rentRowMonthTotal} months while the term field says ${term}.`,
        "dx_term",
        String(rentRowMonthTotal)
      )
    );
  }
  if (saleCommPct != null && (saleCommPct < 0.5 || saleCommPct > 10)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Commission",
        "Commission percentage is outside the normal review range.",
        "Lee vouchers should be reviewed when commission is below 0.5% or above 10%.",
        "dx_saleCommPct",
        saleCommPct.toFixed(saleCommPct % 1 === 0 ? 0 : 2)
      )
    );
  }
  if (address && !city) {
    suggestions.push(
      makeVoucherSuggestion(
        "City",
        "Address is filled but city is missing.",
        "A complete deal location should include both street address and city.",
        "dx_city"
      )
    );
  }
  if (!address && (city || zip)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Address",
        "City or ZIP is filled without a street address.",
        "The property record needs a street address to identify the deal clearly.",
        "dx_address"
      )
    );
  }
  if (sqft != null && (sqft <= 0 || sqft > 1e7)) {
    suggestions.push(
      makeVoucherSuggestion(
        "Deal SF",
        "Square footage looks invalid.",
        "Deal SF should be a positive number and well under ten million square feet for one deal.",
        "dx_sqft"
      )
    );
  }
  if (isLease) {
    if (!start) {
      suggestions.push(
        makeVoucherSuggestion(
          "Lease Start",
          "Lease start date is missing.",
          "Lease deals should include a commencement date.",
          "dx_startDate"
        )
      );
    }
    if (!end) {
      suggestions.push(
        makeVoucherSuggestion(
          "Lease End",
          "Lease end date is missing.",
          "Lease deals should include an end date.",
          "dx_endDate"
        )
      );
    }
    if (term == null) {
      suggestions.push(
        makeVoucherSuggestion(
          "Term",
          "Lease term is missing.",
          "Lease deals should include the term in months.",
          "dx_term"
        )
      );
    }
  }
  if (isSale) {
    if (totalConsideration == null || totalConsideration <= 0) {
      suggestions.push(
        makeVoucherSuggestion(
          "Purchase Price",
          "Purchase price is missing or zero.",
          "Sale deals should include total consideration.",
          "dx_totalConsideration"
        )
      );
    }
    if (saleCommPct == null) {
      suggestions.push(
        makeVoucherSuggestion(
          "Commission",
          "Commission percentage is missing.",
          "Sale deals should include the commission percentage.",
          "dx_saleCommPct"
        )
      );
    }
  }
  return suggestions;
}
async function parseSystemPrompt() {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured field values from a broker's natural language deal description.

CRITICAL RULES \u2014 follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text.
- Include ONLY fields you can extract with high confidence. Omit uncertain fields entirely.
- Monetary values: numbers as strings, no $ or commas. "1.25" not "$1.25/SF".
- Dates: MM/DD/YYYY format only.
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
- Transaction type: exactly Lease or Sale.
- Representation type: Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, or Dual.
- Term: integer months as string. "60" = 5 years, "36" = 3 years. "5 years" \u2192 "60".
- Building SF / suite SF: numeric string without commas. "12500" not "12,500".
- Asking price (sale): numeric string without commas. "2500000" not "$2.5M".
- Lease rate: monthly per-SF as string. "$1.25/SF/Mo" \u2192 "1.25".
- Broker/agent names: full name only, no phone or email.
- Address: street address only (no city/state). City and state go in their own fields.
- State: two-letter abbreviation. "California" \u2192 "CA".
- If a value is implied but not explicitly stated, omit it. Never guess, estimate, or fill market-default values.`;
}
async function brochureSystemPrompt() {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured listing data from a property marketing brochure or flyer.

CRITICAL RULES \u2014 follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Extract ONLY fields you can identify with high confidence. Omit everything else.
- Monetary values: numeric strings without $ or commas. "$1.25/SF/Mo" \u2192 "1.25".
- Building/suite SF: numeric string without commas. "12,500 SF" \u2192 "12500".
- Asking price for sales: numeric string. "$2,500,000" \u2192 "2500000".
- Dates: MM/DD/YYYY format.
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
- Transaction type: Lease or Sale.
- Lease type: NNN, FSG, MG, Gross, or Net.
- Term: integer months as string if stated. "5 years" \u2192 "60".
- Address: street only (no city/state). Put city and state in separate fields.
- State: two-letter abbreviation.
- Extract agent/broker full name if visible.
- Extract all highlights/features into comments as a concise bullet list.
- If the brochure is ambiguous or promotional without a precise field value, omit that field.`;
}
async function documentSystemPrompt() {
  const company = String(await getSetting("branding.company_name"));
  return `You are a commercial real estate data extraction specialist for ${company}.
Extract structured form data from broker-provided documents such as brochures, offering memoranda, commission agreements, sign requests, and comp sheets.

CRITICAL RULES \u2014 follow exactly:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Include ONLY fields listed in the user's available fields list.
- Extract ONLY values you can identify with high confidence. Omit uncertain fields entirely.
- Monetary values: numeric strings without $ or commas. "$1.25/SF/Mo" -> "1.25".
- Building/suite/deal SF: numeric string without commas. "12,500 SF" -> "12500".
- Dates: MM/DD/YYYY format.
- Property type: exactly one of Industrial, Office, Retail, Land, Other.
- Transaction type: Lease or Sale.
- Representation type: Tenant Rep, Landlord Rep, Buyer Rep, Seller Rep, or Dual.
- Lease type: NNN, FSG, MG, Gross, or Net.
- Term: integer months as string if stated. "5 years" -> "60".
- Address: street only (no city/state). Put city and state in separate fields.
- State: two-letter abbreviation.
- Broker/agent names: full name only, no phone or email.
- If the document is ambiguous or promotional without a precise field value, omit that field.`;
}
function buildJsonSchema(name, fieldNames) {
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(fieldNames.map((k) => [k, { type: "string" }])),
      required: [],
      additionalProperties: false
    }
  };
}
async function fetchDocumentBuffer(fileUrl) {
  try {
    const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(3e4) });
    if (!fileResp.ok) throw new Error(`File fetch failed: ${fileResp.status}`);
    const buffer = await fileResp.arrayBuffer();
    return { fileBuffer: Buffer.from(buffer), error: null };
  } catch (e) {
    return { fileBuffer: null, error: `Could not fetch file: ${e.message}` };
  }
}
async function buildDocumentUserContent(fileBuffer, mimeType, promptText) {
  if (mimeType !== "application/pdf") {
    return [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
          detail: "high"
        }
      },
      {
        type: "text",
        text: promptText
      }
    ];
  }
  return [
    {
      type: "text",
      text: await (async () => {
        try {
          const { PDFParse: PDFParse2 } = await import("pdf-parse");
          const parser = new PDFParse2({ data: fileBuffer });
          const textResult = await parser.getText();
          await parser.destroy?.();
          const cleaned = normalizeWhitespace(textResult.text || "");
          const trimmed = cleaned.slice(0, 4e4);
          return `${promptText}

Document text (extracted):
${trimmed}`;
        } catch (e) {
          const message = e?.message ? String(e.message) : "Unknown PDF parse error";
          return `${promptText}

Note: PDF text extraction failed (${message}). Return an empty JSON object.`;
        }
      })()
    }
  ];
}
async function extractDocumentFields(tab, fileUrl, mimeType, options = {}) {
  const fieldNames = Object.keys(tabFieldSchemas[tab].shape);
  const fetched = await fetchDocumentBuffer(fileUrl);
  if (!fetched.fileBuffer) {
    return {
      success: false,
      fields: {},
      tab,
      fieldCount: 0,
      error: fetched.error ?? "Could not fetch file"
    };
  }
  const promptText = options.listingBrochurePrompt ? `Extract all listing fields you can identify from this ${mimeType === "application/pdf" ? "PDF brochure" : "brochure image"}.

Available fields: ${fieldNames.join(", ")}

Return JSON with only fields you can confidently extract:` : `Extract all fields you can identify for the "${tab}" form from this ${mimeType === "application/pdf" ? "PDF document" : "document image"}.

Available fields: ${fieldNames.join(", ")}

Return JSON with only fields you can confidently extract:`;
  const userContent = await buildDocumentUserContent(
    fetched.fileBuffer,
    mimeType,
    promptText
  );
  const systemContent = options.listingBrochurePrompt ? await brochureSystemPrompt() : await documentSystemPrompt();
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    response_format: {
      type: "json_schema",
      json_schema: buildJsonSchema(`${tab}_document_fields`, fieldNames)
    }
  });
  const raw = response.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(raw);
  const fields = sanitizeAiFields(tab, parsed);
  return {
    success: true,
    fields,
    tab,
    fieldCount: Object.keys(fields).length
  };
}
var aiAssistRouter = router({
  /**
   * Parse a natural language deal description into structured form fields.
   */
  parse: publicProcedure.input(
    z3.object({
      description: z3.string().min(5).max(3e3),
      tab: z3.enum(["listing", "voucher", "sign", "comp"])
    })
  ).mutation(async ({ input }) => {
    const { description, tab } = input;
    const schema = tabFieldSchemas[tab];
    const fieldNames = Object.keys(schema.shape);
    const response = await invokeLLM({
      messages: [
        { role: "system", content: await parseSystemPrompt() },
        {
          role: "user",
          content: `Extract fields for the "${tab}" form tab.

Available fields: ${fieldNames.join(", ")}

Deal description:
"${description}"

Return JSON:`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: buildJsonSchema(`${tab}_fields`, fieldNames)
      }
    });
    const raw = response.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(raw);
    const fields = sanitizeAiFields(tab, parsed);
    return { success: true, fields, tab };
  }),
  /**
   * Smart complete: suggest values for empty fields based on what is already filled.
   */
  smartComplete: publicProcedure.input(
    z3.object({
      currentFields: z3.record(z3.string(), z3.string()),
      tab: z3.enum(["listing", "voucher", "sign", "comp"])
    })
  ).mutation(async ({ input }) => {
    const { currentFields, tab } = input;
    const schema = tabFieldSchemas[tab];
    const emptyFields = Object.keys(schema.shape).filter(
      (k) => !currentFields[k] || currentFields[k].trim() === ""
    );
    if (emptyFields.length === 0) {
      return { success: true, fields: {}, tab, message: "All fields already filled" };
    }
    const filledSummary = Object.entries(currentFields).filter(([, v]) => v && v.trim() !== "").map(([k, v]) => `${k}: "${v}"`).join("\n");
    const derived = deriveSmartSuggestions(tab, currentFields);
    const fields = Object.fromEntries(
      Object.entries(derived).filter(([field]) => emptyFields.includes(field))
    );
    return {
      success: true,
      fields,
      tab,
      message: Object.keys(fields).length > 0 ? "Added directly-supported suggestions only." : filledSummary ? "No directly-supported suggestions found from the current form data." : "Enter a little more deal detail first, then try again."
    };
  }),
  /**
   * Scrape a property brochure (PDF or image) and extract listing fields.
   * Fetches the file server-side and sends the content as base64.
   */
  scrapeBrochure: publicProcedure.input(
    z3.object({
      // Accept either a public http(s) URL (e.g. an S3 object) or a data:
      // URL uploaded inline from the browser. Both are fetched server-side.
      fileUrl: z3.string().refine(
        (v) => /^https?:\/\//i.test(v) || /^data:[^;]+;base64,/i.test(v),
        { message: "fileUrl must be an http(s) URL or a data: URL" }
      ),
      mimeType: z3.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).default("application/pdf")
    })
  ).mutation(async ({ input }) => {
    return extractDocumentFields(
      "listing",
      input.fileUrl,
      input.mimeType,
      { listingBrochurePrompt: true }
    );
  }),
  /**
   * Extract fields from a broker document for any supported tool tab.
   * This keeps client-side AI document workflows behind the broker tool API.
   */
  extractDocument: publicProcedure.input(
    z3.object({
      fileUrl: z3.string().refine(
        (v) => /^https?:\/\//i.test(v) || /^data:[^;]+;base64,/i.test(v),
        { message: "fileUrl must be an http(s) URL or a data: URL" }
      ),
      mimeType: z3.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).default("application/pdf"),
      tab: z3.enum(["listing", "voucher", "sign", "comp"])
    })
  ).mutation(
    async ({ input }) => extractDocumentFields(input.tab, input.fileUrl, input.mimeType)
  ),
  /**
   * Review parsed voucher/deal data and return structured suggestions.
   * Used by the Dealius integration panel — no external API key required.
   */
  reviewVoucher: publicProcedure.input(
    z3.object({
      dealData: z3.record(z3.string(), z3.unknown())
    })
  ).mutation(async ({ input }) => {
    const suggestions = runVoucherAudit(input.dealData);
    return { success: true, suggestions };
  })
});

// server/routers/compData.ts
init_schema();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { desc as desc2 } from "drizzle-orm";
import { z as z4 } from "zod/v4";
init_db();

// server/services/compData.ts
init_schema();
import { and, desc, eq as eq2, gte, like, lte, ne, or, sql as sql2 } from "drizzle-orm";

// shared/comp-data.ts
import XLSX2 from "xlsx";
var PROPERTY_TYPE_LABEL_ALIASES = {
  off: "Office",
  office: "Office",
  ind: "Industrial",
  indust: "Industrial",
  industrial: "Industrial",
  ret: "Retail",
  retail: "Retail",
  lnd: "Land",
  land: "Land",
  flx: "Flex",
  flex: "Flex",
  "r&d": "R&D",
  "r&d/flex": "R&D/Flex",
  "rd/flex": "R&D/Flex"
};
function normalizePropertyTypeLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  return PROPERTY_TYPE_LABEL_ALIASES[key] ?? raw;
}
function cleanText(value) {
  if (value === null || value === void 0) return "";
  const text2 = String(value).trim();
  if (!text2) return "";
  if (text2.toUpperCase() === "NULL") return "";
  return text2;
}
function cleanNumber(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = cleanText(value).replace(/[$,%]/g, "").replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
function excelSerialDate(serial) {
  const parsed = XLSX2.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y || parsed.y < 1900 || parsed.y > 2100) return "";
  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
}
function normalizeCompDateYear(yearText) {
  const n = Number(yearText);
  if (!Number.isInteger(n)) return null;
  if (n >= 1900 && n <= 2100) return n;
  if (n >= 0 && n <= 69) return 2e3 + n;
  if (n >= 70 && n <= 99) return 1900 + n;
  if (/^0+\d{1,2}$/.test(yearText)) return 2e3 + Number(yearText.slice(-2));
  return null;
}
function normalizeDateParts(year, month, day) {
  if (!year || year < 1900 || year > 2100) return "";
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return "";
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function normalizeCompDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelDate = excelSerialDate(value);
    if (excelDate) return excelDate;
  }
  const text2 = cleanText(value);
  if (!text2) return "";
  const isoLike = text2.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoLike) {
    return normalizeDateParts(
      normalizeCompDateYear(isoLike[1]),
      Number(isoLike[2]),
      Number(isoLike[3])
    );
  }
  const usLike = text2.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (usLike) {
    return normalizeDateParts(
      normalizeCompDateYear(usLike[3]),
      Number(usLike[1]),
      Number(usLike[2])
    );
  }
  const compactDate = text2.replace(/\D/g, "");
  if (/^(19|20)\d{6}$/.test(compactDate)) {
    return normalizeDateParts(
      normalizeCompDateYear(compactDate.slice(0, 4)),
      Number(compactDate.slice(4, 6)),
      Number(compactDate.slice(6, 8))
    );
  }
  const numericText = Number(text2);
  if (Number.isFinite(numericText)) {
    const excelDate = excelSerialDate(numericText);
    if (excelDate) return excelDate;
  }
  const parsed = new Date(text2);
  if (Number.isNaN(parsed.getTime())) return text2;
  const year = parsed.getUTCFullYear();
  if (year < 1900 || year > 2100) return "";
  return parsed.toISOString().slice(0, 10);
}
function cleanDate(value) {
  return normalizeCompDateValue(value);
}
function cleanFlag(value) {
  const text2 = cleanText(value).toUpperCase();
  if (text2 === "Y" || text2 === "YES" || text2 === "TRUE") return "Yes";
  if (text2 === "N" || text2 === "NO" || text2 === "FALSE") return "No";
  return cleanText(value);
}
var STREET_NUMBER_TOKEN = /^\d+[A-Za-z]?$/;
function joinAddress(parts) {
  const cleaned = parts.map(cleanText).filter(Boolean);
  if (!cleaned.length) return "";
  let head = cleaned;
  if (cleaned.length >= 2 && STREET_NUMBER_TOKEN.test(cleaned[0]) && STREET_NUMBER_TOKEN.test(cleaned[1])) {
    head = [`${cleaned[0]}-${cleaned[1]}`, ...cleaned.slice(2)];
  }
  return head.join(" ").replace(/\s+/g, " ").trim();
}
function getRowValue(row, key) {
  return row[key];
}
function formatNumber(value, decimals = 0) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
function formatPlainInteger(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  return String(Math.round(value));
}
function formatCurrency(value, decimals = 0) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}
function formatCurrencyPerSf(value, suffix = "") {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  return `${formatCurrency(value, 2)}${suffix}`;
}
function formatReportDate(value) {
  const normalized = normalizeCompDateValue(value);
  if (!normalized) return "";
  const isoDateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    return `${m}/${d}/${y}`;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  const yyyy = parsed.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
function formatParkingRatioDisplay(raw) {
  const t2 = String(raw ?? "").trim();
  if (!t2) return "";
  const norm = t2.replace(/\s+/g, "");
  const m = norm.match(/^(\d+(?:\.\d+)?)[:/](\d+(?:,\d{3})*|\d+)$/);
  if (!m) return t2;
  const left = Number(m[1]);
  const right = Number(String(m[2]).replace(/,/g, ""));
  if (!Number.isFinite(left) || !Number.isFinite(right)) return t2;
  return `${left.toFixed(1)}:${right.toLocaleString("en-US")}`;
}
function formatSaleTransactionTypeDisplay(raw) {
  const t2 = String(raw ?? "").trim();
  if (!t2) return "";
  const compact = t2.toLowerCase().replace(/[\s/_-]+/g, "");
  if (compact.includes("owner") && compact.includes("user")) return "User";
  if (compact === "investor" || compact === "investment") return "Investment";
  if (compact === "developer") return "Developer";
  if (compact.includes("saleleaseback")) return "Sale-Leaseback";
  if (compact.includes("partial")) return "Partial Interest";
  return t2;
}
var RENT_TYPE_ABBREV_RULES = [
  { match: /\bnnn\b/i, abbrev: "NNN" },
  { match: /\bmodified\s+gross\b/i, abbrev: "MG" },
  { match: /\bindustrial\s+gross\b/i, abbrev: "IG" },
  { match: /\bfull\s+service\s+gross\b/i, abbrev: "FSG" },
  { match: /\bfull\s+service\b/i, abbrev: "FS" },
  { match: /\bgross\b/i, abbrev: "G" },
  { match: /\bfs\b/i, abbrev: "FS" },
  { match: /\bfsg\b/i, abbrev: "FSG" },
  { match: /\bmg\b/i, abbrev: "MG" },
  { match: /\big\b/i, abbrev: "IG" }
];
function abbreviateRentTypeForReport(raw) {
  const t2 = String(raw ?? "").trim();
  if (!t2) return "";
  if (/^(G|IG|MG|NNN|FS|FSG|NN)$/i.test(t2)) return t2.toUpperCase();
  for (const { match, abbrev } of RENT_TYPE_ABBREV_RULES) {
    if (match.test(t2)) return abbrev;
  }
  return t2;
}
function formatRentAdjustmentsDisplay(raw) {
  const t2 = String(raw ?? "").trim();
  if (!t2) return "";
  const onlyNum = t2.replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(onlyNum);
  if (Number.isFinite(n) && n > 0 && n < 1 && !/%/.test(t2)) {
    return `${(n * 100).toFixed(1)}%`;
  }
  return t2.replace(/\b0\.\d+\b/g, (match) => {
    const v = Number(match);
    if (!Number.isFinite(v) || v <= 0 || v >= 1) return match;
    return `${(v * 100).toFixed(1)}%`;
  });
}
function buildBrokerLine(kind, brokerage, agents) {
  const namedAgents = agents.map((a) => (a ?? "").trim()).filter(Boolean);
  if (!brokerage && namedAgents.length === 0) return "";
  const label = kind === "List" ? "List. Brkr" : "Proc. Brkr";
  const agentText = namedAgents.length ? namedAgents.join(" & ") : "";
  if (brokerage && agentText) return `${label}: ${agentText} (${brokerage})`;
  if (brokerage) return `${label}: ${brokerage}`;
  return `${label}: ${agentText}`;
}
function buildUpdateLine(_verifiedBy, lastUpdated, id) {
  const parts = [];
  if (lastUpdated) parts.push(`Updated: ${formatReportDate(lastUpdated)}`);
  if (id !== null) parts.push(`#${id}`);
  return parts.join(" ");
}
function normalizeLeaseCompRecord(row, sourceSheet) {
  return {
    sourceSheet,
    id: cleanNumber(getRowValue(row, "ihlcID")),
    office: cleanText(getRowValue(row, "office")),
    address: joinAddress([
      getRowValue(row, "streetNumber1"),
      getRowValue(row, "streetNumber2"),
      getRowValue(row, "streetDirection"),
      getRowValue(row, "streetName"),
      getRowValue(row, "streetSuffix"),
      getRowValue(row, "suite")
    ]),
    city: cleanText(getRowValue(row, "city")),
    state: cleanText(getRowValue(row, "state")),
    zipCode: cleanText(getRowValue(row, "zipCode")),
    market: cleanText(getRowValue(row, "market")),
    subMarket: cleanText(getRowValue(row, "subMarket")),
    projectName: cleanText(getRowValue(row, "projectName")),
    propertyType: cleanText(getRowValue(row, "propertyType")),
    propertySubType: cleanText(getRowValue(row, "propertySubType")),
    buildingClass: cleanText(getRowValue(row, "buildingClass")),
    spaceType: cleanText(getRowValue(row, "spaceType")),
    multiTenant: cleanFlag(getRowValue(row, "multiTenant")),
    yearBuilt: cleanNumber(getRowValue(row, "yearBuilt")),
    constructionType: cleanText(getRowValue(row, "constructionType")),
    dhDoors: cleanNumber(getRowValue(row, "dhDoors")),
    glDoors: cleanNumber(getRowValue(row, "glDoors")),
    clearHeight: cleanNumber(getRowValue(row, "clearHeight")),
    amperage: cleanNumber(getRowValue(row, "amperage")),
    parkingType: cleanText(getRowValue(row, "parkingType")),
    parkingRatio: cleanText(getRowValue(row, "parkingRatio")),
    sprinklers: cleanFlag(getRowValue(row, "sprinklers")),
    rail: cleanFlag(getRowValue(row, "rail")),
    yard: cleanFlag(getRowValue(row, "yard")),
    pol: cleanFlag(getRowValue(row, "POL")),
    listBroker: cleanText(getRowValue(row, "listBroker")),
    procBroker: cleanText(getRowValue(row, "procBroker")),
    source: cleanText(getRowValue(row, "source")),
    verifiedBy: cleanText(getRowValue(row, "verifiedBy")),
    lastUpdated: cleanDate(getRowValue(row, "lastUpdated")),
    monthsOnMarket: cleanNumber(getRowValue(row, "monthsOnMarket")),
    transactionDate: cleanDate(getRowValue(row, "transactionDate")),
    occupancyDate: cleanDate(getRowValue(row, "occupancyDate")),
    expirationDate: cleanDate(getRowValue(row, "expirationDate")),
    leasedSqFt: cleanNumber(getRowValue(row, "leasedSqFt")),
    rentPerSqFt: cleanNumber(getRowValue(row, "rentPerSqFt")),
    rentType: cleanText(getRowValue(row, "rentType")),
    askRentPerSqFt: cleanNumber(getRowValue(row, "askRentPerSqFt")),
    askRentType: cleanText(getRowValue(row, "askRentType")),
    termInMonths: cleanNumber(getRowValue(row, "termInMonths")),
    effectiveRent: cleanNumber(getRowValue(row, "effectiveRent")),
    freeRentMonths: cleanNumber(getRowValue(row, "freeRentMonths")),
    rentAdjustments: cleanText(getRowValue(row, "rentAdjustments")),
    options: cleanText(getRowValue(row, "options")),
    tia: cleanText(getRowValue(row, "tia")),
    consideration: cleanText(getRowValue(row, "consideration")),
    lessee: cleanText(getRowValue(row, "lessee")),
    lesseeBusiness: cleanText(getRowValue(row, "lesseeBusiness")),
    lesseeContact: cleanText(getRowValue(row, "lesseeContact")),
    lesseePhone: cleanText(getRowValue(row, "lesseePhone")),
    lesseePriorLocation: cleanText(getRowValue(row, "lesseePriorLocation")),
    lessor: cleanText(getRowValue(row, "lessor")),
    comments: cleanText(getRowValue(row, "comments")),
    buildingSqFt: cleanNumber(getRowValue(row, "buildingSqFt")),
    officeSqFt: cleanNumber(getRowValue(row, "officeSqFt")),
    nnnCharges: cleanNumber(getRowValue(row, "NNNCharges")),
    landSqFt: cleanNumber(getRowValue(row, "landSqFt")),
    cam: cleanText(getRowValue(row, "CAM")),
    confidential: cleanFlag(getRowValue(row, "confidential")),
    expenseStop: cleanText(getRowValue(row, "expenseStop")),
    rentUse: cleanText(getRowValue(row, "rentUse")),
    photo: cleanText(getRowValue(row, "photo")),
    listAgent1: [cleanText(getRowValue(row, "listAgent1First")), cleanText(getRowValue(row, "listAgent1Last"))].filter(Boolean).join(" "),
    listAgent2: [cleanText(getRowValue(row, "listAgent2First")), cleanText(getRowValue(row, "listAgent2Last"))].filter(Boolean).join(" "),
    procAgent1: [cleanText(getRowValue(row, "procAgent1First")), cleanText(getRowValue(row, "procAgent1Last"))].filter(Boolean).join(" "),
    procAgent2: [cleanText(getRowValue(row, "procAgent2First")), cleanText(getRowValue(row, "procAgent2Last"))].filter(Boolean).join(" "),
    verified: cleanFlag(getRowValue(row, "verified")),
    updatedBy: cleanText(getRowValue(row, "updatedBy")),
    apn: cleanText(getRowValue(row, "APN"))
  };
}
function normalizeSaleCompRecord(row, sourceSheet) {
  return {
    sourceSheet,
    id: cleanNumber(getRowValue(row, "ihscID")),
    office: cleanText(getRowValue(row, "office")),
    address: joinAddress([
      getRowValue(row, "streetNumber1"),
      getRowValue(row, "streetNumber2"),
      getRowValue(row, "streetDirection"),
      getRowValue(row, "streetName"),
      getRowValue(row, "streetSuffix"),
      getRowValue(row, "suite")
    ]),
    city: cleanText(getRowValue(row, "city")),
    state: cleanText(getRowValue(row, "state")),
    zipCode: cleanText(getRowValue(row, "zipCode")),
    market: cleanText(getRowValue(row, "market")),
    subMarket: cleanText(getRowValue(row, "subMarket")),
    projectName: cleanText(getRowValue(row, "projectName")),
    propertyType: cleanText(getRowValue(row, "propertyType")),
    propertySubType: cleanText(getRowValue(row, "propertySubType")),
    buildingClass: cleanText(getRowValue(row, "buildingClass")),
    yearBuilt: cleanNumber(getRowValue(row, "yearBuilt")),
    constructionType: cleanText(getRowValue(row, "constructionType")),
    dhDoors: cleanNumber(getRowValue(row, "dhDoors")),
    glDoors: cleanNumber(getRowValue(row, "glDoors")),
    clearHeight: cleanNumber(getRowValue(row, "clearHeight")),
    amperage: cleanNumber(getRowValue(row, "amperage")),
    parkingType: cleanText(getRowValue(row, "parkingType")),
    parkingRatio: cleanText(getRowValue(row, "parkingRatio")),
    sprinklers: cleanFlag(getRowValue(row, "sprinklers")),
    rail: cleanFlag(getRowValue(row, "rail")),
    yard: cleanFlag(getRowValue(row, "yard")),
    multiTenant: cleanFlag(getRowValue(row, "multiTenant")),
    floors: cleanNumber(getRowValue(row, "floors")),
    passengerElevators: cleanNumber(getRowValue(row, "passengerElevators")),
    freightElevators: cleanNumber(getRowValue(row, "freightElevators")),
    listBroker: cleanText(getRowValue(row, "listBroker")),
    procBroker: cleanText(getRowValue(row, "procBroker")),
    source: cleanText(getRowValue(row, "source")),
    verifiedBy: cleanText(getRowValue(row, "verifiedBy")),
    lastUpdated: cleanDate(getRowValue(row, "lastUpdated")),
    monthsOnMarket: cleanNumber(getRowValue(row, "monthsOnMarket")),
    transactionDate: cleanDate(getRowValue(row, "transactionDate")),
    buildingSqFt: cleanNumber(getRowValue(row, "buildingSqFt")),
    landSqFt: cleanNumber(getRowValue(row, "landSqFt")),
    officeSqFt: cleanNumber(getRowValue(row, "officeSqFt")),
    salePrice: cleanNumber(getRowValue(row, "salePrice")),
    salePricePerSqFt: cleanNumber(getRowValue(row, "salePricePerSqFt")),
    capRate: cleanNumber(getRowValue(row, "capRate")),
    transactionType: cleanText(getRowValue(row, "transactionType")),
    buyer: cleanText(getRowValue(row, "buyer")),
    buyerBusiness: cleanText(getRowValue(row, "buyerBusiness")),
    buyerContact: cleanText(getRowValue(row, "buyerContact")),
    buyerPhone: cleanText(getRowValue(row, "buyerPhone")),
    buyerPriorLocation: cleanText(getRowValue(row, "buyerPriorLocation")),
    seller: cleanText(getRowValue(row, "seller")),
    sellerContact: cleanText(getRowValue(row, "sellerContact")),
    sellerPhone: cleanText(getRowValue(row, "sellerPhone")),
    comments: cleanText(getRowValue(row, "comments")),
    askingPrice: cleanNumber(getRowValue(row, "askingPrice")),
    photo: cleanText(getRowValue(row, "photo")),
    listAgent1: [cleanText(getRowValue(row, "listAgent1First")), cleanText(getRowValue(row, "listAgent1Last"))].filter(Boolean).join(" "),
    listAgent2: [cleanText(getRowValue(row, "listAgent2First")), cleanText(getRowValue(row, "listAgent2Last"))].filter(Boolean).join(" "),
    procAgent1: [cleanText(getRowValue(row, "procAgent1First")), cleanText(getRowValue(row, "procAgent1Last"))].filter(Boolean).join(" "),
    procAgent2: [cleanText(getRowValue(row, "procAgent2First")), cleanText(getRowValue(row, "procAgent2Last"))].filter(Boolean).join(" "),
    verified: cleanFlag(getRowValue(row, "verified")),
    updatedBy: cleanText(getRowValue(row, "updatedBy")),
    apn: cleanText(getRowValue(row, "APN"))
  };
}
function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX2.utils.sheet_to_json(sheet, {
    raw: true,
    defval: ""
  });
}
function parseWorkbook(workbook, workbookName) {
  const canonicalLeaseSheet = workbook.SheetNames.includes("LeeIrvine_LeaseComps") ? "LeeIrvine_LeaseComps" : workbook.SheetNames.find((name) => name.toLowerCase().includes("lease")) || "";
  const canonicalSaleSheet = workbook.SheetNames.includes("LeeIrvine_SalesComps") ? "LeeIrvine_SalesComps" : workbook.SheetNames.find((name) => name.toLowerCase().includes("sale")) || "";
  if (!canonicalLeaseSheet || !canonicalSaleSheet) {
    throw new Error("Could not identify the canonical lease and sale comp sheets.");
  }
  const leaseRows = sheetToRows(workbook, canonicalLeaseSheet);
  const saleRows = sheetToRows(workbook, canonicalSaleSheet);
  const regionalLeaseSheets = workbook.SheetNames.filter(
    (name) => name.startsWith("Lease_") && name !== canonicalLeaseSheet
  ).map((sheetName) => ({
    sheetName,
    rowCount: sheetToRows(workbook, sheetName).length
  }));
  return {
    workbookName,
    canonicalLeaseSheet,
    canonicalSaleSheet,
    leaseRecords: leaseRows.map((row) => normalizeLeaseCompRecord(row, canonicalLeaseSheet)),
    saleRecords: saleRows.map((row) => normalizeSaleCompRecord(row, canonicalSaleSheet)),
    regionalLeaseSheets
  };
}
function parseCompWorkbookBuffer(buffer, workbookName) {
  const workbook = XLSX2.read(buffer, { type: "buffer", cellDates: true });
  return parseWorkbook(workbook, workbookName);
}
function buildLeaseReportCard(record) {
  return {
    heading: record.projectName || record.address,
    addressLine: record.address,
    cityLine: [record.city, record.state, record.zipCode].filter(Boolean).join(", "),
    submarketLine: [record.market, record.subMarket].filter(Boolean).join(" / "),
    listingBrokerLine: buildBrokerLine("List", record.listBroker, [record.listAgent1, record.listAgent2]),
    procuringBrokerLine: buildBrokerLine("Proc", record.procBroker, [record.procAgent1, record.procAgent2]),
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    photo: record.photo,
    fields: {
      "Space Leased": formatNumber(record.leasedSqFt),
      Office: formatNumber(record.officeSqFt),
      "Trans. Date": formatReportDate(record.transactionDate),
      "Prop. Type": record.propertyType,
      "On Mrkt": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Lessee: record.lessee,
      "Rent/SqFt": [formatCurrencyPerSf(record.rentPerSqFt), abbreviateRentTypeForReport(record.rentType)].filter(Boolean).join(" "),
      "TI Allow": record.tia,
      "Expir. Date": formatReportDate(record.expirationDate),
      Subtype: record.propertySubType,
      Amps: formatNumber(record.amperage),
      GL: formatNumber(record.glDoors),
      Rail: record.rail,
      Lessor: record.lessor,
      "Eff. Rent": formatCurrencyPerSf(record.effectiveRent),
      "Free Rent": record.freeRentMonths !== null ? `${formatNumber(record.freeRentMonths)} mos` : "",
      Term: record.termInMonths !== null ? `${formatNumber(record.termInMonths)} mos` : "",
      "Bldg. Class": record.buildingClass,
      "Mul-Ten": record.multiTenant,
      POL: record.pol,
      Yrd: record.yard,
      "Space Type": record.spaceType,
      "Bldg SqFt": formatNumber(record.buildingSqFt),
      "NNN Chgs": formatCurrencyPerSf(record.nnnCharges),
      "Occ Date": formatReportDate(record.occupancyDate),
      Parking: formatParkingRatioDisplay(record.parkingRatio),
      "Yr Built": formatPlainInteger(record.yearBuilt),
      HT: formatNumber(record.clearHeight),
      Land: formatNumber(record.landSqFt),
      "Options/Rent Adj": [record.options, formatRentAdjustmentsDisplay(record.rentAdjustments)].filter(Boolean).join(" / ")
    }
  };
}
function buildSaleReportCard(record) {
  return {
    heading: record.projectName || record.address,
    addressLine: record.address,
    cityLine: [record.city, record.state, record.zipCode].filter(Boolean).join(", "),
    submarketLine: [record.market, record.subMarket].filter(Boolean).join(" / "),
    listingBrokerLine: buildBrokerLine("List", record.listBroker, [record.listAgent1, record.listAgent2]),
    procuringBrokerLine: buildBrokerLine("Proc", record.procBroker, [record.procAgent1, record.procAgent2]),
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    photo: record.photo,
    fields: {
      "Bldg. SqFt": formatNumber(record.buildingSqFt),
      "Sale Price": formatCurrency(record.salePrice),
      "Trans. Date": formatReportDate(record.transactionDate),
      "Prop. Type": record.propertyType,
      "Yr Built": formatPlainInteger(record.yearBuilt),
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Buyer: record.buyer,
      "Office SqFt": formatNumber(record.officeSqFt),
      "Sale $/SF": formatCurrencyPerSf(record.salePricePerSqFt),
      "On Market": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      Subtype: record.propertySubType,
      "Mul-Tnt": record.multiTenant,
      GL: formatNumber(record.glDoors),
      RR: record.rail,
      Seller: record.seller,
      "Land Size": formatNumber(record.landSqFt),
      "Trans. Type": formatSaleTransactionTypeDisplay(record.transactionType),
      "Cap Rate": record.capRate !== null ? `${record.capRate}%` : "",
      "Bldg. Class": record.buildingClass,
      Amps: formatNumber(record.amperage),
      Clr: formatNumber(record.clearHeight),
      Yard: record.yard,
      "Buyer Previous Location": record.buyerPriorLocation
    }
  };
}

// server/_core/map.ts
function getMapsConfig() {
  if (ENV.googleMapsApiKey) {
    return {
      baseUrl: "https://maps.googleapis.com",
      apiKey: ENV.googleMapsApiKey
    };
  }
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Google Maps credentials missing: set GOOGLE_MAPS_API_KEY (preferred) or BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY"
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey
  };
}
function getMapsConfigOrNull() {
  try {
    return getMapsConfig();
  } catch {
    return null;
  }
}
function buildMapsAssetUrl(endpoint, params = {}) {
  const config = getMapsConfigOrNull();
  if (!config) return "";
  const { baseUrl, apiKey } = config;
  if (baseUrl === "https://maps.googleapis.com") {
    const url2 = new URL(`/api${endpoint}`, "http://localhost");
    for (const [key, value] of Object.entries(params)) {
      if (value === void 0 || value === null) continue;
      url2.searchParams.append(key, String(value));
    }
    return `${url2.pathname}${url2.search}`;
  }
  const url = new URL(`${baseUrl}/v1/maps/proxy${endpoint}`);
  url.searchParams.append("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null) continue;
    url.searchParams.append(key, String(value));
  }
  return url.toString();
}
function buildStreetViewPhotoUrl(params) {
  const location = params.location.trim();
  if (!location) return "";
  return buildMapsAssetUrl("/maps/api/streetview", {
    size: params.size ?? "400x260",
    location,
    fov: params.fov ?? 70,
    pitch: params.pitch ?? 0,
    ...params.heading != null ? { heading: params.heading } : {},
    source: params.source ?? "outdoor"
  });
}

// server/services/compData.ts
var INSERT_BATCH_SIZE = 500;
function chunkArray(items, size) {
  const chunks = [];
  for (let index2 = 0; index2 < items.length; index2 += size) {
    chunks.push(items.slice(index2, index2 + size));
  }
  return chunks;
}
function numberFromCount(value) {
  const count3 = Number(value ?? 0);
  return Number.isFinite(count3) ? count3 : 0;
}
function stringifyRecord(value) {
  return JSON.stringify(value);
}
function parseLeasePayload(value) {
  return JSON.parse(value);
}
function parseSalePayload(value) {
  return JSON.parse(value);
}
function normalizeFilterText(value) {
  return value?.trim() ?? "";
}
var FILTER_ALIASES = {
  "airport area": ["Airport Area", "IBC"],
  "brea/fullerton": ["Brea/Fullerton", "Brea", "Fullerton", "NOC"],
  "chino/chino hills": ["Chino/Chino Hills", "Chino", "Chino Hills"],
  "costa mesa/newport": ["Costa Mesa/Newport", "Costa Mesa", "Newport Beach", "Newport", "SCM"],
  "fontana/rialto": ["Fontana/Rialto", "Fontana", "Rialto"],
  "la mirada/norwalk": ["La Mirada/Norwalk", "La Mirada", "Norwalk", "Mid Cities"],
  "orange/tustin": ["Orange/Tustin", "Orange", "Tustin", "NOC", "WC"],
  "santa ana": ["Santa Ana", "SAE", "SCM"],
  "vernon/commerce": ["Vernon/Commerce", "Vernon", "Commerce"],
  "orange county": ["Orange County", "Orange"],
  orange: ["Orange County", "Orange"],
  "inland empire": ["Inland Empire", "Riverside", "San Bernardino"],
  "ie": ["IE", "IE East"],
  "ie east": ["IE East", "IE"],
  "ie west": ["IE West"],
  ind: ["IND", "Indust", "Industrial"],
  indust: ["Indust", "Industrial", "IND"],
  industrial: ["Industrial", "Indust", "IND"],
  off: ["OFF", "Office"],
  office: ["Office", "OFF"],
  ret: ["RET", "Retail"],
  retail: ["Retail", "RET"],
  lnd: ["LND", "Land"],
  land: ["Land", "LND"],
  flex: ["Flex", "FLEX", "FLX", "R&D/Flex"],
  "r&d/flex": ["R&D/Flex", "R&D", "Flex", "FLEX", "FLX"]
};
function normalizeSubMarketLabel(value) {
  const trimmed = value?.trim?.() ?? "";
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "ie") return "IE East";
  return trimmed;
}
function expandFilterValues(values) {
  const expanded = /* @__PURE__ */ new Set();
  for (const rawValue of values ?? []) {
    const value = rawValue.trim();
    if (!value) continue;
    expanded.add(value);
    const aliasValues = FILTER_ALIASES[value.toLowerCase()] ?? [];
    for (const alias2 of aliasValues) expanded.add(alias2);
    for (const part of value.split("/")) {
      const trimmed = part.trim();
      if (trimmed) expanded.add(trimmed);
    }
  }
  return Array.from(expanded);
}
function buildFlexibleTextFilter(column, values) {
  const terms = expandFilterValues(values);
  if (!terms.length) return null;
  return or(
    ...terms.flatMap((term) => [
      eq2(column, term),
      like(column, `%${term}%`)
    ])
  );
}
function buildLeaseMetricLine(record) {
  const pieces = [
    record.leasedSqFt ? `${record.leasedSqFt.toLocaleString("en-US")} SF leased` : "",
    record.rentPerSqFt ? `Rent ${buildLeaseReportCard(record).fields["Rent/SqFt"]}` : "",
    record.transactionDate ? `Trans ${record.transactionDate}` : ""
  ].filter(Boolean);
  return pieces.join(" \u2022 ");
}
function buildSaleMetricLine(record) {
  const saleCard = buildSaleReportCard(record);
  const pieces = [
    record.buildingSqFt ? `${record.buildingSqFt.toLocaleString("en-US")} SF` : "",
    saleCard.fields["Sale Price"] ? saleCard.fields["Sale Price"] : "",
    record.transactionDate ? `Trans ${record.transactionDate}` : ""
  ].filter(Boolean);
  return pieces.join(" \u2022 ");
}
function buildMetaLine(record) {
  return [record.market, record.subMarket, record.propertyType, record.propertySubType].filter(Boolean).join(" \u2022 ");
}
function mapLeaseSearchResult(row) {
  const record = parseLeasePayload(row.rawPayload);
  const fallbackPhoto = buildStreetViewPhotoUrl({
    location: [record.address, record.city, record.state, record.zipCode].filter(Boolean).join(", ")
  });
  const photo = record.photo?.trim() ? record.photo : fallbackPhoto;
  const normalizedRecord = {
    ...record,
    propertyType: normalizePropertyTypeLabel(record.propertyType),
    subMarket: normalizeSubMarketLabel(record.subMarket)
  };
  const recordForCard = photo ? { ...normalizedRecord, photo } : normalizedRecord;
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
    subMarket: normalizedRecord.subMarket,
    propertyType: normalizedRecord.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    source: record.source,
    reportCard: buildLeaseReportCard(recordForCard),
    metricLine: buildLeaseMetricLine(record),
    metaLine: buildMetaLine(recordForCard),
    photo
  };
}
function mapSaleSearchResult(row) {
  const record = parseSalePayload(row.rawPayload);
  const fallbackPhoto = buildStreetViewPhotoUrl({
    location: [record.address, record.city, record.state, record.zipCode].filter(Boolean).join(", ")
  });
  const photo = record.photo?.trim() ? record.photo : fallbackPhoto;
  const normalizedRecord = {
    ...record,
    propertyType: normalizePropertyTypeLabel(record.propertyType),
    subMarket: normalizeSubMarketLabel(record.subMarket)
  };
  const recordForCard = photo ? { ...normalizedRecord, photo } : normalizedRecord;
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
    subMarket: normalizedRecord.subMarket,
    propertyType: normalizedRecord.propertyType,
    propertySubType: record.propertySubType,
    transactionDate: record.transactionDate,
    source: record.source,
    reportCard: buildSaleReportCard(recordForCard),
    metricLine: buildSaleMetricLine(record),
    metaLine: buildMetaLine(recordForCard),
    photo
  };
}
function buildLeaseInsertRows(records, importId) {
  return records.map((record) => ({
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
    rawPayload: stringifyRecord(record)
  }));
}
function buildSaleInsertRows(records, importId) {
  return records.map((record) => ({
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
    rawPayload: stringifyRecord(record)
  }));
}
async function insertLeaseBatches(db, rows) {
  for (const batch of chunkArray(rows, INSERT_BATCH_SIZE)) {
    if (!batch.length) continue;
    await db.insert(leaseComps).values(batch);
  }
}
async function insertSaleBatches(db, rows) {
  for (const batch of chunkArray(rows, INSERT_BATCH_SIZE)) {
    if (!batch.length) continue;
    await db.insert(saleComps).values(batch);
  }
}
async function addSingleComp(params) {
  const { db, compType, record } = params;
  let activeImport = await getLatestCompImport(db);
  if (!activeImport) {
    const [inserted] = await db.insert(compImports).values({
      workbookName: "Manual Entries",
      canonicalLeaseSheet: "Manual-Lease",
      canonicalSaleSheet: "Manual-Sale",
      leaseCount: 0,
      saleCount: 0,
      status: "active"
    });
    const importId = inserted.insertId;
    if (!importId) throw new Error("Failed to create import record.");
    const rows = await db.select().from(compImports).where(eq2(compImports.id, importId)).limit(1);
    activeImport = rows[0] ?? null;
  }
  if (!activeImport) throw new Error("No active import.");
  if (compType === "lease") {
    const rows = buildLeaseInsertRows([record], activeImport.id);
    const [inserted] = await db.insert(leaseComps).values(rows);
    await db.update(compImports).set({ leaseCount: sql2`${compImports.leaseCount} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, activeImport.id));
    return {
      importId: activeImport.id,
      compId: inserted.insertId ?? null
    };
  } else {
    const rows = buildSaleInsertRows([record], activeImport.id);
    const [inserted] = await db.insert(saleComps).values(rows);
    await db.update(compImports).set({ saleCount: sql2`${compImports.saleCount} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, activeImport.id));
    return {
      importId: activeImport.id,
      compId: inserted.insertId ?? null
    };
  }
}
async function fetchWorkbookBufferFromStorage(fileKey) {
  const stored = await storageGet(fileKey);
  const response = await fetch(stored.url);
  if (!response.ok) {
    throw new Error(`Workbook download failed (${response.status} ${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    sourceUrl: stored.url
  };
}
async function getLatestCompImport(db) {
  const rows = await db.select().from(compImports).where(eq2(compImports.status, "active")).orderBy(desc(compImports.createdAt)).limit(1);
  return rows[0] ?? null;
}
async function importCompWorkbookBuffer(params) {
  const {
    db,
    buffer,
    workbookName,
    sourceFilename,
    sourceFileKey,
    sourceUrl,
    importedByOpenId,
    importedByEmail
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
    importedByEmail: importedByEmail ?? null
  });
  const importId = inserted.insertId;
  if (!importId) {
    throw new Error("Failed to create comp import record.");
  }
  try {
    await insertLeaseBatches(db, buildLeaseInsertRows(parsed.leaseRecords, importId));
    await insertSaleBatches(db, buildSaleInsertRows(parsed.saleRecords, importId));
    await db.update(compImports).set({ status: "archived", updatedAt: /* @__PURE__ */ new Date() }).where(and(eq2(compImports.status, "active"), ne(compImports.id, importId)));
    await db.update(compImports).set({ status: "active", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, importId));
    const createdRows = await db.select().from(compImports).where(eq2(compImports.id, importId)).limit(1);
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
      createdAt: created.createdAt
    };
  } catch (error) {
    await db.delete(leaseComps).where(eq2(leaseComps.importId, importId));
    await db.delete(saleComps).where(eq2(saleComps.importId, importId));
    await db.update(compImports).set({ status: "failed", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, importId));
    throw error;
  }
}
async function searchCompRows(params) {
  const { db, compType, importId, filters } = params;
  const limit = Math.max(1, filters.limit);
  const offset = Math.max(0, filters.offset ?? 0);
  const queryText = normalizeFilterText(filters.query);
  const cities = filters.cities?.filter(Boolean) ?? [];
  const markets = filters.markets?.filter(Boolean) ?? [];
  const subMarkets = filters.subMarkets?.filter(Boolean) ?? [];
  const propertyTypes = filters.propertyTypes?.filter(Boolean) ?? [];
  const { sfMin, sfMax } = filters;
  const dateFrom = normalizeFilterText(filters.dateFrom);
  const dateTo = normalizeFilterText(filters.dateTo);
  if (compType === "lease") {
    const conditions2 = [eq2(leaseComps.importId, importId)];
    if (queryText) {
      conditions2.push(
        or(
          like(leaseComps.address, `%${queryText}%`),
          like(leaseComps.projectName, `%${queryText}%`),
          like(leaseComps.city, `%${queryText}%`),
          like(leaseComps.market, `%${queryText}%`),
          like(leaseComps.subMarket, `%${queryText}%`),
          like(leaseComps.propertyType, `%${queryText}%`)
        )
      );
    }
    const cityFilter2 = buildFlexibleTextFilter(leaseComps.city, cities);
    const marketFilter2 = buildFlexibleTextFilter(leaseComps.market, markets);
    const subMarketFilter2 = buildFlexibleTextFilter(leaseComps.subMarket, subMarkets);
    const propertyTypeFilter2 = buildFlexibleTextFilter(leaseComps.propertyType, propertyTypes);
    if (cityFilter2) conditions2.push(cityFilter2);
    if (marketFilter2) conditions2.push(marketFilter2);
    if (subMarketFilter2) conditions2.push(subMarketFilter2);
    if (propertyTypeFilter2) conditions2.push(propertyTypeFilter2);
    if (sfMin !== void 0) conditions2.push(sql2`CAST(JSON_UNQUOTE(JSON_EXTRACT(${leaseComps.rawPayload}, '$.leasedSqFt')) AS SIGNED) >= ${sfMin}`);
    if (sfMax !== void 0) conditions2.push(sql2`CAST(JSON_UNQUOTE(JSON_EXTRACT(${leaseComps.rawPayload}, '$.leasedSqFt')) AS SIGNED) <= ${sfMax}`);
    if (dateFrom) conditions2.push(gte(leaseComps.transactionDate, dateFrom));
    if (dateTo) conditions2.push(lte(leaseComps.transactionDate, dateTo));
    const whereClause2 = and(...conditions2);
    const countRows2 = await db.select({ count: sql2`count(*)` }).from(leaseComps).where(whereClause2);
    const total2 = numberFromCount(countRows2[0]?.count);
    const rows2 = await db.select().from(leaseComps).where(whereClause2).orderBy(desc(leaseComps.transactionDate), desc(leaseComps.id)).limit(limit).offset(offset);
    const results2 = rows2.map(mapLeaseSearchResult);
    return {
      results: results2,
      total: total2,
      offset,
      limit,
      hasNext: offset + results2.length < total2,
      hasPrevious: offset > 0
    };
  }
  const conditions = [eq2(saleComps.importId, importId)];
  if (queryText) {
    conditions.push(
      or(
        like(saleComps.address, `%${queryText}%`),
        like(saleComps.projectName, `%${queryText}%`),
        like(saleComps.city, `%${queryText}%`),
        like(saleComps.market, `%${queryText}%`),
        like(saleComps.subMarket, `%${queryText}%`),
        like(saleComps.propertyType, `%${queryText}%`)
      )
    );
  }
  const cityFilter = buildFlexibleTextFilter(saleComps.city, cities);
  const marketFilter = buildFlexibleTextFilter(saleComps.market, markets);
  const subMarketFilter = buildFlexibleTextFilter(saleComps.subMarket, subMarkets);
  const propertyTypeFilter = buildFlexibleTextFilter(saleComps.propertyType, propertyTypes);
  if (cityFilter) conditions.push(cityFilter);
  if (marketFilter) conditions.push(marketFilter);
  if (subMarketFilter) conditions.push(subMarketFilter);
  if (propertyTypeFilter) conditions.push(propertyTypeFilter);
  if (sfMin !== void 0) conditions.push(sql2`CAST(JSON_UNQUOTE(JSON_EXTRACT(${saleComps.rawPayload}, '$.buildingSqFt')) AS SIGNED) >= ${sfMin}`);
  if (sfMax !== void 0) conditions.push(sql2`CAST(JSON_UNQUOTE(JSON_EXTRACT(${saleComps.rawPayload}, '$.buildingSqFt')) AS SIGNED) <= ${sfMax}`);
  if (dateFrom) conditions.push(gte(saleComps.transactionDate, dateFrom));
  if (dateTo) conditions.push(lte(saleComps.transactionDate, dateTo));
  const whereClause = and(...conditions);
  const countRows = await db.select({ count: sql2`count(*)` }).from(saleComps).where(whereClause);
  const total = numberFromCount(countRows[0]?.count);
  const rows = await db.select().from(saleComps).where(whereClause).orderBy(desc(saleComps.transactionDate), desc(saleComps.id)).limit(limit).offset(offset);
  const results = rows.map(mapSaleSearchResult);
  return {
    results,
    total,
    offset,
    limit,
    hasNext: offset + results.length < total,
    hasPrevious: offset > 0
  };
}

// server/routers/compData.ts
var compTypeSchema = z4.enum(["lease", "sale"]);
var filterArr = z4.array(z4.string().trim().max(120)).optional();
var searchInputSchema = z4.object({
  compType: compTypeSchema,
  query: z4.string().trim().max(200).optional(),
  cities: filterArr,
  markets: filterArr,
  subMarkets: filterArr,
  propertyTypes: filterArr,
  sfMin: z4.number().min(0).optional(),
  sfMax: z4.number().min(0).optional(),
  dateFrom: z4.string().trim().max(32).optional(),
  dateTo: z4.string().trim().max(32).optional(),
  limit: z4.number().min(1).max(100).default(20),
  offset: z4.number().min(0).default(0)
});
var manualRecordSchema = z4.object({}).catchall(z4.unknown());
var addCompInputSchema = z4.object({
  compType: compTypeSchema,
  record: manualRecordSchema
});
function textValue(input, key, fallback = "") {
  const value = input[key];
  if (value === null || value === void 0) return fallback;
  return String(value).trim();
}
function numberValue(input, key) {
  const value = input[key];
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized.replace(/[$,%]/g, ""));
  if (Number.isFinite(parsed)) return parsed;
  const firstNumber = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!firstNumber) return null;
  const extracted = Number(firstNumber[0]);
  return Number.isFinite(extracted) ? extracted : null;
}
function dateValue(input, key) {
  return normalizeCompDateValue(input[key]);
}
function brokerSubmittedRecord(input, user) {
  const submitter = user.name || user.email || "Broker Submission";
  return {
    ...input,
    source: textValue(input, "source") || submitter,
    verifiedBy: textValue(input, "verifiedBy") || submitter,
    lastUpdated: textValue(input, "lastUpdated") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  };
}
function manualLeaseRecord(input) {
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
    lastUpdated: dateValue(input, "lastUpdated") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
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
    photo: textValue(input, "photo"),
    listAgent1: textValue(input, "listAgent1"),
    listAgent2: textValue(input, "listAgent2"),
    procAgent1: textValue(input, "procAgent1"),
    procAgent2: textValue(input, "procAgent2"),
    verified: textValue(input, "verified"),
    updatedBy: textValue(input, "updatedBy"),
    apn: textValue(input, "apn")
  };
}
function manualSaleRecord(input) {
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
    lastUpdated: dateValue(input, "lastUpdated") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
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
    photo: textValue(input, "photo"),
    listAgent1: textValue(input, "listAgent1"),
    listAgent2: textValue(input, "listAgent2"),
    procAgent1: textValue(input, "procAgent1"),
    procAgent2: textValue(input, "procAgent2"),
    verified: textValue(input, "verified"),
    updatedBy: textValue(input, "updatedBy"),
    apn: textValue(input, "apn")
  };
}
var compDataRouter = router({
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
      updatedAt: latest.updatedAt
    };
  }),
  listImports: adminProcedure.input(z4.object({ limit: z4.number().min(1).max(50).default(12) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 12;
    return db.select().from(compImports).orderBy(desc2(compImports.createdAt)).limit(limit);
  }),
  importWorkbook: adminProcedure.input(
    z4.object({
      fileKey: z4.string().min(1),
      filename: z4.string().min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
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
      importedByEmail: ctx.user.email ?? null
    });
    return {
      success: true,
      ...result
    };
  }),
  addComp: adminProcedure.input(addCompInputSchema).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }
    const record = input.compType === "lease" ? manualLeaseRecord(input.record) : manualSaleRecord(input.record);
    const stored = await addSingleComp({
      db,
      compType: input.compType,
      record
    });
    return { success: true, ...stored };
  }),
  submitComp: protectedProcedure.input(addCompInputSchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }
    const recordInput = brokerSubmittedRecord(input.record, ctx.user);
    const record = input.compType === "lease" ? manualLeaseRecord(recordInput) : manualSaleRecord(recordInput);
    const stored = await addSingleComp({
      db,
      compType: input.compType,
      record
    });
    return { success: true, ...stored };
  }),
  search: protectedProcedure.input(searchInputSchema).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return {
        latestImport: null,
        results: []
      };
    }
    const latestImport = await getLatestCompImport(db);
    if (!latestImport) {
      return {
        latestImport: null,
        results: []
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
        offset: input.offset
      }
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
        createdAt: latestImport.createdAt
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
        previousOffset: page.hasPrevious ? Math.max(0, page.offset - page.limit) : null
      }
    };
  })
});

// server/routers/email.ts
init_schema();
import { execSync } from "child_process";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import { z as z5 } from "zod/v4";
init_db();
import { eq as eq4 } from "drizzle-orm";
var fieldSchema = z5.object({
  label: z5.string(),
  value: z5.string()
});
var sectionSchema = z5.object({
  title: z5.string(),
  fields: z5.array(fieldSchema)
});
var pdfAttachmentSchema = z5.object({
  filename: z5.string().trim().min(1).max(255),
  mimeType: z5.literal("application/pdf").default("application/pdf"),
  base64Data: z5.string().min(1)
});
var sendToAdminInput = z5.object({
  formType: z5.enum(["listing", "voucher", "sign"]),
  brokerName: z5.string().optional(),
  propertyAddress: z5.string().optional(),
  sections: z5.array(sectionSchema),
  senderEmail: z5.string().email().optional(),
  pdfAttachment: pdfAttachmentSchema.optional(),
  formData: z5.record(z5.string(), z5.unknown()).optional()
});
function formLabelFor(formType) {
  return formType === "listing" ? "Listing Entry" : formType === "sign" ? "Sign Request" : "Commission Voucher";
}
function sanitizeFileName(filename) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}
async function buildEmailBody(params) {
  const { formType, brokerName, propertyAddress, sections, archivedPdfUrl, archivedPdfName } = params;
  const companyName = String(await getSetting("branding.company_name"));
  const supportEmail = String(await getSetting("branding.support_email"));
  const now = (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short"
  });
  const sectionLines = sections.filter((section) => section.fields.some((field) => field.value.trim())).map((section) => {
    const rows = section.fields.filter((field) => field.value.trim()).map((field) => `  ${field.label}: ${field.value}`).join("\n");
    return `
--- ${section.title} ---
${rows}`;
  }).join("\n");
  return [
    `${companyName} - ${formLabelFor(formType)} Submission`,
    `Submitted: ${now}`,
    brokerName ? `Broker: ${brokerName}` : "",
    propertyAddress ? `Property: ${propertyAddress}` : "",
    archivedPdfUrl ? `Archived PDF: ${archivedPdfName || "submission.pdf"} - ${archivedPdfUrl}` : "",
    "",
    "=".repeat(60),
    sectionLines,
    "",
    "=".repeat(60),
    "",
    "This email was generated automatically by the Broker Submission Tool.",
    `${supportEmail} | ${companyName}`
  ].filter(Boolean).join("\n");
}
function isSmtpConfigured() {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}
async function sendViaSmtp(params) {
  try {
    const transporter = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      requireTLS: !ENV.smtpSecure,
      // enforce STARTTLS on port 587 when not using implicit TLS
      auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : void 0
    });
    await transporter.sendMail({
      from: ENV.smtpFrom,
      to: params.to.join(", "),
      cc: params.cc.length ? params.cc.join(", ") : void 0,
      replyTo: params.cc[0] || void 0,
      subject: params.subject,
      text: params.content,
      attachments: params.archivedPdf ? [
        {
          filename: params.archivedPdf.filename,
          content: Buffer.from(params.archivedPdf.base64Data, "base64"),
          contentType: params.archivedPdf.mimeType
        }
      ] : void 0
    });
    return {
      success: true,
      deliveryMethod: "smtp",
      attachmentIncluded: Boolean(params.archivedPdf)
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function sendViaOutlookMcp(params) {
  try {
    const message = {
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      content: params.content
    };
    if (params.includeAttachment && params.archivedPdf) {
      message.attachments = [
        {
          filename: params.archivedPdf.filename,
          name: params.archivedPdf.filename,
          contentType: params.archivedPdf.mimeType,
          mimeType: params.archivedPdf.mimeType,
          contentBytes: params.archivedPdf.base64Data
        }
      ];
    }
    const input = JSON.stringify({ messages: [message] });
    const escaped = input.replace(/'/g, "'\\''");
    execSync(`mcp-cli tool call outlook_send_messages --server outlook-mail --input '${escaped}'`, {
      timeout: 3e4,
      stdio: "pipe"
    });
    return {
      success: true,
      deliveryMethod: params.includeAttachment && params.archivedPdf ? "outlook-mcp" : "outlook-mcp-link",
      attachmentIncluded: Boolean(params.includeAttachment && params.archivedPdf)
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function deliverSubmissionEmail(params) {
  if (isSmtpConfigured()) {
    const smtpResult = await sendViaSmtp(params);
    if (smtpResult.success) {
      return smtpResult;
    }
  }
  const mcpWithAttachment = sendViaOutlookMcp({
    ...params,
    includeAttachment: Boolean(params.archivedPdf)
  });
  if (mcpWithAttachment.success) {
    return mcpWithAttachment;
  }
  if (params.archivedPdf) {
    const fallbackWithoutAttachment = sendViaOutlookMcp({
      ...params,
      includeAttachment: false
    });
    if (fallbackWithoutAttachment.success) {
      return fallbackWithoutAttachment;
    }
  }
  return mcpWithAttachment;
}
async function archivePdf(params) {
  const safeFilename = sanitizeFileName(params.pdfAttachment.filename);
  const buffer = Buffer.from(params.pdfAttachment.base64Data, "base64");
  if (!buffer.length) {
    throw new Error("Generated PDF is empty.");
  }
  const fileKey = `broker-docs/submissions/${params.formType}/${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}/${nanoid(10)}-${safeFilename}`;
  const { url } = await storagePut(fileKey, buffer, params.pdfAttachment.mimeType);
  const db = await getDb();
  if (db) {
    await db.insert(uploads).values({
      fileKey,
      url,
      filename: safeFilename,
      mimeType: params.pdfAttachment.mimeType,
      fileSize: buffer.length,
      category: "submission_pdf",
      reference: params.propertyAddress || null,
      uploaderName: params.brokerName || params.senderEmail || null,
      uploaderOpenId: params.uploaderOpenId ?? null
    });
  }
  return {
    filename: safeFilename,
    mimeType: params.pdfAttachment.mimeType,
    base64Data: params.pdfAttachment.base64Data,
    fileKey,
    url,
    fileSize: buffer.length
  };
}
async function recordSubmissionRequest(params) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable. The request could not be recorded for the admin portal.");
  }
  const status = "pending";
  const [result] = await db.insert(submissions).values({
    formType: params.formType,
    status,
    reference: params.propertyAddress || null,
    submittedBy: params.brokerName || params.senderEmail || null,
    submittedByOpenId: params.uploaderOpenId ?? null,
    submittedByEmail: params.senderEmail ?? null,
    pdfFileKey: params.archivedPdf?.fileKey ?? null,
    pdfUrl: params.archivedPdf?.url ?? null,
    payload: JSON.stringify({
      brokerName: params.brokerName,
      senderEmail: params.senderEmail ?? "",
      propertyAddress: params.propertyAddress,
      sections: params.sections,
      formData: params.formData ?? null,
      archivedFile: params.archivedPdf ? {
        fileKey: params.archivedPdf.fileKey,
        url: params.archivedPdf.url,
        filename: params.archivedPdf.filename,
        fileSize: params.archivedPdf.fileSize
      } : null,
      deliveryMethod: params.deliveryMethod ?? "",
      deliveryError: params.deliveryError ?? ""
    })
  });
  return {
    id: result.insertId ?? null,
    status
  };
}
var emailRouter = router({
  sendToAdmin: publicProcedure.input(sendToAdminInput).mutation(async ({ input, ctx }) => {
    const { formType, brokerName = "", propertyAddress = "", sections, senderEmail, pdfAttachment, formData } = input;
    const adminEmail = ENV.adminEmail;
    if (!adminEmail) {
      return {
        success: false,
        error: "Admin email not configured. Please set ADMIN_EMAIL in environment variables."
      };
    }
    let archivedPdf;
    if (pdfAttachment) {
      try {
        archivedPdf = await archivePdf({
          formType,
          propertyAddress,
          pdfAttachment,
          brokerName: brokerName || ctx.user?.name || void 0,
          senderEmail,
          uploaderOpenId: ctx.user?.openId ?? null
        });
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    const addressPart = propertyAddress ? ` - ${propertyAddress}` : "";
    const companyName = String(await getSetting("branding.company_name"));
    const subject = `[${companyName}] ${formLabelFor(formType)} Submission${addressPart}`;
    const content = await buildEmailBody({
      formType,
      brokerName,
      propertyAddress,
      sections,
      archivedPdfUrl: archivedPdf?.url,
      archivedPdfName: archivedPdf?.filename
    });
    const delivery = formType === "sign" ? {
      success: true,
      deliveryMethod: "queue-only",
      // Queue-only: no email is sent, so no attachment is included in delivery.
      attachmentIncluded: false,
      error: void 0
    } : await deliverSubmissionEmail({
      to: [adminEmail],
      cc: senderEmail ? [senderEmail] : [],
      subject,
      content,
      archivedPdf
    });
    let recordedSubmission = null;
    try {
      recordedSubmission = await recordSubmissionRequest({
        formType,
        brokerName,
        propertyAddress,
        sections,
        senderEmail,
        archivedPdf,
        uploaderOpenId: ctx.user?.openId ?? null,
        deliveryMethod: delivery.deliveryMethod,
        deliveryError: delivery.error,
        formData
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        deliveryMethod: delivery.deliveryMethod,
        attachmentIncluded: delivery.attachmentIncluded,
        archivedFile: archivedPdf ? {
          fileKey: archivedPdf.fileKey,
          url: archivedPdf.url,
          filename: archivedPdf.filename,
          fileSize: archivedPdf.fileSize
        } : null
      };
    }
    return {
      success: delivery.success,
      error: delivery.error,
      deliveryMethod: delivery.deliveryMethod,
      attachmentIncluded: delivery.attachmentIncluded,
      submissionId: recordedSubmission?.id ?? null,
      status: recordedSubmission?.status ?? null,
      archivedFile: archivedPdf ? {
        fileKey: archivedPdf.fileKey,
        url: archivedPdf.url,
        filename: archivedPdf.filename,
        fileSize: archivedPdf.fileSize
      } : null
    };
  }),
  sendApprovedSignToCimarron: protectedProcedure.input(
    z5.object({
      submissionId: z5.number().int().positive(),
      poNumber: z5.string().trim().min(1).max(64),
      pdfAttachment: pdfAttachmentSchema
    })
  ).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      return { success: false, error: "Admin access required." };
    }
    if (!ENV.cimarronEmail) {
      return {
        success: false,
        error: "Cimarron email not configured. Please set CIMARRON_EMAIL in environment variables."
      };
    }
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable." };
    const [row] = await db.select().from(submissions).where(eq4(submissions.id, input.submissionId)).limit(1);
    if (!row) return { success: false, error: "Submission not found." };
    const payload = row.payload ? (() => {
      try {
        return JSON.parse(row.payload);
      } catch {
        return {};
      }
    })() : {};
    const brokerEmail = String(row.submittedByEmail ?? payload?.senderEmail ?? "").trim();
    const reference = String(row.reference ?? payload?.propertyAddress ?? "").trim();
    const archivedPdf = {
      filename: input.pdfAttachment.filename,
      mimeType: "application/pdf",
      base64Data: input.pdfAttachment.base64Data,
      fileKey: row.pdfFileKey ?? "",
      url: row.pdfUrl ?? "",
      fileSize: Buffer.from(input.pdfAttachment.base64Data, "base64").length
    };
    const companyName = String(await getSetting("branding.company_name"));
    const supportEmail = String(await getSetting("branding.support_email"));
    const subject = `[${companyName}] Sign Request PO ${input.poNumber}${reference ? ` - ${reference}` : ""}`;
    const content = [
      "Hi Cimarron,",
      "",
      "Please see the attached sign request.",
      "",
      `PO #: ${input.poNumber}`,
      reference ? `Property: ${reference}` : "",
      "",
      "Thank you,",
      ctx.user.name || `${supportEmail} | ${companyName}`
    ].filter(Boolean).join("\n");
    const delivery = await deliverSubmissionEmail({
      to: [ENV.cimarronEmail],
      cc: brokerEmail ? [brokerEmail] : [],
      subject,
      content,
      archivedPdf
    });
    return {
      success: delivery.success,
      error: delivery.error,
      deliveryMethod: delivery.deliveryMethod,
      attachmentIncluded: delivery.attachmentIncluded
    };
  })
});

// server/routers/contracts.ts
import { z as z6 } from "zod/v4";
import { execSync as execSync2 } from "child_process";
var redlineSchema = z6.object({
  paragraph: z6.string(),
  type: z6.enum(["strikethrough", "added", "modified"]),
  note: z6.string()
});
var contractDataSchema = z6.object({
  contractType: z6.string(),
  agreementDate: z6.string().optional(),
  party1Name: z6.string().optional(),
  party1Entity: z6.string().optional(),
  party1Address: z6.string().optional(),
  party1Phone: z6.string().optional(),
  party1Fax: z6.string().optional(),
  agentName: z6.string().optional(),
  agentAddress: z6.string().optional(),
  agentPhone: z6.string().optional(),
  agentFax: z6.string().optional(),
  brokerDre: z6.string().optional(),
  agentIndividual: z6.string().optional(),
  agentTitle: z6.string().optional(),
  agentDre: z6.string().optional(),
  agentEmail: z6.string().optional(),
  propAddress: z6.string().optional(),
  propCity: z6.string().optional(),
  propState: z6.string().optional(),
  propZip: z6.string().optional(),
  propCounty: z6.string().optional(),
  propDesc: z6.string().optional(),
  mlDate: z6.string().optional(),
  mlAmendments: z6.string().optional(),
  mlLessor: z6.string().optional(),
  mlLessee: z6.string().optional(),
  termStart: z6.string().optional(),
  termEnd: z6.string().optional(),
  subleaseTerms: z6.string().optional(),
  commType: z6.string().optional(),
  commAmount: z6.string().optional(),
  arbitration: z6.string().optional(),
  additionalProvisions: z6.string().optional(),
  sig1Name: z6.string().optional(),
  sig1Title: z6.string().optional(),
  redlines: z6.array(redlineSchema).optional()
});
function parseToIsoDate(raw) {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
  }
  return "";
}
async function buildDataSheet(data) {
  const companyName = String(await getSetting("branding.company_name"));
  const supportEmail = String(await getSetting("branding.support_email"));
  const line = (label, val) => val ? `  ${label}: ${val}` : "";
  const redlineLines = (data.redlines || []).map((r, i) => `  ${i + 1}. Para ${r.paragraph} \u2014 ${r.type.toUpperCase()}: ${r.note}`).join("\n");
  return [
    "\u2550".repeat(64),
    `AIR CRE DATA SHEET \u2014 ${data.contractType.toUpperCase()}`,
    `Generated: ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`,
    "\u2550".repeat(64),
    "",
    "\u2500\u2500 BASIC PROVISIONS \u2500\u2500",
    line("Agreement Date", data.agreementDate),
    "",
    "\u2500\u2500 PARTY 1 (Sublessor / Owner / Client) \u2500\u2500",
    line("Name", data.party1Name),
    line("Entity Type", data.party1Entity),
    line("Address", data.party1Address),
    line("Phone", data.party1Phone),
    line("Fax", data.party1Fax),
    "",
    "\u2500\u2500 AGENT / BROKER \u2500\u2500",
    line("Agent Name", data.agentName),
    line("Agent Address", data.agentAddress),
    line("Agent Phone", data.agentPhone),
    line("Agent Fax", data.agentFax),
    line("Broker DRE #", data.brokerDre),
    line("Agent (Individual)", data.agentIndividual),
    line("Agent Title", data.agentTitle),
    line("Agent DRE #", data.agentDre),
    line("Agent Email", data.agentEmail),
    "",
    "\u2500\u2500 PROPERTY \u2500\u2500",
    line("Address", data.propAddress),
    line("City", data.propCity),
    line("State", data.propState),
    line("Zip", data.propZip),
    line("County", data.propCounty),
    line("Description", data.propDesc),
    ...data.mlDate || data.mlLessor ? [
      "",
      "\u2500\u2500 MASTER LEASE \u2500\u2500",
      line("Master Lease Date", data.mlDate),
      line("Amendment Dates", data.mlAmendments),
      line("Master Lessor", data.mlLessor),
      line("Master Lessee", data.mlLessee)
    ] : [],
    "",
    "\u2500\u2500 TERM OF AGREEMENT \u2500\u2500",
    line("Commencement", data.termStart),
    line("Expiration", data.termEnd),
    line("Sublease/Lease Terms", data.subleaseTerms),
    "",
    "\u2500\u2500 COMMISSION \u2500\u2500",
    line("Commission Type", data.commType),
    line("Commission Amount/Rate", data.commAmount),
    "",
    "\u2500\u2500 ARBITRATION \u2500\u2500",
    line("Arbitration Body", data.arbitration),
    "",
    "\u2500\u2500 ADDITIONAL PROVISIONS \u2500\u2500",
    line("Additional Provisions", data.additionalProvisions),
    "",
    "\u2500\u2500 SIGNATORIES \u2500\u2500",
    line("Party 1 Signatory", data.sig1Name),
    line("Party 1 Title", data.sig1Title),
    ...redlineLines ? [
      "",
      "\u2500\u2500 REDLINES / MODIFICATIONS TO APPLY IN AIR CRE \u2500\u2500",
      redlineLines
    ] : [],
    "",
    "\u2550".repeat(64),
    "Enter these values into AIR CRE Contracts at https://www.aircre.com",
    `${supportEmail} | ${companyName}`
  ].filter((l) => l !== void 0 && l !== "  : ").join("\n");
}
var contractsRouter = router({
  /**
   * Extract contract fields and redlines from an uploaded PDF using AI vision.
   */
  extractContract: publicProcedure.input(
    z6.object({
      /** Public URL of the uploaded PDF (from S3 / CDN) */
      pdfUrl: z6.string().url(),
      contractType: z6.string()
    })
  ).mutation(async ({ input }) => {
    const systemPrompt = `You are an expert real estate contract analyst. You will be given an AIR CRE contract PDF that a broker has filled out in Adobe Acrobat. Your job is to:
1. Extract every filled field value exactly as written.
2. Identify any redlined (struck-through) text and any added/modified text, noting the paragraph number and a brief description.
3. Return a JSON object matching the schema exactly.

For dates, return them in YYYY-MM-DD format if possible, otherwise return the raw text.
For commission, note whether it is a percentage, flat fee, or per schedule.
For arbitration, return "AAA", "JAMS", or "none".
If a field is blank or not applicable, omit it from the response.

Return ONLY valid JSON, no markdown, no explanation.`;
    const userPrompt = `Extract all fields and redlines from this AIR CRE contract PDF. Contract type: ${input.contractType}.

Return JSON with these fields (omit any that are blank):
{
  "contractType": "${input.contractType}",
  "agreementDate": "YYYY-MM-DD or raw text",
  "party1Name": "",
  "party1Entity": "",
  "party1Address": "",
  "party1Phone": "",
  "party1Fax": "",
  "agentName": "",
  "agentAddress": "",
  "agentPhone": "",
  "agentFax": "",
  "brokerDre": "",
  "agentIndividual": "",
  "agentTitle": "",
  "agentDre": "",
  "agentEmail": "",
  "propAddress": "",
  "propCity": "",
  "propState": "",
  "propZip": "",
  "propCounty": "",
  "propDesc": "",
  "mlDate": "YYYY-MM-DD",
  "mlAmendments": "comma-separated dates",
  "mlLessor": "",
  "mlLessee": "",
  "termStart": "YYYY-MM-DD",
  "termEnd": "YYYY-MM-DD",
  "subleaseTerms": "",
  "commType": "percent|schedule|flat",
  "commAmount": "e.g. 6% or $25,000",
  "arbitration": "AAA|JAMS|none",
  "additionalProvisions": "",
  "sig1Name": "",
  "sig1Title": "",
  "redlines": [
    { "paragraph": "4.1(b)", "type": "strikethrough", "note": "Brief description of what was struck through" }
  ]
}`;
    try {
      const pdfResp = await fetch(input.pdfUrl, { signal: AbortSignal.timeout(3e4) });
      if (!pdfResp.ok) {
        return {
          success: false,
          error: `Could not fetch PDF: ${pdfResp.status} ${pdfResp.statusText}`,
          data: null
        };
      }
      const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
      let pdfText = "";
      try {
        const mod = await import("pdf-parse");
        const parse = mod.default ?? mod;
        const pdfParsed = await parse(pdfBuffer);
        pdfText = (pdfParsed.text || "").replace(/\s+/g, " ").trim().slice(0, 4e4);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        pdfText = `[PDF text extraction failed: ${msg}. Return empty JSON if no data is available.]`;
      }
      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}

Document text (extracted from PDF):
${pdfText}`
        }
      ];
      const response = await invokeLLM({
        messages,
        response_format: { type: "json_object" }
      });
      const rawContent = response.choices?.[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent) || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { success: false, error: "AI returned invalid JSON", data: null };
      }
      parsed.contractType = input.contractType;
      const dateFields = ["agreementDate", "mlDate", "termStart", "termEnd"];
      for (const f of dateFields) {
        if (parsed[f]) parsed[f] = parseToIsoDate(String(parsed[f]));
      }
      const validated = contractDataSchema.safeParse(parsed);
      if (!validated.success) {
        return { success: false, error: "AI returned data in an unexpected format", data: null };
      }
      return { success: true, data: validated.data, error: null };
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return { success: false, error: msg, data: null };
    }
  }),
  /**
   * Submit a completed contract data sheet to the admin via Outlook MCP.
   */
  submitContractToAdmin: publicProcedure.input(
    z6.object({
      contractData: contractDataSchema,
      brokerName: z6.string().optional(),
      senderEmail: z6.string().optional(),
      notes: z6.string().optional()
    })
  ).mutation(async ({ input }) => {
    const adminEmail = ENV.adminEmail;
    if (!adminEmail) {
      return { success: false, error: "Admin email not configured." };
    }
    const { contractData, brokerName, senderEmail, notes } = input;
    const dataWithNotes = notes ? {
      ...contractData,
      additionalProvisions: [contractData.additionalProvisions, `Admin Notes: ${notes}`].filter(Boolean).join("\n")
    } : contractData;
    const dataSheet = await buildDataSheet(dataWithNotes);
    const contractLabel = contractData.contractType || "Contract";
    const addressPart = [contractData.propAddress, contractData.propCity].filter(Boolean).join(", ");
    const companyName = String(await getSetting("branding.company_name"));
    const subject = `[${companyName}] Contract Intake \u2014 ${contractLabel}${addressPart ? ` \u2014 ${addressPart}` : ""}`;
    const body = [
      `Contract submitted by: ${brokerName || "Broker"}`,
      `Submitted: ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`,
      "",
      dataSheet
    ].join("\n");
    const to = [adminEmail];
    const cc = senderEmail ? [senderEmail] : [];
    try {
      const mcpInput = JSON.stringify({
        subject,
        body,
        to_recipients: to,
        cc_recipients: cc
      });
      execSync2(
        `mcp-cli tool call outlook_send_messages --server outlook-mail --input '${mcpInput.replace(/'/g, "'\\''")}'`,
        { timeout: 3e4 }
      );
      return { success: true, error: null };
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return { success: false, error: `MCP connection failed: ${msg}` };
    }
  })
});

// server/routers/submissions.ts
init_schema();
init_db();
import { and as and2, desc as desc3, eq as eq5, or as or2, sql as sql3 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
import fs2 from "node:fs";
import path from "node:path";
import { z as z7 } from "zod/v4";
var submissionSummarySchema = z7.object({
  clientSubmissionId: z7.string().optional(),
  type: z7.string(),
  status: z7.string().optional(),
  propertyType: z7.string().optional(),
  transactionType: z7.string().optional(),
  address: z7.string().optional(),
  city: z7.string().optional(),
  state: z7.string().optional(),
  zip: z7.string().optional(),
  brokerName: z7.string().optional(),
  brokerEmail: z7.union([z7.string().email(), z7.literal("")]).optional(),
  office: z7.string().optional(),
  submittedAt: z7.string().optional(),
  updatedAt: z7.string().optional()
}).catchall(z7.unknown());
var adminStatusSchema = z7.enum(["pending", "in_review", "approved", "rejected"]);
var ACTIVE_QUEUE_STATUSES = ["pending", "in_review"];
function activeQueueStatusCondition() {
  return sql3`${submissions.status} in (${sql3.join(ACTIVE_QUEUE_STATUSES.map((status) => sql3`${status}`), sql3`, `)})`;
}
function parsePayload(payload) {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}
function numberFromCount2(value) {
  const count3 = Number(value ?? 0);
  return Number.isFinite(count3) ? count3 : 0;
}
function parseConfidentialFlag(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "yes" || value === "y" || value === "true" || value === "1";
}
function parseNumberOrNull(raw) {
  if (raw === null || raw === void 0 || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const normalized = String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
function isoDateOrEmpty(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}
var cachedZipMarketSubmarket = null;
function loadZipMarketSubmarket() {
  if (cachedZipMarketSubmarket) return cachedZipMarketSubmarket;
  const candidates = [
    path.resolve(process.cwd(), "client", "public", "zip_market_submarket.json"),
    path.resolve(process.cwd(), "dist", "public", "zip_market_submarket.json")
  ];
  for (const filePath of candidates) {
    try {
      if (!fs2.existsSync(filePath)) continue;
      const raw = fs2.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      cachedZipMarketSubmarket = parsed;
      return parsed;
    } catch {
    }
  }
  cachedZipMarketSubmarket = {};
  return cachedZipMarketSubmarket;
}
function inferMarketSubmarketFromZip(zipCode) {
  const zip = zipCode.trim();
  if (!/^\d{5}$/.test(zip)) return null;
  const map = loadZipMarketSubmarket();
  const match = map[zip];
  if (!match) return null;
  return {
    market: String(match.market ?? "").trim(),
    subMarket: String(match.submarket ?? "").trim()
  };
}
function toCompRecordFromVoucher(params) {
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
    source: `Voucher \xB7 ${submittedBy}`,
    verifiedBy: submittedBy,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    monthsOnMarket: parseNumberOrNull(input.lMktMonths ?? input.sMktMonths),
    photo: String(input.photo ?? "").trim(),
    listAgent1,
    listAgent2: String(input.listAgent2 ?? "").trim(),
    procAgent1,
    procAgent2: String(input.procAgent2 ?? "").trim(),
    verified: "",
    updatedBy: submittedBy,
    apn: String(input.apn ?? "").trim()
  };
  if (isLease) {
    const record2 = {
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
      rentUse: ""
    };
    return { compType: "lease", record: record2 };
  }
  const record = {
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
    askingPrice: null
  };
  return { compType: "sale", record };
}
var submissionsRouter = router({
  create: protectedProcedure.input(submissionSummarySchema).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        stored: false,
        error: "Database unavailable"
      };
    }
    const reference = [input.address, input.city].filter(Boolean).join(", ") || null;
    const [result] = await db.insert(submissions).values({
      formType: input.type,
      status: input.status?.trim() || "pending",
      payload: JSON.stringify(input),
      reference,
      submittedBy: input.brokerName || ctx.user.name || ctx.user.email || ctx.user.openId,
      submittedByOpenId: ctx.user.openId,
      submittedByEmail: ctx.user.email ?? (input.brokerEmail || null)
    });
    try {
      if (input.type === "voucher" && !parseConfidentialFlag(input.confidential)) {
        const submittedBy = input.brokerName || ctx.user.name || ctx.user.email || ctx.user.openId;
        const comp = toCompRecordFromVoucher({ input, submittedBy });
        if (comp) {
          await addSingleComp({
            db,
            compType: comp.compType,
            record: comp.record
          });
        }
      }
    } catch {
    }
    return {
      success: true,
      stored: true,
      submissionId: result.insertId ?? null
    };
  }),
  mine: protectedProcedure.input(z7.object({ limit: z7.number().min(1).max(100).default(25) }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 25;
    const rows = await db.select().from(submissions).where(eq5(submissions.submittedByOpenId, ctx.user.openId)).orderBy(desc3(submissions.createdAt)).limit(limit);
    return rows.map((row) => ({
      id: row.id,
      formType: row.formType,
      status: row.status,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedByEmail: row.submittedByEmail,
      pdfFileKey: row.pdfFileKey,
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payload: parsePayload(row.payload)
    }));
  }),
  queueMine: protectedProcedure.input(
    z7.object({
      limit: z7.number().min(1).max(100).default(50)
    }).optional()
  ).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { totalPending: 0, requests: [] };
    const limit = input?.limit ?? 50;
    const myQueueRows = await db.select().from(submissions).where(and2(eq5(submissions.submittedByOpenId, ctx.user.openId), activeQueueStatusCondition())).orderBy(submissions.createdAt, submissions.id).limit(limit);
    const totalActiveRows = await db.select({ count: sql3`count(*)` }).from(submissions).where(activeQueueStatusCondition());
    const totalActive = numberFromCount2(totalActiveRows[0]?.count);
    const requests = await Promise.all(
      myQueueRows.map(async (row) => {
        const aheadRows = await db.select({ count: sql3`count(*)` }).from(submissions).where(
          and2(
            activeQueueStatusCondition(),
            or2(
              sql3`${submissions.createdAt} < ${row.createdAt}`,
              and2(eq5(submissions.createdAt, row.createdAt), sql3`${submissions.id} < ${row.id}`)
            )
          )
        );
        const aheadCount = numberFromCount2(aheadRows[0]?.count);
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
          payload: parsePayload(row.payload)
        };
      })
    );
    return {
      totalPending: totalActive,
      totalActive,
      requests
    };
  }),
  byId: protectedProcedure.input(z7.object({ id: z7.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }
    const rows = await db.select().from(submissions).where(eq5(submissions.id, input.id)).limit(1);
    const row = rows[0];
    if (!row) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Submission not found" });
    }
    if (row.submittedByOpenId !== ctx.user.openId && ctx.user.role !== "admin") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Submission not available" });
    }
    return {
      id: row.id,
      formType: row.formType,
      status: row.status,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedByEmail: row.submittedByEmail,
      pdfFileKey: row.pdfFileKey,
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payload: parsePayload(row.payload)
    };
  }),
  adminList: protectedProcedure.input(z7.object({ limit: z7.number().min(1).max(500).default(200) }).optional()).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 200;
    const rows = await db.select().from(submissions).orderBy(desc3(submissions.createdAt)).limit(limit);
    return rows.map((row) => ({
      id: row.id,
      formType: row.formType,
      status: row.status,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedByEmail: row.submittedByEmail,
      pdfFileKey: row.pdfFileKey,
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payload: parsePayload(row.payload)
    }));
  }),
  updateStatus: protectedProcedure.input(
    z7.object({
      id: z7.number().int().positive(),
      status: adminStatusSchema
    })
  ).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError4({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }
    await db.update(submissions).set({
      status: input.status,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(submissions.id, input.id));
    return { success: true };
  })
});

// server/routers/brokers.ts
var brokersRouter = router({
  list: publicProcedure.query(() => {
    const isBroker = (r) => /broker/i.test(r);
    const sorted = [...brokerDirectory].sort((a, b) => {
      const ab = isBroker(a.roles);
      const bb = isBroker(b.roles);
      if (ab !== bb) return ab ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.roles,
      office: e.office,
      initials: e.name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    }));
  })
});

// server/auth/passwordPlatformAuth.ts
init_schema();
init_db();
import { compare } from "bcryptjs";
import { eq as eq7 } from "drizzle-orm";
import { z as z8 } from "zod/v4";

// server/auth/constants.ts
var LBT_SESSION_COOKIE = "lbt_session";
var LBT_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1e3;
var LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
var LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1e3;

// server/auth/loginRateLimiter.ts
var store = /* @__PURE__ */ new Map();
function prune(entry, now) {
  const cutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
  entry.failuresAt = entry.failuresAt.filter((t2) => t2 > cutoff);
}
function recordLoginFailure(ip) {
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry) {
    entry = { failuresAt: [] };
    store.set(ip, entry);
  }
  prune(entry, now);
  entry.failuresAt.push(now);
}
function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry) return false;
  prune(entry, now);
  return entry.failuresAt.length >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

// server/auth/platformSession.ts
init_schema();
init_db();
import { createHash as createHash2, randomBytes as randomBytes2, randomUUID } from "node:crypto";
import { and as and3, eq as eq6, gt, or as or3 } from "drizzle-orm";
import { parse as parseCookieHeader2 } from "cookie";
function hashSessionToken(rawToken) {
  return createHash2("sha256").update(rawToken, "utf8").digest("hex");
}
function readLbtCookie(req) {
  const raw = req.headers.cookie;
  if (!raw) return void 0;
  const parsed = parseCookieHeader2(raw);
  const v = parsed[LBT_SESSION_COOKIE];
  return typeof v === "string" && v.length > 0 ? v : void 0;
}
async function findAppUserByUsernameOrEmail(db, usernameOrEmail) {
  const key = usernameOrEmail.trim().toLowerCase();
  if (!key) return void 0;
  const rows = await db.select().from(appUsers).where(or3(eq6(appUsers.email, key), eq6(appUsers.username, key))).limit(1);
  return rows[0];
}
function toPlatformAuthUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    office: row.office ?? null
  };
}
async function resolvePlatformUserFromRequest(req) {
  const token = readLbtCookie(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashSessionToken(token);
  const now = /* @__PURE__ */ new Date();
  let rows;
  try {
    rows = await db.select({ user: appUsers }).from(appSessions).innerJoin(appUsers, eq6(appUsers.id, appSessions.userId)).where(and3(eq6(appSessions.tokenHash, tokenHash), gt(appSessions.expiresAt, now))).limit(1);
  } catch (error) {
    console.error("[auth.session] Could not resolve platform session:", error);
    return null;
  }
  const user = rows[0]?.user;
  if (!user) return null;
  if (!user.isActive) return null;
  return toPlatformAuthUser(user);
}
async function createPlatformSession(db, userId, req) {
  const rawToken = randomBytes2(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + LBT_SESSION_MAX_AGE_MS);
  const rip = getRequestIp(req);
  const ip = rip === "unknown" ? null : rip;
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : null;
  await db.insert(appSessions).values({
    id: sessionId,
    userId,
    tokenHash,
    expiresAt,
    ipAddress: ip,
    userAgent
  });
  return { rawToken, expiresAt };
}
async function destroyPlatformSessionByCookie(req) {
  const token = readLbtCookie(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashSessionToken(token);
  const rows = await db.select({ userId: appSessions.userId }).from(appSessions).where(eq6(appSessions.tokenHash, tokenHash)).limit(1);
  const userId = rows[0]?.userId ?? null;
  await db.delete(appSessions).where(eq6(appSessions.tokenHash, tokenHash));
  return userId;
}

// server/auth/passwordPlatformAuth.ts
var passwordLoginBody = z8.object({
  username_or_email: z8.string().trim().min(1).max(320),
  password: z8.string().min(1).max(512)
});
function isPlatformPasswordLoginBody(body) {
  if (!body || typeof body !== "object") return false;
  const o = body;
  return typeof o.username_or_email === "string" && o.username_or_email.trim().length > 0 && typeof o.password === "string" && o.password.length > 0;
}
async function handlePlatformPasswordLogin(req, res) {
  try {
    await handlePlatformPasswordLoginUnsafe(req, res);
  } catch (error) {
    console.error("[auth.login] Platform password login failed:", error);
    if (!res.headersSent) {
      res.status(503).json({ error: "Sign-in service is temporarily unavailable." });
    }
  }
}
async function handlePlatformPasswordLoginUnsafe(req, res) {
  const ip = getRequestIp(req);
  if (isLoginRateLimited(ip)) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database unavailable." });
    return;
  }
  const parsed = passwordLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { username_or_email, password } = parsed.data;
  const user = await findAppUserByUsernameOrEmail(db, username_or_email);
  if (!user || !user.passwordHash) {
    recordLoginFailure(ip);
    await writeAuditLog(
      null,
      "login.failed",
      null,
      null,
      { reason: "invalid_credentials", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  if (!user.isActive) {
    await writeAuditLog(
      user.id,
      "login.failed",
      "user",
      user.id,
      { reason: "deactivated", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(403).json({ error: "This account has been deactivated. Contact your admin." });
    return;
  }
  const ok2 = await compare(password, user.passwordHash);
  if (!ok2) {
    recordLoginFailure(ip);
    await writeAuditLog(
      user.id,
      "login.failed",
      "user",
      user.id,
      { reason: "invalid_credentials", attempted: username_or_email.trim().toLowerCase() },
      req
    );
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  const { rawToken } = await createPlatformSession(db, user.id, req);
  await db.update(appUsers).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq7(appUsers.id, user.id));
  await writeAuditLog(user.id, "login.success", "user", user.id, {}, req);
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LBT_SESSION_COOKIE, rawToken, { ...cookieOptions, maxAge: LBT_SESSION_MAX_AGE_MS });
  res.json({
    success: true,
    id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.fullName,
    role: user.role,
    office: user.office ?? null
  });
}
async function handlePlatformLogout(req, res) {
  const userId = await destroyPlatformSessionByCookie(req);
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(LBT_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
  await writeAuditLog(userId, "logout", null, null, {}, req);
}

// server/auth/linkPlatformSessionAfterLegacyLogin.ts
init_db();
async function linkPlatformSessionAfterLegacyLogin(req, res, email) {
  const db = await getDb();
  if (!db) return;
  const user = await findAppUserByUsernameOrEmail(db, email);
  if (!user?.isActive) return;
  const { rawToken } = await createPlatformSession(db, user.id, req);
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LBT_SESSION_COOKIE, rawToken, { ...cookieOptions, maxAge: LBT_SESSION_MAX_AGE_MS });
}

// server/routers.ts
function normalizeLeeLogin(raw) {
  const value = raw.trim().toLowerCase();
  if (!value || value.includes("@")) return localAuth.normalizeEmail(value);
  return localAuth.normalizeEmail(`${value}@lee-associates.com`);
}
var appRouter = router({
  system: systemRouter,
  aiAssist: aiAssistRouter,
  compData: compDataRouter,
  email: emailRouter,
  contracts: contractsRouter,
  submissions: submissionsRouter,
  brokers: brokersRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      const brokerEntry = user.email ? findBrokerDirectoryEntry(user.email) : null;
      return {
        ...user,
        office: brokerEntry?.office ?? null
      };
    }),
    login: publicProcedure.input(
      z9.object({
        name: z9.string().trim().min(2).max(120).optional(),
        email: z9.string().trim().min(1).max(320)
      })
    ).mutation(async ({ ctx, input }) => {
      if (!localAuth.isEnabled()) {
        return { success: false, error: "Local auth is disabled." };
      }
      const email = normalizeLeeLogin(input.email);
      if (!z9.string().email().safeParse(email).success) {
        return {
          success: false,
          error: "Enter your Lee username or email address."
        };
      }
      const enteredName = input.name?.trim() || "";
      const allowedDomain = (process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
      if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
        return {
          success: false,
          error: `Use your ${allowedDomain} email address.`
        };
      }
      const brokerEntry = findBrokerDirectoryEntry(email);
      if (!brokerEntry) {
        return {
          success: false,
          error: "Email not recognized. Use your @lee-associates.com email."
        };
      }
      const resolvedName = brokerEntry?.name || enteredName;
      const openId = localAuth.toLocalOpenId(email);
      const isAdminIdentity = ENV.localAdminEmails.includes(email) || ENV.localAdminNames.includes(resolvedName.trim().toLowerCase()) || isBrokerDirectoryAdmin(brokerEntry);
      const role = isAdminIdentity ? "admin" : "user";
      if (ENV.isProduction && !String(ENV.cookieSecret ?? "").trim()) {
        console.error("[auth.login] JWT_SECRET is not set; cannot sign session cookies.");
        return {
          success: false,
          error: "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy."
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
            lastSignedIn: /* @__PURE__ */ new Date()
          });
        } catch (dbErr) {
          console.error("[auth.login] Database write failed:", dbErr);
          return {
            success: false,
            error: "Could not complete sign-in (database error). Please try again or contact support."
          };
        }
        let sessionToken;
        try {
          sessionToken = await sdk.createSessionToken(openId, {
            name: resolvedName,
            email
          });
        } catch (sessionErr) {
          const secretSet = Boolean(String(ENV.cookieSecret ?? "").trim());
          console.error("[auth.login] Session token signing failed:", {
            secretSet,
            err: sessionErr
          });
          return {
            success: false,
            error: secretSet ? "Could not complete sign-in (session error). Please try again or contact support." : "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy."
          };
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS
        });
        try {
          await linkPlatformSessionAfterLegacyLogin(ctx.req, ctx.res, email);
        } catch (linkErr) {
          console.error("[auth.login] Platform session link failed (legacy session cookie is set):", linkErr);
        }
        return {
          success: true,
          user: {
            name: resolvedName,
            email,
            role,
            office: brokerEntry?.office ?? null
          }
        };
      } catch (err2) {
        console.error("[auth.login] Sign-in failed:", err2);
        return {
          success: false,
          error: "Could not complete sign-in (database or session error). Please try again or contact support."
        };
      }
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await handlePlatformLogout(ctx.req, ctx.res);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  files: router({
    /**
     * Upload a file to S3 and record metadata in the database.
     * The client sends the file as a base64-encoded string.
     */
    upload: publicProcedure.input(
      z9.object({
        filename: z9.string(),
        mimeType: z9.string(),
        base64Data: z9.string(),
        category: z9.string().default("other"),
        reference: z9.string().optional(),
        uploaderName: z9.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { filename, mimeType, base64Data, category, reference, uploaderName } = input;
      const buffer = Buffer.from(base64Data, "base64");
      const fileSize = buffer.length;
      const ext = filename.split(".").pop() ?? "bin";
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `broker-docs/${category}/${nanoid2(10)}-${safeName}`;
      const { url } = await storagePut(fileKey, buffer, mimeType);
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
          uploaderOpenId: ctx.user?.openId ?? null
        });
      }
      return { success: true, url, fileKey, filename };
    }),
    /**
     * Get a fresh download URL for a file by its key.
     */
    getUrl: publicProcedure.input(z9.object({ fileKey: z9.string() })).query(async ({ input }) => {
      const { url } = await storageGet(input.fileKey);
      return { url };
    }),
    /**
     * List recent uploads, optionally filtered by category or reference.
     */
    list: publicProcedure.input(
      z9.object({
        category: z9.string().optional(),
        reference: z9.string().optional(),
        limit: z9.number().default(50)
      })
    ).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(uploads).orderBy(desc4(uploads.createdAt)).limit(input.limit);
      return rows.filter((r) => {
        if (input.category && r.category !== input.category) return false;
        if (input.reference && r.reference !== input.reference) return false;
        return true;
      });
    })
  })
});

// server/_core/context.ts
init_db();
async function createContext(opts) {
  let user = null;
  const platformUser = await resolvePlatformUserFromRequest(opts.req);
  if (platformUser) {
    const openId = localAuth.toLocalOpenId(platformUser.email);
    const legacyRole = platformUser.role === "admin" ? "admin" : "user";
    await upsertUser({
      openId,
      name: platformUser.fullName,
      email: platformUser.email,
      loginMethod: "platform",
      role: legacyRole,
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    const row = await getUserByOpenId(openId);
    if (row) {
      user = {
        ...row,
        name: platformUser.fullName,
        email: platformUser.email ?? row.email,
        role: legacyRole,
        lastSignedIn: /* @__PURE__ */ new Date()
      };
    }
  }
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs3 from "fs";
import { nanoid as nanoid3 } from "nanoid";
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var CLIENT_INDEX_TEMPLATE = fileURLToPath(new URL("../../client/index.html", import.meta.url));
var BROKER_TOOL_TEMPLATE = fileURLToPath(new URL("../../client/public/broker_tool.html", import.meta.url));
var DEV_DIST_PUBLIC_ROOT = fileURLToPath(new URL("../../dist/public/", import.meta.url));
var PROD_PUBLIC_ROOT = path2.resolve(process.cwd(), "dist/public");
var HTML_ENTRY_TEMPLATES = {
  "/": CLIENT_INDEX_TEMPLATE,
  "/tool": BROKER_TOOL_TEMPLATE,
  "/broker_tool.html": BROKER_TOOL_TEMPLATE
};
var resolveHtmlTemplate = (requestUrl) => {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  return HTML_ENTRY_TEMPLATES[pathname] ?? CLIENT_INDEX_TEMPLATE;
};
async function setupVite(app, server) {
  const { createServer: createViteServer } = await import("vite");
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    configFile: path2.resolve(__dirname, "../..", "vite.config.ts"),
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = await fs3.promises.readFile(
        resolveHtmlTemplate(url),
        "utf-8"
      );
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid3()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? DEV_DIST_PUBLIC_ROOT : PROD_PUBLIC_ROOT;
  if (!fs3.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the public assets first`
    );
  }
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });
  app.get("/tool", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("broker_tool.html", { root: distPath });
  });
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("broker_tool.html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      }
    })
  );
  app.get(["/", "/portal", "/portal/*", "/login", "/404"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("index.html", { root: distPath });
  });
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("broker_tool.html", { root: distPath });
  });
}

// server/restApi.ts
init_db();
init_schema();
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { desc as desc5, eq as eq9 } from "drizzle-orm";
import { nanoid as nanoid4 } from "nanoid";

// server/services/dealiusAuth.ts
async function getConfiguredDealiusCredentials() {
  let settingsEmail = "";
  let settingsPassword = "";
  try {
    settingsEmail = String(await getSetting("integrations.dealius.username") ?? "").trim();
    settingsPassword = String(await getSetting("integrations.dealius.password") ?? "").trim();
  } catch {
  }
  const email = settingsEmail || ENV.dealiusEmail.trim();
  const password = settingsPassword || ENV.dealiusPassword.trim();
  if (!email || !password) return void 0;
  return { email, password };
}
async function authenticateConfiguredDealius(client) {
  const credentials = await getConfiguredDealiusCredentials();
  return client.authenticate(credentials);
}

// server/restApi.ts
var restApiRouter = Router();
function ok(res, data) {
  res.json({ success: true, data });
}
function err(res, status, message) {
  res.status(status).json({ success: false, error: message });
}
function getConnectorApiKey() {
  return process.env.CONNECTOR_API_KEY ?? "";
}
function hasValidApiKey(req) {
  const configuredApiKey = getConnectorApiKey();
  if (!configuredApiKey) return false;
  const providedApiKey = req.header("x-api-key");
  if (!providedApiKey) return false;
  const expected = Buffer.from(configuredApiKey, "utf8");
  const provided = Buffer.from(providedApiKey, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
restApiRouter.use((req, res, next) => {
  if (!getConnectorApiKey()) {
    err(res, 503, "Connector API key is not configured");
    return;
  }
  if (!hasValidApiKey(req)) {
    err(res, 401, "Invalid or missing API key");
    return;
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      err(res, 415, "Content-Type must be application/json");
      return;
    }
  }
  next();
});
restApiRouter.post("/submit/listing", async (req, res) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");
    if (!body.propertyType) return err(res, 400, "propertyType is required");
    if (!body.transactionType) return err(res, 400, "transactionType is required");
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const [result] = await db.insert(submissions).values({
      formType: "listing",
      payload: JSON.stringify(body),
      submittedBy: body.agentName ?? null,
      reference: body.propertyAddress ?? null
    });
    ok(res, {
      submissionId: result.insertId,
      formType: "listing",
      propertyAddress: body.propertyAddress,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.post("/submit/voucher", async (req, res) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");
    if (!body.representationType) return err(res, 400, "representationType is required");
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const [result] = await db.insert(submissions).values({
      formType: "voucher",
      payload: JSON.stringify(body),
      submittedBy: body.listingAgentName ?? null,
      reference: body.propertyAddress ?? null
    });
    ok(res, {
      submissionId: result.insertId,
      formType: "voucher",
      propertyAddress: body.propertyAddress,
      totalCommission: body.totalCommission ?? null,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.post("/submit/sign-request", async (req, res) => {
  try {
    const body = req.body;
    if (!body.propertyAddress) return err(res, 400, "propertyAddress is required");
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const poNumber = body.poNumber ?? `PO-${(/* @__PURE__ */ new Date()).toISOString().slice(2, 10).replace(/-/g, "")}-${nanoid4(3).toUpperCase()}`;
    const [result] = await db.insert(submissions).values({
      formType: "sign-request",
      payload: JSON.stringify({ ...body, poNumber }),
      submittedBy: body.requestedBy ?? null,
      reference: body.propertyAddress ?? null
    });
    ok(res, {
      submissionId: result.insertId,
      formType: "sign-request",
      poNumber,
      propertyAddress: body.propertyAddress,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.post("/submit/comp", async (req, res) => {
  try {
    const body = req.body;
    if (!body.address) return err(res, 400, "address is required");
    if (!body.compType) return err(res, 400, "compType is required");
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const [result] = await db.insert(submissions).values({
      formType: "comp",
      payload: JSON.stringify(body),
      submittedBy: body.lanbSource ?? null,
      reference: body.address ?? null
    });
    ok(res, {
      submissionId: result.insertId,
      formType: "comp",
      compType: body.compType,
      address: body.address,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.get("/submissions", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const formType = req.query.formType;
    let rows = await db.select().from(submissions).orderBy(desc5(submissions.createdAt)).limit(limit);
    if (formType) {
      rows = rows.filter((r) => r.formType === formType);
    }
    ok(res, rows.map((r) => ({
      submissionId: r.id,
      formType: r.formType,
      reference: r.reference,
      submittedBy: r.submittedBy,
      submittedAt: r.createdAt
    })));
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.get("/submissions/:id", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const id = parseInt(req.params.id);
    if (isNaN(id)) return err(res, 400, "Invalid submission ID");
    const rows = await db.select().from(submissions).where(eq9(submissions.id, id)).limit(1);
    if (!rows.length) return err(res, 404, "Submission not found");
    const row = rows[0];
    ok(res, {
      submissionId: row.id,
      formType: row.formType,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedAt: row.createdAt,
      payload: JSON.parse(row.payload ?? "{}")
    });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.get("/files", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const category = req.query.category;
    const reference = req.query.reference;
    let rows = await db.select().from(uploads).orderBy(desc5(uploads.createdAt)).limit(limit);
    if (category) rows = rows.filter((r) => r.category === category);
    if (reference) rows = rows.filter((r) => r.reference === reference);
    ok(res, rows.map((r) => ({
      fileKey: r.fileKey,
      filename: r.filename,
      url: r.url,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      category: r.category,
      reference: r.reference,
      uploaderName: r.uploaderName,
      uploadedAt: r.createdAt
    })));
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.get("/files/url", async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) return err(res, 400, "key query parameter is required");
    const { url } = await storageGet(key);
    ok(res, { fileKey: key, url });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.post("/inbox/email", async (req, res) => {
  try {
    const body = req.body ?? {};
    const messageId = String(body.messageId ?? "").trim();
    if (!messageId) return err(res, 400, "messageId is required");
    const subject = String(body.subject ?? "").trim();
    const from = String(body.from ?? "").trim();
    const receivedAt = String(body.receivedAt ?? "").trim();
    const reference = String(body.reference ?? "").trim() || subject || null;
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const category = body.category != null ? String(body.category).trim() : "";
    const confidential = Boolean(body.confidential);
    const requestedSystemImpact = body.systemImpact ?? null;
    const systemImpact = category.toLowerCase() === "voucher" ? ["Dealius", ...confidential ? [] : ["Metropolis"]] : Array.isArray(requestedSystemImpact) ? requestedSystemImpact : null;
    const [result] = await db.insert(brokerAdminRequests).values({
      title: subject || "(no subject)",
      receivedAt: receivedAt ? new Date(receivedAt) : null,
      fromEmail: from || null,
      category: category || null,
      confidential: confidential ? 1 : 0,
      systemImpact: systemImpact ? JSON.stringify(systemImpact) : null,
      owner: body.owner ?? null,
      status: "new",
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
      priority: body.priority ?? null,
      emailMessageId: messageId,
      internetMessageId: body.internetMessageId ?? null,
      outlookWebLink: body.outlookWebLink ?? null,
      threadKey: body.threadKey ?? null,
      dealiusDealId: body.dealiusDealId ?? null,
      dealiusListingId: body.dealiusListingId ?? null,
      docusignEnvelopeId: body.docusignEnvelopeId ?? null,
      matchStatus: "matched",
      reference,
      bodyPreview: body.bodyPreview ?? null
    });
    const requestId = result.insertId;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const saved = [];
    for (const a of attachments) {
      const filename = String(a?.filename ?? "").trim();
      const mimeType = String(a?.mimeType ?? "application/octet-stream").trim() || "application/octet-stream";
      const base64Data = String(a?.base64Data ?? "").trim();
      if (!filename || !base64Data) continue;
      const buffer = Buffer.from(base64Data, "base64");
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `broker-admin/${requestId}/${nanoid4(10)}-${safeName}`;
      const { url } = await storagePut(fileKey, buffer, mimeType);
      await db.insert(uploads).values({
        fileKey,
        url,
        filename,
        mimeType,
        fileSize: buffer.length,
        category: "inbox",
        reference: `brokerAdminRequest:${requestId}`,
        uploaderName: from || null,
        uploaderOpenId: null
      });
      saved.push({ filename, fileKey, url });
    }
    try {
      const summary = saved.map((s) => s.filename).join("\n");
      await db.update(brokerAdminRequests).set({ attachmentsSummary: summary || null, updatedAt: /* @__PURE__ */ new Date() }).where(eq9(brokerAdminRequests.id, requestId));
    } catch {
    }
    ok(res, { requestId, savedAttachments: saved });
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});
restApiRouter.post("/docusign/completed", async (req, res) => {
  try {
    const body = req.body ?? {};
    const filename = String(body.filename ?? "").trim();
    const base64Pdf = String(body.base64Pdf ?? "").trim();
    if (!filename) return err(res, 400, "filename is required");
    if (!base64Pdf) return err(res, 400, "base64Pdf is required");
    const db = await getDb();
    if (!db) return err(res, 503, "Database unavailable");
    const requestId = Number(body.requestId ?? body.submissionId ?? 0) || null;
    const envelopeId = String(body.docusignEnvelopeId ?? "").trim() || null;
    const buffer = Buffer.from(base64Pdf, "base64");
    const mimeType = String(body.mimeType ?? "application/pdf").trim() || "application/pdf";
    const key = `broker-docusign/executed/${nanoid4(10)}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { url } = await storagePut(key, buffer, mimeType);
    await db.insert(uploads).values({
      fileKey: key,
      url,
      filename,
      mimeType,
      fileSize: buffer.length,
      category: "docusign-executed",
      reference: requestId ? `brokerAdminRequest:${requestId}` : envelopeId ? `envelope:${envelopeId}` : null,
      uploaderName: "DocuSign",
      uploaderOpenId: null
    });
    const dealiusDealId = body.dealiusDealId != null ? String(body.dealiusDealId).trim() : "";
    const dealiusListingId = body.dealiusListingId != null ? String(body.dealiusListingId).trim() : "";
    const client = new DealiusClient();
    const token = await authenticateConfiguredDealius(client);
    const documentType = body.documentType != null ? String(body.documentType).trim() : null;
    const results = { stored: { fileKey: key, url }, attached: {} };
    if (dealiusDealId) {
      const r = await client.uploadDocument({
        token,
        entityType: "deal",
        entityId: dealiusDealId,
        filename,
        mimeType,
        buffer,
        documentType
      });
      results.attached.deal = r;
      if (r.status < 200 || r.status >= 300) {
      }
    }
    if (dealiusListingId) {
      const r = await client.uploadDocument({
        token,
        entityType: "listing",
        entityId: dealiusListingId,
        filename,
        mimeType,
        buffer,
        documentType
      });
      results.attached.listing = r;
    }
    ok(res, results);
  } catch (e) {
    err(res, 500, e.message ?? "Internal server error");
  }
});

// server/authApi.ts
import { Router as Router2 } from "express";
import { z as z10 } from "zod/v4";
init_db();
var loginSchema = z10.object({
  email: z10.string().trim().min(1).max(320),
  name: z10.string().trim().min(2).max(120).optional()
});
function normalizeLeeLogin2(raw) {
  const value = raw.trim().toLowerCase();
  if (!value || value.includes("@")) return localAuth.normalizeEmail(value);
  return localAuth.normalizeEmail(`${value}@lee-associates.com`);
}
var authApiRouter = Router2();
authApiRouter.post("/login", async (req, res) => {
  if (isPlatformPasswordLoginBody(req.body)) {
    await handlePlatformPasswordLogin(req, res);
    return;
  }
  if (!localAuth.isEnabled()) {
    res.status(400).json({ success: false, error: "Local auth is disabled." });
    return;
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const email = normalizeLeeLogin2(parsed.data.email);
  if (!z10.string().email().safeParse(email).success) {
    res.status(400).json({ success: false, error: "Enter your Lee username or email address." });
    return;
  }
  const allowedDomain = (process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    res.status(400).json({ success: false, error: `Use your ${allowedDomain} email address.` });
    return;
  }
  let brokerEntry = findBrokerDirectoryEntry(email);
  let name = parsed.data.name?.trim() || email;
  let role = "user";
  let isFromDb = false;
  let db = null;
  try {
    db = await getDb();
    if (db) {
      const appUser = await findAppUserByUsernameOrEmail(db, email);
      if (appUser && appUser.isActive) {
        isFromDb = true;
        name = appUser.fullName || name;
        role = appUser.role === "admin" ? "admin" : "user";
      }
    }
  } catch (err2) {
    console.error("[auth.login] Database query failed (fallback to hardcoded directory):", err2);
  }
  if (!brokerEntry && !isFromDb) {
    res.status(400).json({ success: false, error: "Email not recognized. Use your @lee-associates.com email." });
    return;
  }
  const openId = localAuth.toLocalOpenId(email);
  if (!isFromDb) {
    name = brokerEntry?.name || name;
    const isAdminIdentity = ENV.localAdminEmails.includes(email) || ENV.localAdminNames.includes(name.trim().toLowerCase()) || brokerEntry && isBrokerDirectoryAdmin(brokerEntry);
    role = isAdminIdentity ? "admin" : "user";
  }
  let sessionToken;
  try {
    try {
      await upsertUser({
        openId,
        email,
        name,
        loginMethod: "local",
        role,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
    } catch (dbErr) {
      console.error("[auth.login] Database write failed:", dbErr);
      res.status(500).json({ success: false, error: "Could not complete sign-in (database error). Please try again or contact support." });
      return;
    }
    try {
      sessionToken = await sdk.createSessionToken(openId, { name, email });
    } catch (sessionErr) {
      const secretSet = Boolean(String(ENV.cookieSecret ?? "").trim());
      console.error("[auth.login] Session token signing failed:", { secretSet, err: sessionErr });
      res.status(500).json({
        success: false,
        error: secretSet ? "Could not complete sign-in (session error). Please try again or contact support." : "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy."
      });
      return;
    }
  } catch (err2) {
    console.error("[auth.login] Sign-in failed:", err2);
    res.status(500).json({ success: false, error: "Could not complete sign-in. Please try again or contact support." });
    return;
  }
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  try {
    await linkPlatformSessionAfterLegacyLogin(req, res, email);
  } catch (linkErr) {
    console.error("[auth.login] Platform session link failed (legacy session cookie is set):", linkErr);
  }
  res.json({
    success: true,
    data: {
      user: {
        openId,
        name,
        email,
        role: role === "admin" ? "ADMIN" : "AGENT",
        office: brokerEntry?.office
      }
    }
  });
});
authApiRouter.post("/logout", async (req, res) => {
  await handlePlatformLogout(req, res);
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});
authApiRouter.get("/me", async (req, res) => {
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    res.json({
      id: platformUser.id,
      email: platformUser.email,
      username: platformUser.username,
      full_name: platformUser.fullName,
      role: platformUser.role,
      office: platformUser.office
    });
    return;
  }
  try {
    const user = await sdk.authenticateRequest(req);
    res.json({
      success: true,
      data: {
        user: {
          openId: user.openId,
          name: user.name,
          email: user.email,
          role: user.role === "admin" ? "ADMIN" : "AGENT"
        }
      }
    });
  } catch {
    res.status(401).json({ success: false, error: "Not authenticated" });
  }
});

// server/submissionsApi.ts
init_db();
init_schema();
import { Router as Router3 } from "express";
import { z as z11 } from "zod/v4";
import { nanoid as nanoid5 } from "nanoid";
import { eq as eq10, sql as sql4 } from "drizzle-orm";

// server/auth/resolvePortalRequestUser.ts
async function resolvePortalRequestUser(req) {
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    return {
      openId: localAuth.toLocalOpenId(platformUser.email),
      role: platformUser.role === "admin" ? "admin" : "user",
      email: platformUser.email,
      name: platformUser.fullName,
      platformUserId: platformUser.id,
      platformRole: platformUser.role
    };
  }
  try {
    const legacyUser = await sdk.authenticateRequest(req);
    return {
      openId: legacyUser.openId,
      role: legacyUser.role === "admin" ? "admin" : "user",
      email: legacyUser.email ?? null,
      name: legacyUser.name ?? null
    };
  } catch {
    return null;
  }
}

// server/services/dealiusEntry.ts
function str2(raw) {
  return String(raw ?? "").trim();
}
function num2(raw) {
  if (raw === null || raw === void 0 || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
function positiveInt(raw) {
  const n = num2(raw);
  if (n == null || n <= 0) return null;
  return Math.round(n);
}
function parseAddressParts2(raw) {
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (!match) return {};
  const [, address, city, state, zip] = match;
  return {
    address: address.trim(),
    city: city.trim(),
    state: state.toLowerCase() === "california" ? "CA" : state.toUpperCase(),
    zip: zip ? zip.replace(/\D/g, "").slice(0, 5) : void 0
  };
}
function feePercentFrom(raw) {
  const n = num2(raw);
  if (n == null || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}
function firstFeePercent(p) {
  const candidates = [
    p.feePercent,
    p.feePct,
    p.clientRepFee,
    p.oppositeSideRepFee,
    p.commissionRate,
    p.commissionPct,
    p.commRate,
    p.commPct,
    p.saleCommPct,
    p.dx_saleCommPct,
    p.voucherCommissionPct,
    p.voucherCommissionRate,
    p.lCommRate,
    p.sCommPct
  ];
  for (const c of candidates) {
    const pct = feePercentFrom(c);
    if (pct != null) return pct;
  }
  return null;
}
function asRentRows(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const months = Math.max(0, Math.round(num2(r?.months) ?? 0));
    const monthly = num2(r?.monthly);
    return {
      months,
      monthly,
      free: Boolean(r?.free) || (monthly ?? 0) === 0
    };
  }).filter((r) => r.months > 0);
}
function asBrokers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => {
    const pct = num2(b?.pct ?? b?.percent ?? b?.commissionPct);
    return {
      name: str2(b?.name || b?.brokerName || b?.fullName),
      pct,
      lead: Boolean(b?.lead),
      side: str2(b?.side)
    };
  }).filter((b) => b.name);
}
function asListingSpaces(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((space) => ({
    suite: str2(space?.suite || space?.name),
    sqft: positiveInt(space?.sqft) ?? 0,
    askingRate: num2(space?.askingRate),
    availableDate: space?.availableDate,
    comments: str2(space?.comments)
  })).filter((space) => space.suite || space.sqft > 0 || space.askingRate != null || space.comments);
}
function boolish(raw) {
  if (typeof raw === "boolean") return raw;
  const value = str2(raw).toLowerCase();
  return value === "true" || value === "yes" || value === "y" || value === "1";
}
function uniqNames(names) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const n of names) {
    const value = str2(n);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
function normalizePropertyType(raw) {
  const value = str2(raw);
  const v = value.toLowerCase();
  if (v.includes("industrial")) return "Industrial";
  if (v.includes("office")) return "Office";
  if (v.includes("retail")) return "Retail";
  if (v.includes("land")) return "Land";
  if (v.includes("multi")) return "Multi-Family";
  if (v.includes("medical")) return "Medical";
  return value || "Industrial";
}
function propertyTypeIdFrom(raw) {
  const v = normalizePropertyType(raw).toLowerCase();
  const map = {
    retail: 1,
    office: 2,
    industrial: 3,
    "multi-family": 4,
    multifamily: 4,
    land: 5,
    medical: 8
  };
  return map[v] ?? 3;
}
function repTypeIdFrom(raw) {
  const v = str2(raw).toLowerCase();
  if (!v) return 4;
  if (v.includes("tenant")) return 3;
  if (v.includes("landlord")) return 4;
  if (v.includes("buyer")) return 1;
  if (v.includes("seller")) return 2;
  if (v.includes("referr") || v.includes("other")) return 5;
  return positiveInt(raw) ?? 4;
}
function isSaleLike(p) {
  const value = str2(p.transactionType ?? p.txnType ?? p.listingTransaction ?? "").toLowerCase();
  return value.includes("sale") || value.includes("sold");
}
function isLeaseLike(p) {
  if (isSaleLike(p)) return false;
  const value = str2(p.transactionType ?? p.txnType ?? "").toLowerCase();
  const rep = str2(p.representationType ?? "").toLowerCase();
  return !value || value.includes("lease") || value.includes("leasing") || value.includes("renew") || rep.includes("tenant") || rep.includes("landlord");
}
function idFrom(data, keys) {
  const asInt = positiveInt(data);
  if (asInt != null) return asInt;
  if (data && typeof data === "object") {
    const target = "Data" in data ? data.Data : data;
    const targetInt = positiveInt(target);
    if (targetInt != null) return targetInt;
    if (target && typeof target === "object") {
      for (const key of keys) {
        const value = target[key];
        const id = positiveInt(value);
        if (id != null) return id;
      }
    }
  }
  return null;
}
function listFrom(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.Data)) return data.Data;
  return [];
}
function omitEmpty(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== void 0 && value !== null && value !== "")
  );
}
function isoDate(raw) {
  const value = str2(raw);
  if (!value) return void 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return (/* @__PURE__ */ new Date(`${value}T00:00:00`)).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return void 0;
  return parsed.toISOString();
}
function todayIsoDate() {
  const today = /* @__PURE__ */ new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function addressPartsFromEntry(entry) {
  const rawAddress = str2(entry.address || entry.propertyAddress || entry.property || "");
  const parts = parseAddressParts2(rawAddress);
  const hasStructuredPlace = Boolean(str2(entry.city) || str2(entry.zip || entry.zipCode));
  const address = hasStructuredPlace ? rawAddress : parts.address || rawAddress;
  return {
    address,
    city: str2(entry.city || parts.city),
    zip: str2(entry.zip || entry.zipCode || parts.zip)
  };
}
function suiteLabel(raw) {
  const value = str2(raw).replace(/\s+/g, " ");
  if (!value) return "";
  if (/^(suite|ste\.?|unit|#)\b/i.test(value)) return value.replace(/^ste\.?\b/i, "Ste");
  return `Ste ${value}`;
}
function propertyNameFromAddressSuite(address, suite) {
  const cleanAddress = str2(address);
  const cleanSuite = suiteLabel(suite);
  if (!cleanAddress) return cleanSuite;
  if (!cleanSuite) return cleanAddress;
  const normalizedAddress = cleanAddress.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const normalizedSuite = cleanSuite.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const suiteNumber = normalizedSuite.replace(/^(suite|ste|unit|#)\s*/, "").trim();
  if (normalizedAddress.includes(normalizedSuite) || suiteNumber && new RegExp(`(^|\\s|#)${suiteNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedAddress)) {
    return cleanAddress;
  }
  return `${cleanAddress}, ${cleanSuite}`;
}
function dealNamePrefixFromTransaction(entry, isSale) {
  const value = str2(entry.transactionType ?? entry.txnType ?? entry.dealType ?? entry.dealName ?? "").toLowerCase();
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewed";
  if (value.includes("sold") || value.includes("sale") || value.includes("purchase")) return "Sold";
  if (value.includes("lease") || value.includes("leased")) return "Leased";
  return isSale ? "Sold" : "Leased";
}
function normalizeDealEntry(entry) {
  const { address, city, zip } = addressPartsFromEntry(entry);
  const isSale = isSaleLike(entry);
  const isLease = !isSale && isLeaseLike(entry);
  const propertyType = normalizePropertyType(entry.propertyType || entry.propType || entry.subType || entry.occType);
  const sqft = positiveInt(entry.sqft || entry.dealSF || entry.lDealSF || entry.leasedSqFt || entry.squareFeet || entry.sizeSF) ?? 1;
  const totalBldgSF = positiveInt(entry.totalBldgSF || entry.bldgSF || entry.buildingSF || entry.buildingSizeSf);
  const suite = str2(entry.suite || entry.unit);
  const propertyName = propertyNameFromAddressSuite(address, suite);
  const clientCo = str2(entry.clientCo || entry.lessorName || entry.sellerName || entry.lsCompany);
  const clientContactName = str2(entry.clientContactName || entry.clientContact || entry.lsContact);
  const brokersRaw = asBrokers(entry.brokers || entry.internalBrokers || entry.commissionBrokers);
  const fallbackBrokers = uniqNames([
    entry.listingAgentName,
    entry.procuringAgentName,
    entry.laName,
    entry.paName,
    entry.brokerName,
    entry.agentName,
    entry.submittedBy
  ]).map((name, index2) => ({ name, pct: null, lead: index2 === 0 }));
  const brokerSides = brokersRaw.map((b) => str2(b.side).toLowerCase());
  const representedBothSides = boolish(entry.representedBothSides || entry.bothSides || entry.brokerRepresentedBothSides) || brokerSides.some((side) => side.includes("listing")) && brokerSides.some((side) => side.includes("procur"));
  const repTypeID = isLease && representedBothSides ? 4 : positiveInt(entry.repTypeID || entry.repType) ?? repTypeIdFrom(entry.representationType);
  let dealName = `${dealNamePrefixFromTransaction(entry, isSale)}: ${propertyName || "New Deal"}`;
  if (repTypeID === 5) {
    dealName = `Referred: ${propertyName || "New Deal"} ${clientCo} ${clientContactName}`.replace(/\s+/g, " ").trim();
  }
  return {
    dealName,
    repTypeID,
    representedBothSides,
    isLease,
    isSale,
    address,
    city,
    zip,
    suite,
    propertyName,
    propertyType,
    propertyTypeID: propertyTypeIdFrom(propertyType),
    sqft,
    totalBldgSF: totalBldgSF ?? sqft,
    yearBuilt: positiveInt(entry.yearBuilt),
    clearHeight: num2(entry.clearHeight || entry.clearance),
    dhDoors: positiveInt(entry.dhDoors || entry.dh),
    glDoors: positiveInt(entry.glDoors || entry.gl),
    numParkingSpaces: positiveInt(entry.numParkingSpaces || entry.parkingSpaces),
    indSF: positiveInt(entry.indSF),
    officeSF: positiveInt(entry.officeSF),
    landSF: positiveInt(entry.landSF),
    bldgClass: str2(entry.bldgClass),
    numFloors: positiveInt(entry.numFloors || entry.floors),
    parkRatio: str2(entry.parkRatio),
    rail: str2(entry.rail),
    clientCo: str2(entry.clientCo || entry.lessorName || entry.sellerName || entry.lsCompany),
    oppositeCo: str2(entry.oppositeCo || entry.lesseeName || entry.buyerName || entry.lbCompany),
    clientContactName: str2(entry.clientContactName || entry.clientContact || entry.lsContact),
    clientContactEmail: str2(entry.clientContactEmail || entry.clientEmail || entry.lsEmail),
    clientContactPhone: str2(entry.clientContactPhone || entry.clientPhone || entry.lsPhone),
    oppositeContactName: str2(entry.oppositeContactName || entry.oppositeContact || entry.lbContact),
    oppositeContactEmail: str2(entry.oppositeContactEmail || entry.oppositeEmail || entry.lbEmail),
    oppositeContactPhone: str2(entry.oppositeContactPhone || entry.oppositePhone || entry.lbPhone),
    startDate: entry.startDate || entry.lStart || entry.leaseStart,
    endDate: entry.endDate || entry.lEnd || entry.leaseEnd,
    occupancyDate: entry.occupancyDate || entry.lOcc,
    term: positiveInt(entry.term || entry.lTerm || entry.leaseTerm),
    askingRate: num2(entry.askingRate || entry.lAskingRate || entry.lRate),
    totalNNN: num2(entry.totalNNN || entry.lNnnTotal),
    propTaxes: num2(entry.propTaxes),
    insurance: num2(entry.insurance),
    opex: num2(entry.opex),
    cams: num2(entry.cams),
    tiPerSF: num2(entry.tiPerSF || entry.lTiSF),
    escalation: num2(entry.escalation || entry.lEscalations),
    totalConsideration: num2(entry.totalConsideration || entry.sPrice || entry.lConsideration || entry.salePrice),
    feePercent: firstFeePercent(entry),
    paymentDate: entry.paymentDate,
    paymentAmount: num2(entry.paymentAmount),
    rentRows: asRentRows(entry.rentRows || entry.rentSchedule),
    brokers: brokersRaw.length ? brokersRaw : fallbackBrokers
  };
}
function normalizeListingEntry(entry) {
  const { address, city, zip } = addressPartsFromEntry(entry);
  const transaction = str2(entry.listingTransaction || entry.transactionType || entry.txnType || "lease").toLowerCase();
  const isSale = transaction.includes("sale") && !transaction.includes("lease");
  const propertyType = normalizePropertyType(entry.propertyType || entry.propType || entry.subType);
  const rawSpaces = asListingSpaces(entry.spaces || entry.listingSpaces);
  const spacesSqft = rawSpaces.reduce((sum, space) => sum + Math.max(0, space.sqft), 0);
  const sqft = positiveInt(entry.sqft || entry.suiteSF || entry.dealSF || entry.sizeSF || entry.spaceSF || entry.leasedSqFt) ?? spacesSqft;
  const totalBldgSF = positiveInt(entry.totalBldgSF || entry.bldgSF || entry.buildingSF || entry.sizeSF);
  const suitesRaw = str2(entry.suites || entry.suite || entry.unit);
  const suites = suitesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const spaces = rawSpaces.length ? rawSpaces.map((space) => ({ ...space, sqft: space.sqft || sqft || totalBldgSF || 0 })) : suites.length ? suites.map((suite) => ({ suite, sqft: sqft || totalBldgSF || 0, askingRate: null, availableDate: void 0, comments: "" })) : [{ suite: "", sqft: sqft || totalBldgSF || 0, askingRate: null, availableDate: void 0, comments: "" }];
  const propertyName = propertyNameFromAddressSuite(address, suites.length === 1 ? suites[0] : "");
  const brokers = asBrokers(entry.brokers || entry.agents || entry.listingAgents);
  return {
    listingName: str2(entry.listingName || entry.dealName) || propertyName || address || "New Listing",
    transactionType: isSale ? "Sale" : transaction.includes("sublease") ? "Sublease" : transaction.includes("sale or lease") ? "Sale or Lease" : "Lease",
    address,
    city,
    zip,
    suites,
    propertyName,
    propertyType,
    propertyTypeID: propertyTypeIdFrom(propertyType),
    sqft,
    totalBldgSF: totalBldgSF ?? sqft,
    spaces,
    yearBuilt: positiveInt(entry.yearBuilt),
    ownerCompany: str2(entry.ownerCompany || entry.owner || entry.clientCo || entry.lessorName || entry.sellerName),
    askingRate: num2(entry.askingRate || entry.leaseRate || entry.rate),
    commission: feePercentFrom(entry.commission || entry.commissionPercent || entry.saleCommPct || entry.feePercent),
    listingStartDate: entry.listingStartDate || entry.listingStart,
    listingExpiryDate: entry.listingExpiryDate || entry.listingExpiration || entry.listingExpiry,
    listingAvailableDate: entry.listingAvailableDate || entry.availableDate,
    listingStatus: str2(entry.listingStatus || "active"),
    listingSource: str2(entry.listingSource || "Admin portal"),
    listingNotes: str2(entry.listingNotes || entry.notes),
    brokers
  };
}
function buildDealEntryFromSubmissionPayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const nested = p.voucherData && typeof p.voucherData === "object" ? p.voucherData : {};
  return { ...p, ...nested };
}
function validateDealEntryForDealiusPush(entry) {
  const d = normalizeDealEntry(entry);
  const errors = [];
  if (!d.address) errors.push("Missing property address.");
  if (!d.city) errors.push("Missing city.");
  if (!d.zip) errors.push("Missing zip.");
  if (!d.dealName) errors.push("Missing deal name.");
  if (d.repTypeID !== 5) {
    if (d.feePercent == null || d.feePercent <= 0) errors.push("Missing fee percent.");
    if (d.isLease && d.rentRows.length === 0) errors.push("Lease-like deal requires at least one rent schedule row.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
function validateListingEntryForDealiusPush(entry) {
  const l = normalizeListingEntry(entry);
  const errors = [];
  if (!l.address) errors.push("Missing property address.");
  if (!l.city) errors.push("Missing city.");
  if (!l.zip) errors.push("Missing zip.");
  if ((!l.sqft || l.sqft <= 0) && !l.spaces.some((space) => space.sqft > 0)) errors.push("Missing space square footage.");
  if (!l.listingName) errors.push("Missing listing name.");
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
async function resolveCompanyId(params) {
  const cleanName = params.name.trim();
  if (cleanName.length < 2) return null;
  const needle = cleanName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  try {
    const search = await params.client.request({
      token: params.token,
      method: "GET",
      path: `/companies?PageSize=50&SearchTerm=${encodeURIComponent(cleanName)}`
    });
    const valid = listFrom(search.data).filter((c) => positiveInt(c.CompanyID) != null);
    const exact = valid.find((c) => str2(c.Name).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim() === needle);
    if (exact) return positiveInt(exact.CompanyID);
    const fuzzy = valid.find((c) => {
      const name = str2(c.Name).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      return needle.length >= 5 && (name.startsWith(needle.slice(0, 8)) || needle.startsWith(name.slice(0, 8)));
    });
    if (fuzzy) return positiveInt(fuzzy.CompanyID);
  } catch (error) {
    params.log.warnings.push(`Company search failed for ${cleanName}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const created = await params.client.request({
    token: params.token,
    method: "POST",
    path: "/companies",
    data: { Name: cleanName, Types: 1 }
  });
  const createdId = idFrom(created.data, ["CompanyID", "ID", "id"]);
  if (created.status >= 200 && created.status < 300 && createdId) return createdId;
  if (created.status === 409) {
    const retry = await params.client.request({
      token: params.token,
      method: "GET",
      path: `/companies?PageSize=50&SearchTerm=${encodeURIComponent(cleanName)}`
    });
    const first2 = listFrom(retry.data).find((c) => positiveInt(c.CompanyID) != null);
    const id = first2 ? positiveInt(first2.CompanyID) : null;
    if (id) return id;
  }
  params.log.warnings.push(`Could not resolve company "${cleanName}".`);
  return null;
}
async function resolveContactId(params) {
  const fullName = params.fullName.trim();
  if (!fullName) return null;
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || firstName;
  const email = str2(params.email).toLowerCase();
  try {
    const search = await params.client.request({
      token: params.token,
      method: "GET",
      path: `/contacts?PageSize=20&SearchTerm=${encodeURIComponent(fullName)}`
    });
    const list = listFrom(search.data);
    const emailMatch = email ? list.find((c) => positiveInt(c.ContactID) != null && str2(c.Email).toLowerCase() === email) : null;
    if (emailMatch) return positiveInt(emailMatch.ContactID);
    const nameMatch = list.find(
      (c) => positiveInt(c.ContactID) != null && positiveInt(c.CompanyID) === params.companyID && str2(c.ContactName || c.FullName).toLowerCase().includes(firstName.toLowerCase())
    );
    if (nameMatch) return positiveInt(nameMatch.ContactID);
  } catch (error) {
    params.log.warnings.push(`Contact search failed for ${fullName}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const created = await params.client.request({
    token: params.token,
    method: "POST",
    path: "/contacts",
    data: omitEmpty({
      FirstName: firstName,
      LastName: lastName,
      Email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}@placeholder.com`,
      CompanyID: params.companyID,
      MobilePhone: params.phone,
      Categories: 1
    })
  });
  const id = idFrom(created.data, ["ContactID", "ID", "id"]);
  if (created.status >= 200 && created.status < 300 && id) return id;
  params.log.warnings.push(`Could not resolve contact "${fullName}".`);
  return null;
}
async function createProperty(params) {
  const payload = omitEmpty({
    Name: params.address,
    AddressLine1: params.address,
    City: params.city || "Unknown",
    StateID: 1004,
    Zip: params.zip || "00000",
    PropertyTypeID: params.propertyTypeID,
    Latitude: 0,
    Longitude: 0,
    SquareFootage: Math.max(1, Math.round(params.sqft)),
    BuildingSizeSf: Math.max(1, Math.round(params.totalBldgSF)),
    YearBuilt: params.yearBuilt || void 0
  });
  const res = await params.client.request({ token: params.token, method: "POST", path: "/properties", data: payload });
  const id = idFrom(res.data, ["PropertyID", "ID", "id"]);
  if (res.status >= 200 && res.status < 300 && id) return id;
  if (res.status === 409) {
    const retry = await params.client.request({
      token: params.token,
      method: "GET",
      path: `/properties?SearchTerm=${encodeURIComponent(params.address)}&PageSize=5`
    });
    const found = listFrom(retry.data).find((p) => idFrom(p, ["PropertyID", "ID", "id"]) != null);
    const foundId = found ? idFrom(found, ["PropertyID", "ID", "id"]) : null;
    if (foundId) {
      params.log.warnings.push(`Using existing Dealius property ${foundId} after duplicate response.`);
      return foundId;
    }
  }
  throw new Error(`Dealius property create failed (HTTP ${res.status}).`);
}
async function createSpace(params) {
  const payload = omitEmpty({
    Name: params.name,
    SpaceTypeID: params.propertyTypeID,
    SpaceAvailableSf: Math.max(1, Math.round(params.sqft)),
    StreetAddress: params.address,
    SuiteNumber: params.suite,
    City: params.city || "Unknown",
    StateID: 1004,
    Zip: params.zip || "00000",
    YearBuilt: params.yearBuilt || void 0,
    Details: params.details && Object.keys(params.details).length ? params.details : void 0
  });
  const res = await params.client.request({
    token: params.token,
    method: "POST",
    path: `/properties/${params.propertyID}/spaces`,
    data: payload
  });
  if (res.status < 200 || res.status >= 300) return null;
  return idFrom(res.data, ["PropertySpaceID", "ID", "id"]);
}
async function pushDealEntryToDealius(params) {
  const validation = validateDealEntryForDealiusPush(params.entry);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const d = normalizeDealEntry(params.entry);
  const log = { warnings: [], steps: [] };
  const client = new DealiusClient();
  const token = await authenticateConfiguredDealius(client);
  const directory = getDealiusUserDirectory();
  const estimatedCloseDate = todayIsoDate();
  const propertyID = await createProperty({
    client,
    token,
    address: d.propertyName,
    city: d.city,
    zip: d.zip,
    propertyTypeID: d.propertyTypeID,
    sqft: d.sqft,
    totalBldgSF: d.totalBldgSF,
    yearBuilt: d.yearBuilt,
    log
  });
  log.steps.push({ key: "property", ok: true, detail: String(propertyID) });
  const spaceDetails = omitEmpty({
    BuildingClass: d.bldgClass || void 0,
    ClearHeight: d.clearHeight || void 0,
    IndustrialSF: d.indSF || void 0,
    OfficeSF: d.officeSF || void 0,
    NumberOfParkingSpaces: d.numParkingSpaces || void 0,
    NumberOfGLDoors: d.glDoors || void 0,
    NumberOfTruckLevelDoors: d.dhDoors || void 0,
    NumberOfFloors: d.numFloors || void 0,
    RailLine: d.rail || void 0,
    Zoning: d.parkRatio || void 0
  });
  const propertySpaceID = await createSpace({
    client,
    token,
    propertyID,
    name: d.propertyName,
    address: d.address,
    city: d.city,
    zip: d.zip,
    suite: d.suite,
    propertyTypeID: d.propertyTypeID,
    sqft: d.sqft,
    yearBuilt: d.yearBuilt,
    details: spaceDetails
  });
  log.steps.push({ key: "space", ok: Boolean(propertySpaceID), detail: propertySpaceID ? String(propertySpaceID) : "Skipped" });
  const clientID = d.clientCo ? await resolveCompanyId({ client, token, name: d.clientCo, log }) : null;
  const oppositeID = d.oppositeCo ? await resolveCompanyId({ client, token, name: d.oppositeCo, log }) : null;
  log.steps.push({ key: "companies", ok: Boolean(clientID || oppositeID), detail: [clientID, oppositeID].filter(Boolean).join(", ") });
  const clientContactID = clientID && d.clientContactName ? await resolveContactId({
    client,
    token,
    fullName: d.clientContactName,
    email: d.clientContactEmail,
    phone: d.clientContactPhone,
    companyID: clientID,
    log
  }) : null;
  const oppositeContactID = oppositeID && d.oppositeContactName ? await resolveContactId({
    client,
    token,
    fullName: d.oppositeContactName,
    email: d.oppositeContactEmail,
    phone: d.oppositeContactPhone,
    companyID: oppositeID,
    log
  }) : null;
  const dealPayload = omitEmpty({
    DealName: d.dealName,
    RepresentationTypeID: d.repTypeID,
    SpaceTypeID: d.propertyTypeID,
    EstimatedCloseDate: estimatedCloseDate,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceID || void 0,
    ClientID: clientID || void 0,
    OppositeSideID: oppositeID || void 0,
    ClientRepFee: d.feePercent ?? void 0,
    OppositeSideRepFee: d.feePercent ?? void 0,
    ...d.isLease ? omitEmpty({
      LeaseTypeID: 1003,
      LeaseTerm: d.term,
      LeaseCommencementDate: isoDate(d.startDate),
      LeaseTermDate: isoDate(d.endDate),
      LeaseOccupancyDate: isoDate(d.occupancyDate),
      LeaseCurrentSquareFeetOccupied: d.sqft,
      RequestedSpace: d.sqft
    }) : {},
    ...d.isSale ? omitEmpty({
      SaleAskingPriceAmount: d.totalConsideration,
      SalePurchasePriceAmount: d.totalConsideration
    }) : {},
    PaymentDate: isoDate(d.paymentDate),
    PaymentAmount: d.paymentAmount ?? void 0
  });
  const dealRes = await client.request({ token, method: "POST", path: "/deals", data: dealPayload });
  const dealID = idFrom(dealRes.data, ["DealID", "ID", "id"]);
  if (!dealID) throw new Error(`Dealius deal create failed (HTTP ${dealRes.status}).`);
  log.steps.push({ key: "deal", ok: true, detail: String(dealID) });
  for (const contactID of [clientContactID, oppositeContactID].filter(Boolean)) {
    const link = await client.request({
      token,
      method: "POST",
      path: "/deals/contacts/add",
      data: { DealID: dealID, ContactID: contactID }
    });
    if (link.status < 200 || link.status >= 300) log.warnings.push(`Contact ${contactID} was not linked to deal ${dealID}.`);
  }
  const feeFraction = d.feePercent != null && d.feePercent > 1 ? d.feePercent / 100 : d.feePercent;
  const financialPayload = omitEmpty({
    DealID: dealID,
    DealName: d.dealName,
    ClientID: clientID || void 0,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceID || void 0,
    ...d.feePercent != null ? { ClientRepFee: d.feePercent, OppositeSideRepFee: d.feePercent } : {},
    LeaseCommencementDate: isoDate(d.startDate),
    LeaseTermDate: isoDate(d.endDate),
    LeaseOccupancyDate: isoDate(d.occupancyDate),
    LeaseTerm: d.rentRows.reduce((sum, row) => sum + row.months, 0) || d.term || void 0,
    LeaseTypeID: d.isLease ? 1003 : void 0,
    LeaseCurrentSquareFeetOccupied: d.isLease ? d.sqft : void 0,
    RequestedSpace: d.isLease ? d.sqft : void 0,
    LeaseAskingRatePerSf: d.askingRate ?? void 0,
    LeaseAskingRatePerSfType: d.askingRate != null ? 2 : void 0,
    LeaseNNNPerSF: d.totalNNN ?? void 0,
    LeaseNNNPerSFType: d.totalNNN != null ? 2 : void 0,
    LeaseTaxes: d.propTaxes ?? void 0,
    LeaseTaxesType: d.propTaxes != null ? 2 : void 0,
    LeaseInsurance: d.insurance ?? void 0,
    LeaseInsuranceType: d.insurance != null ? 2 : void 0,
    LeaseOpex: d.opex ?? void 0,
    LeaseOpexType: d.opex != null ? 2 : void 0,
    LeaseCamsPerSf: d.cams ?? void 0,
    LeaseCamsPerSfType: d.cams != null ? 2 : void 0,
    LeaseTiAllowancePerSf: d.tiPerSF ?? void 0,
    LeaseTiAllowancePerSfType: d.tiPerSF != null ? 2 : void 0,
    LeaseAvgEscalation: d.escalation ?? void 0,
    LeaseAvgEscalationType: d.escalation != null ? 2 : void 0,
    SaleAskingPriceAmount: d.isSale ? d.totalConsideration ?? void 0 : void 0,
    SalePurchasePriceAmount: d.isSale ? d.totalConsideration ?? void 0 : void 0,
    PaymentDate: isoDate(d.paymentDate),
    PaymentAmount: d.paymentAmount ?? void 0
  });
  const put = await client.request({ token, method: "PUT", path: "/deals", data: financialPayload });
  if (put.status < 200 || put.status >= 300) {
    const retryPayload = omitEmpty({
      ...financialPayload,
      ClientRepFee: feeFraction ?? void 0,
      OppositeSideRepFee: feeFraction ?? void 0
    });
    const retry = await client.request({ token, method: "PUT", path: "/deals", data: retryPayload });
    if (retry.status < 200 || retry.status >= 300) log.warnings.push(`Financial update returned HTTP ${put.status}.`);
  }
  log.steps.push({ key: "financials", ok: true });
  if (d.isLease && d.rentRows.length) {
    const rents = d.rentRows.map((r, index2) => ({
      PeriodNo: index2 + 1,
      Months: r.months,
      MonthlyRatePerSf: r.free ? null : Number(((r.monthly ?? 0) / Math.max(1, d.sqft)).toFixed(6))
    }));
    const primary = await client.request({ token, method: "POST", path: "/deals/rents", data: { DealID: dealID, Rents: rents } });
    if (primary.status < 200 || primary.status >= 300) {
      const fallback = rents.map((r) => ({ ...r, MonthlyRatePerSf: r.MonthlyRatePerSf == null ? 0 : r.MonthlyRatePerSf }));
      const retry = await client.request({ token, method: "POST", path: "/deals/rents", data: { DealID: dealID, Rents: fallback } });
      if (retry.status < 200 || retry.status >= 300) log.warnings.push(`Rent schedule returned HTTP ${primary.status}.`);
    }
  }
  log.steps.push({ key: "rent", ok: !d.isLease || d.rentRows.length > 0, detail: `${d.rentRows.length} row(s)` });
  if (d.brokers.length) {
    const rows = [];
    for (const broker of d.brokers) {
      const contactID = await resolveBrokerContactId({ client, token, name: broker.name, directory });
      if (!contactID) {
        log.warnings.push(`Broker "${broker.name}" was not resolved.`);
        continue;
      }
      const pct = broker.pct != null && broker.pct > 1 ? broker.pct / 100 : broker.pct ?? 0;
      rows.push({ DealID: dealID, ContactID: contactID, IsLead: broker.lead || rows.length === 0, Commission: pct * 100 });
    }
    if (rows.length) {
      const primary = await client.request({
        token,
        method: "POST",
        path: "/deals/brokers",
        data: { DealID: dealID, DealBrokers: rows }
      });
      if (primary.status < 200 || primary.status >= 300) {
        const retry = await client.request({
          token,
          method: "POST",
          path: "/deals/brokers",
          data: { DealID: dealID, DealBrokers: rows.map((r) => ({ ...r, Commission: r.Commission / 100 })) }
        });
        if (retry.status < 200 || retry.status >= 300) log.warnings.push(`Broker assignment returned HTTP ${primary.status}.`);
      }
    }
  }
  log.steps.push({ key: "brokers", ok: true, detail: `${d.brokers.length} broker(s)` });
  return {
    entryMode: "deal",
    dealID,
    dealName: d.dealName,
    propertyName: d.propertyName,
    estimatedCloseDate,
    propertyID,
    propertySpaceID,
    warnings: log.warnings,
    steps: log.steps
  };
}
async function pushListingEntryToDealius(params) {
  const validation = validateListingEntryForDealiusPush(params.entry);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const l = normalizeListingEntry(params.entry);
  const log = { warnings: [], steps: [] };
  const client = new DealiusClient();
  const token = await authenticateConfiguredDealius(client);
  const directory = getDealiusUserDirectory();
  const ownerCompanyID = l.ownerCompany ? await resolveCompanyId({ client, token, name: l.ownerCompany, log }) : null;
  log.steps.push({ key: "owner", ok: Boolean(ownerCompanyID || !l.ownerCompany), detail: ownerCompanyID ? String(ownerCompanyID) : "No owner linked" });
  const propertyID = await createProperty({
    client,
    token,
    address: l.propertyName,
    city: l.city,
    zip: l.zip,
    propertyTypeID: l.propertyTypeID,
    sqft: l.sqft,
    totalBldgSF: l.totalBldgSF,
    yearBuilt: l.yearBuilt,
    log
  });
  log.steps.push({ key: "property", ok: true, detail: String(propertyID) });
  const propertySpaceIDs = [];
  for (const space of l.spaces) {
    const spaceName = propertyNameFromAddressSuite(l.address, space.suite);
    const id = await createSpace({
      client,
      token,
      propertyID,
      name: spaceName || l.propertyName,
      address: l.address,
      city: l.city,
      zip: l.zip,
      suite: space.suite,
      propertyTypeID: l.propertyTypeID,
      sqft: space.sqft || l.sqft,
      yearBuilt: l.yearBuilt,
      details: omitEmpty({
        AskingRate: space.askingRate ?? void 0,
        AvailableDate: isoDate(space.availableDate),
        Comments: space.comments || void 0
      })
    });
    if (id) propertySpaceIDs.push(id);
  }
  log.steps.push({ key: "spaces", ok: propertySpaceIDs.length > 0, detail: `${propertySpaceIDs.length} space(s)` });
  const listingPayload = omitEmpty({
    Name: l.listingName,
    CompanyID: ownerCompanyID || void 0,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceIDs[0] || void 0,
    TransactionType: l.transactionType,
    AskingRate: l.askingRate ?? void 0,
    AskingRateType: l.askingRate != null ? 2 : void 0,
    CommissionPercent: l.commission ?? void 0,
    ListingStartDate: isoDate(l.listingStartDate),
    ListingExpiryDate: isoDate(l.listingExpiryDate),
    AvailableDate: isoDate(l.listingAvailableDate),
    Status: l.listingStatus || void 0,
    Source: l.listingSource || void 0,
    Notes: l.listingNotes || void 0
  });
  const listingRes = await client.request({ token, method: "POST", path: "/listings", data: listingPayload });
  const listingID = idFrom(listingRes.data, ["ListingID", "ID", "id"]);
  if (listingRes.status === 404) {
    log.warnings.push("/listings endpoint returned 404. Property and spaces were created, but listing shell was not.");
  } else if (listingRes.status < 200 || listingRes.status >= 300 || !listingID) {
    log.warnings.push(`Listing create returned HTTP ${listingRes.status}.`);
  }
  log.steps.push({ key: "listing", ok: Boolean(listingID), detail: listingID ? String(listingID) : "Not created" });
  if (listingID && l.brokers.length) {
    for (const broker of l.brokers) {
      const contactID = await resolveBrokerContactId({ client, token, name: broker.name, directory });
      if (!contactID) {
        log.warnings.push(`Broker "${broker.name}" was not resolved.`);
        continue;
      }
      const pct = broker.pct != null && broker.pct > 1 ? broker.pct : broker.pct != null ? broker.pct * 100 : void 0;
      const primary = await client.request({
        token,
        method: "POST",
        path: `/listings/${listingID}/brokers`,
        data: omitEmpty({
          ListingID: listingID,
          ContactID: contactID,
          IsLead: broker.lead || l.brokers.indexOf(broker) === 0,
          Commission: pct
        })
      });
      if (primary.status < 200 || primary.status >= 300) {
        const retry = await client.request({
          token,
          method: "POST",
          path: `/listings/${listingID}/brokers`,
          data: omitEmpty({
            ListingID: listingID,
            ContactID: contactID,
            IsLead: broker.lead || l.brokers.indexOf(broker) === 0,
            Commission: pct != null ? pct / 100 : void 0
          })
        });
        if (retry.status < 200 || retry.status >= 300) log.warnings.push(`Broker "${broker.name}" was not assigned.`);
      }
    }
  }
  log.steps.push({ key: "brokers", ok: true, detail: `${l.brokers.length} broker(s)` });
  return {
    entryMode: "listing",
    listingID: listingID ?? null,
    listingName: l.listingName,
    propertyName: l.propertyName,
    propertyID,
    propertySpaceIDs,
    warnings: log.warnings,
    steps: log.steps
  };
}

// server/services/dealiusPush.ts
function validateVoucherPayloadForDealiusPush(payload) {
  return validateDealEntryForDealiusPush(buildDealEntryFromSubmissionPayload(payload ?? {}));
}
async function pushVoucherSubmissionToDealius(params) {
  return pushDealEntryToDealius({
    entry: buildDealEntryFromSubmissionPayload(params.payload ?? {})
  });
}

// server/services/voucherExcel.ts
import XLSX3 from "xlsx";
function repLabelFromId(id) {
  const map = {
    1: "Buyer Rep",
    2: "Seller Rep",
    3: "Tenant Rep",
    4: "Landlord Rep",
    5: "Other / Referred Rep"
  };
  return map[id] ?? "Landlord Rep";
}
function normalizePropertyType2(raw) {
  const v = raw.toLowerCase();
  if (v.includes("industrial")) return "Industrial";
  if (v.includes("office")) return "Office";
  if (v.includes("retail")) return "Retail";
  if (v.includes("land")) return "Land";
  if (v.includes("multi")) return "Multi-Family";
  if (v.includes("medical")) return "Medical";
  if (v.trim()) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return "Industrial";
}
function suiteLabel2(raw) {
  const value = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  if (/^(suite|ste\.?|unit|#)\b/i.test(value)) return value.replace(/^ste\.?\b/i, "Ste");
  return `Ste ${value}`;
}
function propertyNameFromAddressSuite2(address, suite) {
  const cleanAddress = String(address ?? "").trim();
  const cleanSuite = suiteLabel2(suite);
  if (!cleanAddress) return cleanSuite;
  if (!cleanSuite) return cleanAddress;
  const normalizedAddress = cleanAddress.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const normalizedSuite = cleanSuite.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const suiteNumber = normalizedSuite.replace(/^(suite|ste|unit|#)\s*/, "").trim();
  if (normalizedAddress.includes(normalizedSuite) || suiteNumber && new RegExp(`(^|\\s|#)${suiteNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedAddress)) {
    return cleanAddress;
  }
  return `${cleanAddress}, ${cleanSuite}`;
}
function g(rows, r, c) {
  const row = rows[r];
  if (!row || row[c] == null) return "";
  const v = row[c];
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v).trim();
}
function gn(rows, r, c) {
  const v = g(rows, r, c);
  if (!v) return null;
  const n = Number.parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function gb(rows, r, c) {
  const v = g(rows, r, c).toUpperCase();
  return v === "Y" || v === "YES" || v === "TRUE";
}
function gd(rows, r, c) {
  const v = g(rows, r, c);
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
function readWorksheetCellStr(ws, addr) {
  const cell = ws[addr];
  if (!cell) return "";
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return cell.v.toISOString().slice(0, 10);
  return String(cell.w ?? cell.v ?? "").trim();
}
function readWorksheetCellNum(ws, addr) {
  const s = readWorksheetCellStr(ws, addr);
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function cellStrAtRC(ws, r, c) {
  const merges = ws["!merges"] ?? [];
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      return readWorksheetCellStr(ws, XLSX3.utils.encode_cell(m.s));
    }
  }
  return readWorksheetCellStr(ws, XLSX3.utils.encode_cell({ r, c }));
}
function isLeeVoucher431Template(rows) {
  return g(rows, 33, 0).toUpperCase().includes("LEASE TRANSACTION DETAILS");
}
function txRawFrom431(ws, rows) {
  const fromMerge = cellStrAtRC(ws, 4, 1).toLowerCase();
  if (fromMerge) return fromMerge;
  return (g(rows, 3, 3) || g(rows, 4, 1) || g(rows, 3, 1) || "").toLowerCase();
}
function saleCommPctFrom431(ws, rows) {
  const candidates = [
    gn(rows, 42, 12),
    gn(rows, 43, 12),
    readWorksheetCellNum(ws, "M43"),
    readWorksheetCellNum(ws, "N43"),
    readWorksheetCellNum(ws, "M42"),
    gn(rows, 41, 12)
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  return null;
}
function readFirstSheetRowsAndWorksheet(buffer) {
  const wb = XLSX3.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("Workbook has no sheets.");
  const ws = wb.Sheets[name];
  if (!ws) throw new Error("Workbook first sheet is missing.");
  const rows = XLSX3.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  return { rows, ws };
}
function parseLeeVoucherGridInternal(rows, ws, layout) {
  const v431 = layout === "v431";
  const txRaw = (v431 && ws ? txRawFrom431(ws, rows) : g(rows, 3, 3) || g(rows, 4, 1) || g(rows, 3, 1) || "").toLowerCase();
  const isReferral = txRaw.includes("referral") || txRaw.includes("referred") || txRaw.includes("referr");
  const isLease = !isReferral && (txRaw.includes("lease") || txRaw === "");
  const isSale = !isReferral && (txRaw.includes("sale") || txRaw.includes("sold"));
  const listingHouse = ((v431 && ws ? cellStrAtRC(ws, 84, 2) : "") || (v431 ? g(rows, 84, 2) : g(rows, 84, 2))).toLowerCase();
  const procuringHouse = ((v431 && ws ? cellStrAtRC(ws, 84, 10) : "") || (v431 ? g(rows, 84, 10) : g(rows, 84, 10))).toLowerCase();
  const ourKeywords = ["newport", "lee & assoc", "lee and assoc"];
  const isListing = ourKeywords.some((k) => listingHouse.includes(k));
  const isProcuring = ourKeywords.some((k) => procuringHouse.includes(k));
  let fallbackSide = "";
  let hasListingBroker = false;
  let hasProcuringBroker = false;
  const brokerScanEnd = v431 ? 132 : 129;
  for (let r = 122; r <= brokerScanEnd; r++) {
    const side = g(rows, r, 3).toLowerCase();
    if (side.includes("listing")) {
      hasListingBroker = true;
      if (!fallbackSide) fallbackSide = "listing";
    }
    if (side.includes("procur")) {
      hasProcuringBroker = true;
      if (!fallbackSide) fallbackSide = "procuring";
    }
  }
  const representedBothSides = isListing && isProcuring || hasListingBroker && hasProcuringBroker;
  const onListingSide = representedBothSides || isListing || !isProcuring && fallbackSide === "listing";
  let repTypeID;
  if (isReferral) repTypeID = 5;
  else if (isLease) repTypeID = onListingSide ? 4 : 3;
  else repTypeID = onListingSide ? 2 : 1;
  const address = ws ? cellStrAtRC(ws, 8, 1) || g(rows, 8, 1) : g(rows, 8, 1);
  let city = ws ? cellStrAtRC(ws, 8, 10) || g(rows, 8, 10) : g(rows, 8, 10);
  if (!city || city.length <= 2 || /^\d+$/.test(city)) city = g(rows, 8, 9) || g(rows, 8, 11) || g(rows, 8, 12) || city;
  const zip = ws ? cellStrAtRC(ws, 8, 13) || cellStrAtRC(ws, 8, 14) || g(rows, 8, 13) || g(rows, 8, 14) : g(rows, 8, 13) || g(rows, 8, 14);
  const lessorName = ws ? cellStrAtRC(ws, 11, 2) || g(rows, 11, 2) : g(rows, 11, 2);
  const lesseeName = ws ? cellStrAtRC(ws, 11, 10) || g(rows, 11, 10) : g(rows, 11, 10);
  const clientCo = onListingSide ? lessorName : lesseeName;
  const oppositeCo = onListingSide ? lesseeName : lessorName;
  const propTypeRaw = g(rows, 3, 6) || "";
  const suite = g(rows, 21, 2);
  const sqft = v431 ? gn(rows, 35, 2) ?? gn(rows, 22, 1) ?? gn(rows, 22, 2) : gn(rows, 22, 2);
  const subType = g(rows, 22, 10) || propTypeRaw;
  const landSF = gn(rows, 22, 12);
  const totalBldgSF = v431 ? gn(rows, 23, 1) ?? gn(rows, 23, 2) : gn(rows, 23, 2);
  const indSF = gn(rows, 23, 4);
  const officeSF = gn(rows, 23, 10);
  const bldgClass = g(rows, 24, 2);
  const yearBuilt = gn(rows, 24, 4);
  const numFloors = gn(rows, 24, 6);
  const numParkingSpaces = gn(rows, 25, 4);
  const parkRatio = g(rows, 25, 6);
  const dhDoors = gn(rows, 27, 2);
  const glDoors = gn(rows, 27, 4);
  const clearHeight = gn(rows, 27, 6);
  const sprinklers = gb(rows, 27, 10);
  const ampsRaw = g(rows, 27, 12);
  const rail = g(rows, 28, 2);
  const bldgCond = g(rows, 28, 6);
  const lessorContact = g(rows, 12, 2);
  const lesseeContact = g(rows, 12, 10);
  const lessorEmail = g(rows, 13, 2);
  const lesseeEmail = g(rows, 13, 10);
  const lessorPhone = g(rows, 17, 2);
  const lesseePhone = g(rows, 17, 10);
  const startDate = gd(rows, 35, 4);
  const endDate = gd(rows, 35, 7);
  const occupancyDate = gd(rows, 37, 1);
  const termRaw = gn(rows, 37, 4) || gn(rows, 36, 4);
  const monthsOnMkt = gn(rows, 37, 10) || gn(rows, 36, 10);
  const propTaxes = gn(rows, 39, 5);
  const tiPerSF = gn(rows, 39, 7);
  const insurance = gn(rows, 40, 5);
  const askingRate = gn(rows, 41, 2);
  const totalNNN = gn(rows, 42, 5);
  const escalation = gn(rows, 43, 2);
  const opex = gn(rows, 26, 4);
  const totalConsideration = v431 ? gn(rows, 35, 12) ?? gn(rows, 35, 13) ?? (ws ? readWorksheetCellNum(ws, "M36") : null) : gn(rows, 35, 12);
  const saleCommPct = v431 && ws ? saleCommPctFrom431(ws, rows) : gn(rows, 42, 12);
  const rentRows = [];
  const rentEnd = v431 ? 70 : 66;
  for (let r = 52; r <= rentEnd; r++) {
    const monthly = gn(rows, r, 0);
    let months = gn(rows, r, 3);
    if (v431 && ws && monthly != null && monthly > 0 && (months == null || months <= 0)) {
      const fromCell = readWorksheetCellNum(ws, XLSX3.utils.encode_cell({ r, c: 3 }));
      if (fromCell != null && fromCell > 0) months = fromCell;
    }
    if (months && months > 0) {
      const isFree = !monthly || monthly === 0;
      rentRows.push({ monthly: isFree ? 0 : monthly, months, free: isFree });
    }
  }
  const rentMonthSum = rentRows.reduce((s, r) => s + (r.months || 0), 0);
  const term = termRaw || (rentMonthSum > 0 ? rentMonthSum : null);
  const brokers = [];
  for (let r = 123; r <= 129; r++) {
    const name = g(rows, r, 0);
    const side = g(rows, r, 3);
    let pct = gn(rows, r, 4);
    if (name && pct != null) {
      let frac = pct;
      if (frac > 1) frac = frac / 100;
      brokers.push({ name, side, pct: frac });
    }
  }
  const outsideBrokers = [];
  const lN = g(rows, 95, 2), lA = gn(rows, 95, 11);
  const pN = g(rows, 97, 2), pA = gn(rows, 97, 11);
  const eN = g(rows, 99, 1), eA = gn(rows, 99, 11);
  if (lN && lA != null) outsideBrokers.push({ name: lN, amt: lA });
  if (pN && pA != null) outsideBrokers.push({ name: pN, amt: pA });
  if (eN && eA != null) outsideBrokers.push({ name: eN, amt: eA });
  const txWord = isReferral ? "Referred" : isSale ? "Sold" : "Leased";
  const dealName = txWord + ": " + propertyNameFromAddressSuite2(address, suite);
  const clientContact = onListingSide ? lessorContact : lesseeContact;
  const oppositeContact = onListingSide ? lesseeContact : lessorContact;
  const clientEmail = onListingSide ? lessorEmail : lesseeEmail;
  const oppositeEmail = onListingSide ? lesseeEmail : lessorEmail;
  const clientPhone = onListingSide ? lessorPhone : lesseePhone;
  const oppositePhone = onListingSide ? lesseePhone : lessorPhone;
  return {
    dealName,
    repTypeID,
    isLease,
    isSale,
    transactionType: isReferral ? "Referral" : isLease ? "Lease" : "Sale",
    representationType: repLabelFromId(repTypeID),
    address,
    city,
    zip,
    suite: suite || void 0,
    propertyType: normalizePropertyType2(subType || propTypeRaw),
    sqft,
    dealSF: sqft,
    totalBldgSF,
    landSF,
    indSF,
    officeSF,
    clientCo: clientCo || void 0,
    oppositeCo: oppositeCo || void 0,
    lessorName: lessorName || void 0,
    lesseeName: lesseeName || void 0,
    clientContact: clientContact || void 0,
    oppositeContact: oppositeContact || void 0,
    clientEmail: clientEmail || void 0,
    oppositeEmail: oppositeEmail || void 0,
    clientPhone: clientPhone || void 0,
    oppositePhone: oppositePhone || void 0,
    startDate,
    endDate,
    occupancyDate,
    term,
    totalConsideration: totalConsideration ?? void 0,
    saleCommPct,
    rentRows,
    brokers,
    outsideBrokers,
    _debug: {
      template: layout,
      listingHouse,
      procuringHouse,
      isListing,
      isProcuring,
      hasListingBroker,
      hasProcuringBroker,
      representedBothSides,
      fallbackSide,
      onListingSide,
      txRaw
    }
  };
}
function submissionPayloadPatchFromParsedVoucher(parsed) {
  const fee = parsed.saleCommPct != null && parsed.saleCommPct > 0 ? parsed.saleCommPct : null;
  const brokersForApi = parsed.brokers.map((b) => ({
    name: b.name,
    pct: b.pct,
    side: b.side
  }));
  const patch = {
    dealName: parsed.dealName,
    repTypeID: parsed.repTypeID,
    txnType: parsed.transactionType,
    transactionType: parsed.transactionType,
    representationType: parsed.representationType,
    address: parsed.address,
    city: parsed.city,
    zip: parsed.zip,
    propertyAddress: [parsed.address, parsed.city, parsed.zip].filter(Boolean).join(", "),
    suite: parsed.suite,
    propertyType: parsed.propertyType,
    sqft: parsed.sqft,
    dealSF: parsed.dealSF,
    totalBldgSF: parsed.totalBldgSF,
    landSF: parsed.landSF,
    indSF: parsed.indSF,
    officeSF: parsed.officeSF,
    lessorName: parsed.lessorName,
    lesseeName: parsed.lesseeName,
    clientCo: parsed.clientCo,
    oppositeCo: parsed.oppositeCo,
    clientContactName: parsed.clientContact,
    oppositeContactName: parsed.oppositeContact,
    clientContactEmail: parsed.clientEmail,
    oppositeContactEmail: parsed.oppositeEmail,
    clientContactPhone: parsed.clientPhone,
    oppositeContactPhone: parsed.oppositePhone,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    occupancyDate: parsed.occupancyDate,
    term: parsed.term,
    totalConsideration: parsed.totalConsideration,
    saleCommPct: parsed.saleCommPct,
    commissionRate: fee != null ? String(fee) : void 0,
    feePercent: fee ?? void 0,
    rentRows: parsed.rentRows,
    brokers: brokersForApi,
    outsideBrokers: parsed.outsideBrokers,
    excelImport: {
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      parser: parsed._debug?.template === "v431" ? "lee_voucher_excel_v431" : "lee_voucher_excel_v1",
      debug: parsed._debug ?? null
    }
  };
  if (parsed.brokers.length > 0) {
    patch.listingAgentName = parsed.brokers[0].name;
  }
  return patch;
}
function parseLeeVoucherExcelBuffer(buffer) {
  const { rows, ws } = readFirstSheetRowsAndWorksheet(buffer);
  if (isLeeVoucher431Template(rows)) {
    return parseLeeVoucherGridInternal(rows, ws, "v431");
  }
  return parseLeeVoucherGridInternal(rows, ws, "legacy");
}

// server/services/listingFormPdf.ts
import { PDFParse } from "pdf-parse";
function str3(raw) {
  return String(raw ?? "").trim();
}
function num3(raw) {
  const value = str3(raw);
  if (!value) return null;
  const clean = value.replace(/[$,%]/g, "").replace(/,/g, "");
  const match = clean.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
function cleanMoneyOrRate(raw) {
  return num3(raw);
}
function checked(fields, name) {
  return str3(fields[name]).toLowerCase() === "on";
}
function first(fields, names) {
  for (const name of names) {
    const value = str3(fields[name]);
    if (value && value !== "Pick 1" && value.toLowerCase() !== "off") return value;
  }
  return "";
}
function selected(fields, names) {
  return names.find((name) => checked(fields, name)) ?? "";
}
function inferPropertyType(text2, fields) {
  const upper = text2.toUpperCase();
  if (upper.includes("INDUSTRIAL LISTING ENTRY FORM")) return "Industrial";
  if (upper.includes("OFFICE LISTING ENTRY FORM")) return "Office";
  if (upper.includes("RETAIL LISTING ENTRY FORM")) return "Retail";
  if (checked(fields, "Vacant Land")) return "Land";
  return "Industrial";
}
function inferTransaction(fields) {
  const lease = checked(fields, "Lease");
  const sale = checked(fields, "Sale");
  const saleLease = checked(fields, "Sale /Lease") || checked(fields, "Sale/Lease") || checked(fields, "Sale Lease");
  const sublease = checked(fields, "Sublease");
  if (sublease) return { transactionType: "Sublease", listingTransaction: "sublease" };
  if (lease && sale || saleLease) return { transactionType: "Sale or Lease", listingTransaction: "sale or lease" };
  if (sale) return { transactionType: "Sale", listingTransaction: "sale" };
  return { transactionType: "Lease", listingTransaction: "lease" };
}
function inferLeaseType(fields) {
  const picked = selected(fields, ["NNN", "FSG", "MG", "G"]);
  if (!picked) return void 0;
  return picked === "G" ? "Gross" : picked;
}
function listingNameFor(_transactionType, address) {
  return address || "New Listing";
}
function collectSpaces(fields, propertyType) {
  const spaces = [];
  for (let index2 = 1; index2 <= 12; index2++) {
    const suite = first(fields, [`SUITE Row${index2}`, `Suite Row${index2}`, `FLR Row${index2}`]);
    const sqft = num3(first(fields, [`AVAIL SFRow${index2}`, `AVAILABLE SFRow${index2}`, `Avail SF Row${index2}`]));
    const askingRate = cleanMoneyOrRate(first(fields, [`LEASE RATESFRow${index2}`, `LEASE RATE/SFRow${index2}`, `Lease Rate Row${index2}`]));
    const availableDate = first(fields, [`DATE AVAILRow${index2}`, `Date Avail Row${index2}`]);
    const comments = first(fields, [`COMMENTSRow${index2}`, `Comments Row${index2}`]);
    if (suite || sqft != null || askingRate != null || comments) {
      spaces.push({ suite, sqft, askingRate, availableDate, comments });
    }
  }
  if (spaces.length === 0 && propertyType === "Industrial") {
    const sqft = num3(fields.Size);
    if (sqft != null) spaces.push({ suite: "", sqft });
  }
  return spaces;
}
function parseListingFormFields(fields, text2 = "") {
  const propertyType = inferPropertyType(text2, fields);
  const transaction = inferTransaction(fields);
  const address = first(fields, ["Address", "Street Address"]);
  const city = first(fields, ["City"]);
  const state = first(fields, ["State"]) || "CA";
  const zip = first(fields, ["Zip", "ZIP"]);
  const spaces = collectSpaces(fields, propertyType);
  const spacesSqft = spaces.reduce((sum, space) => sum + (space.sqft ?? 0), 0);
  const totalBldgSF = num3(first(fields, ["GLABldg SF", "Building SF", "Size"]));
  const sqft = spacesSqft > 0 ? spacesSqft : totalBldgSF;
  const suite = spaces.map((space) => space.suite).filter(Boolean).join(", ");
  const askingRate = cleanMoneyOrRate(first(fields, ["SF", "LeaseMo"]));
  const askingPrice = cleanMoneyOrRate(first(fields, ["Sale Price"]));
  const rawAgents = [first(fields, ["Listing Agents 1"]), first(fields, ["Listing Agents 2"])];
  const listingAgentName = rawAgents.filter(Boolean).filter((name) => !name.toLowerCase().includes("lee & assoc") && !name.toLowerCase().includes("lee and assoc")).join("; ");
  const listingNotes = [first(fields, ["Description"]), first(fields, ["Comments"])].filter(Boolean).join("\n\n");
  return {
    propertyType,
    ...transaction,
    listingName: listingNameFor(transaction.transactionType, address),
    address,
    city,
    state,
    zip,
    suite: suite || void 0,
    sqft,
    totalBldgSF,
    yearBuilt: num3(first(fields, ["Year Built"])),
    askingRate,
    askingPrice,
    leaseType: inferLeaseType(fields),
    listingAgentName: listingAgentName || void 0,
    listingAgentEmail: first(fields, ["Email"]) || void 0,
    listingAgentPhone: first(fields, ["Phone"]) || void 0,
    listingNotes: listingNotes || void 0,
    spaces,
    _debug: {
      source: "listing_form_pdf",
      fieldCount: Object.keys(fields).length
    }
  };
}
function setField(fields, key, raw) {
  const name = str3(key);
  const value = Array.isArray(raw) ? raw.map(str3).filter(Boolean).join(", ") : str3(raw);
  if (!name || !value || value === "Off" || value === "Pick 1") return;
  if (fields[name] && fields[name] !== value) fields[name] = `${fields[name]}; ${value}`;
  else fields[name] = value;
}
async function parseListingFormPdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    await parser.load();
    const textResult = await parser.getText();
    const fields = {};
    const doc = parser.doc;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const annotations = await page.getAnnotations({ intent: "display" });
      for (const annotation of annotations) {
        setField(fields, annotation.fieldName, annotation.fieldValue);
      }
    }
    return parseListingFormFields(fields, textResult.text ?? "");
  } finally {
    await parser.destroy?.();
  }
}
function listingFormPatchFromParsed(parsed) {
  const brokers = parsed.listingAgentName ? parsed.listingAgentName.split(";").map((name) => name.trim()).filter(Boolean).map((name, index2) => ({ name, pct: index2 === 0 ? 100 : "", lead: index2 === 0 })) : [];
  return {
    listingName: parsed.listingName,
    propertyType: parsed.propertyType,
    transactionType: parsed.transactionType,
    listingTransaction: parsed.listingTransaction,
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    propertyAddress: [parsed.address, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(", "),
    suite: parsed.suite,
    sqft: parsed.sqft,
    totalBldgSF: parsed.totalBldgSF,
    bldgSF: parsed.totalBldgSF,
    yearBuilt: parsed.yearBuilt,
    askingRate: parsed.askingRate,
    leaseRate: parsed.askingRate,
    askingPrice: parsed.askingPrice,
    totalConsideration: parsed.askingPrice,
    leaseType: parsed.leaseType,
    listingAgentName: parsed.listingAgentName,
    listingAgentEmail: parsed.listingAgentEmail,
    listingAgentPhone: parsed.listingAgentPhone,
    listingNotes: parsed.listingNotes,
    spaces: parsed.spaces,
    brokers,
    listingFormImport: {
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      parser: "lee_listing_form_pdf_v1",
      debug: parsed._debug ?? null
    }
  };
}

// server/submissionsApi.ts
var ACTIVE_QUEUE_STATUSES2 = ["pending", "in_review"];
function isActiveQueueStatus(status) {
  return ACTIVE_QUEUE_STATUSES2.includes(status);
}
var createSchema = z11.union([
  z11.object({
    title: z11.string().trim().min(1).max(256),
    body: z11.string().trim().min(1).max(2e4)
  }),
  z11.object({
    formType: z11.string().trim().min(1).max(32),
    reference: z11.string().trim().max(512).optional(),
    payload: z11.unknown().optional()
  })
]).transform((value) => {
  if ("title" in value) {
    return {
      formType: "item",
      reference: value.title,
      payload: { body: value.body }
    };
  }
  return value;
});
var updateSchema = z11.object({
  status: z11.string().trim().max(32).optional(),
  reference: z11.string().trim().max(512).optional(),
  payload: z11.unknown().optional()
});
var importVoucherExcelBody = z11.object({
  base64Data: z11.string().min(1),
  filename: z11.string().trim().min(1).max(255)
});
var importListingPdfBody = z11.object({
  base64Data: z11.string().min(1),
  filename: z11.string().trim().min(1).max(255)
});
var pushDealiusBody = z11.object({
  entryMode: z11.enum(["deal", "listing"]).optional(),
  entry: z11.record(z11.string(), z11.unknown()).optional(),
  overrides: z11.object({
    feePercent: z11.union([z11.number(), z11.string(), z11.null()]).optional()
  }).optional()
});
var dealiusDocumentBody = z11.object({
  entityType: z11.enum(["deal", "listing"]),
  entityId: z11.union([z11.string(), z11.number()]).transform((v) => String(v).trim()).pipe(z11.string().min(1).max(64)),
  files: z11.array(
    z11.object({
      filename: z11.string().trim().min(1).max(255),
      mimeType: z11.string().trim().min(1).max(128).default("application/octet-stream"),
      base64Data: z11.string().min(1),
      documentType: z11.string().trim().max(128).optional().nullable()
    })
  ).min(1).max(10)
});
var submissionsApiRouter = Router3();
submissionsApiRouter.use(async (req, res, next) => {
  try {
    const user = await resolvePortalRequestUser(req);
    if (!user) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Not authenticated" });
  }
});
submissionsApiRouter.get("/", async (req, res) => {
  const user = req.user;
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const isAdmin = user.role === "admin";
  const includeQueue = String(req.query.includeQueue ?? "").trim().toLowerCase() === "1" || String(req.query.includeQueue ?? "").trim().toLowerCase() === "true";
  const statusFilter = String(req.query.status ?? "").trim();
  const submittedByOpenIdFilter = String(req.query.submittedByOpenId ?? "").trim();
  const submittedByEmailFilter = String(req.query.submittedByEmail ?? "").trim();
  const whereClauses = [];
  if (!isAdmin) {
    whereClauses.push(sql4`${submissions.submittedByOpenId} = ${user.openId}`);
  } else {
    if (statusFilter) whereClauses.push(sql4`${submissions.status} = ${statusFilter}`);
    if (submittedByOpenIdFilter) whereClauses.push(sql4`${submissions.submittedByOpenId} = ${submittedByOpenIdFilter}`);
    if (submittedByEmailFilter) whereClauses.push(sql4`${submissions.submittedByEmail} = ${submittedByEmailFilter}`);
  }
  const whereSql = whereClauses.length ? sql4`where ${sql4.join(whereClauses, sql4` and `)}` : sql4``;
  const baseSql = includeQueue ? sql4`
        with queue as (
          select
            id,
            row_number() over (order by createdAt asc, id asc) as queuePosition
          from submissions
          where status in (${sql4.join(ACTIVE_QUEUE_STATUSES2.map((s) => sql4`${s}`), sql4`, `)})
        )
        select s.*, q.queuePosition as queuePosition
        from submissions s
        left join queue q on q.id = s.id
        ${whereSql}
        order by s.createdAt desc
        limit ${limit}
      ` : sql4`
        select s.*
        from submissions s
        ${whereSql}
        order by s.createdAt desc
        limit ${limit}
      `;
  const result = await db.execute(baseSql);
  const rows = result?.rows ?? result;
  res.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      formType: r.formType,
      status: r.status,
      reference: r.reference,
      submittedBy: r.submittedBy,
      submittedByEmail: r.submittedByEmail,
      submittedByOpenId: r.submittedByOpenId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      queuePosition: includeQueue ? r.queuePosition ?? null : null
    }))
  });
});
submissionsApiRouter.post("/", async (req, res) => {
  const user = req.user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const payload = parsed.data.payload ?? {};
  const [result] = await db.insert(submissions).values({
    formType: parsed.data.formType,
    status: "pending",
    payload: JSON.stringify(payload),
    reference: parsed.data.reference ?? null,
    submittedBy: user.name ?? user.email ?? user.openId,
    submittedByOpenId: user.openId,
    submittedByEmail: user.email ?? null
  });
  res.status(201).json({
    success: true,
    data: { id: result.insertId ?? null }
  });
});
submissionsApiRouter.get("/:id", async (req, res) => {
  const user = req.user;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  res.json({
    success: true,
    data: {
      id: row.id,
      formType: row.formType,
      status: row.status,
      reference: row.reference,
      submittedBy: row.submittedBy,
      submittedByEmail: row.submittedByEmail,
      submittedByOpenId: row.submittedByOpenId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payload: (() => {
        try {
          return JSON.parse(row.payload ?? "{}");
        } catch {
          return {};
        }
      })()
    }
  });
});
submissionsApiRouter.get("/:id/queue", async (req, res) => {
  const user = req.user;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  const [{ count: totalActiveRaw }] = await db.execute(
    sql4`select count(*) as count from submissions where status in (${sql4.join(ACTIVE_QUEUE_STATUSES2.map((s) => sql4`${s}`), sql4`, `)})`
  );
  const totalActive = Number(totalActiveRaw ?? 0) || 0;
  if (!isActiveQueueStatus(row.status)) {
    res.json({
      success: true,
      data: { position: null, totalActive, aheadOfYou: null }
    });
    return;
  }
  const queueRows = await db.execute(
    sql4`
      with queue as (
        select
          id,
          row_number() over (order by createdAt asc, id asc) as position,
          count(*) over () as totalActive
        from submissions
        where status in (${sql4.join(ACTIVE_QUEUE_STATUSES2.map((s) => sql4`${s}`), sql4`, `)})
      )
      select position, totalActive
      from queue
      where id = ${id}
      limit 1
    `
  );
  const q = queueRows[0];
  const position = q?.position ? Number(q.position) : null;
  const totalFromWindow = q?.totalActive ? Number(q.totalActive) : totalActive;
  res.json({
    success: true,
    data: {
      position,
      totalActive: totalFromWindow,
      aheadOfYou: position ? position - 1 : null
    }
  });
});
submissionsApiRouter.post("/:id/push-dealius", async (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  try {
    const parsedBody = pushDealiusBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
      return;
    }
    const overrides = parsedBody.data.overrides;
    const feePercentOverrideRaw = overrides?.feePercent;
    const feePercentOverride = feePercentOverrideRaw === null || feePercentOverrideRaw === void 0 || feePercentOverrideRaw === "" ? null : Number(feePercentOverrideRaw);
    const requestedMode = parsedBody.data.entryMode ?? (row.formType === "listing" ? "listing" : row.formType === "voucher" ? "deal" : void 0);
    if (!requestedMode) {
      res.status(400).json({ success: false, error: `Dealius push not implemented for formType "${row.formType}" yet.` });
      return;
    }
    const bodyEntry = parsedBody.data.entry;
    const pushPayload = bodyEntry && typeof bodyEntry === "object" ? { ...bodyEntry } : feePercentOverride != null && Number.isFinite(feePercentOverride) && feePercentOverride > 0 ? { ...payload, feePercent: feePercentOverride } : payload;
    if (requestedMode === "deal" && feePercentOverride != null && Number.isFinite(feePercentOverride) && feePercentOverride > 0) {
      pushPayload.feePercent = feePercentOverride;
    }
    const validation = requestedMode === "listing" ? validateListingEntryForDealiusPush(pushPayload) : validateVoucherPayloadForDealiusPush(pushPayload);
    if (!validation.ok) {
      res.status(400).json({
        success: false,
        error: validation.errors.join(" "),
        errors: validation.errors
      });
      return;
    }
    const result = requestedMode === "listing" ? await pushListingEntryToDealius({ entry: pushPayload }) : bodyEntry ? await pushDealEntryToDealius({ entry: pushPayload }) : await pushVoucherSubmissionToDealius({ payload: pushPayload });
    const nextPayload = {
      ...payload,
      dealiusPush: {
        ...result,
        pushedAt: (/* @__PURE__ */ new Date()).toISOString(),
        entryMode: requestedMode,
        submittedEntry: pushPayload,
        feePercentOverride: feePercentOverride ?? null
      }
    };
    await db.update(submissions).set({
      status: "approved",
      payload: JSON.stringify(nextPayload),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq10(submissions.id, id));
    res.json({ success: true, data: result });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    res.status(500).json({ success: false, error: msg });
  }
});
submissionsApiRouter.post("/:id/dealius-documents", async (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsedBody = dealiusDocumentBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  const client = new DealiusClient();
  let token;
  try {
    token = await authenticateConfiguredDealius(client);
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    res.status(500).json({ success: false, error: msg });
    return;
  }
  const { entityType, entityId, files } = parsedBody.data;
  const maxBytes = 100 * 1024 * 1024;
  const results = [];
  for (const file of files) {
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    let buffer;
    try {
      buffer = Buffer.from(file.base64Data, "base64");
    } catch {
      results.push({ filename: file.filename, success: false, error: "Invalid base64 data" });
      continue;
    }
    if (!buffer.length) {
      results.push({ filename: file.filename, success: false, error: "Empty file" });
      continue;
    }
    if (buffer.length > maxBytes) {
      results.push({ filename: file.filename, success: false, error: "File too large (max 100MB)" });
      continue;
    }
    const fileKey = `broker-docs/submissions/dealius/${id}/${nanoid5(10)}-${safeFilename}`;
    const stored = await storagePut(fileKey, buffer, file.mimeType);
    await db.insert(uploads).values({
      fileKey,
      url: stored.url,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: buffer.length,
      category: "dealius-document",
      reference: `submission:${id}`,
      uploaderName: user.name ?? "Admin",
      uploaderOpenId: user.openId
    });
    const uploaded = await client.uploadDocument({
      token,
      entityType,
      entityId,
      filename: file.filename,
      mimeType: file.mimeType,
      buffer,
      documentType: file.documentType ?? null
    });
    const success = uploaded.status >= 200 && uploaded.status < 300;
    results.push({
      filename: file.filename,
      success,
      status: uploaded.status,
      response: uploaded.text.slice(0, 500),
      fileKey,
      url: stored.url,
      documentType: file.documentType ?? null
    });
  }
  const previous = Array.isArray(payload.dealiusDocuments) ? payload.dealiusDocuments : [];
  const nextPayload = {
    ...payload,
    dealiusDocuments: [
      ...previous,
      ...results.map((r) => ({
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        entityType,
        entityId,
        ...r
      }))
    ]
  };
  await db.update(submissions).set({ payload: JSON.stringify(nextPayload), updatedAt: /* @__PURE__ */ new Date() }).where(eq10(submissions.id, id));
  const failed = results.filter((r) => !r.success);
  res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    data: { entityType, entityId, results },
    error: failed.length ? `${failed.length} document(s) failed to attach to Dealius.` : void 0
  });
});
submissionsApiRouter.post("/:id/import-voucher-excel", async (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsedBody = importVoucherExcelBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const fn = parsedBody.data.filename.toLowerCase();
  if (!fn.endsWith(".xlsx") && !fn.endsWith(".xlsm") && !fn.endsWith(".xls")) {
    res.status(400).json({ success: false, error: "filename must end in .xlsx, .xlsm, or .xls" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  if (row.formType !== "voucher") {
    res.status(400).json({ success: false, error: "Excel import is only supported for voucher submissions." });
    return;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  let buffer;
  try {
    buffer = Buffer.from(parsedBody.data.base64Data, "base64");
  } catch {
    res.status(400).json({ success: false, error: "Invalid base64 data" });
    return;
  }
  if (!buffer.length) {
    res.status(400).json({ success: false, error: "Empty file" });
    return;
  }
  const maxBytes = 100 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).json({ success: false, error: "File too large (max 100MB)" });
    return;
  }
  try {
    const parsed = parseLeeVoucherExcelBuffer(buffer);
    const patch = submissionPayloadPatchFromParsedVoucher(parsed);
    const prevImport = patch.excelImport && typeof patch.excelImport === "object" ? patch.excelImport : {};
    patch.excelImport = { ...prevImport, filename: parsedBody.data.filename };
    const nextPayload = { ...payload, ...patch };
    await db.update(submissions).set({
      payload: JSON.stringify(nextPayload),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq10(submissions.id, id));
    res.json({
      success: true,
      data: {
        dealName: parsed.dealName,
        address: parsed.address,
        city: parsed.city,
        zip: parsed.zip,
        transactionType: parsed.transactionType,
        representationType: parsed.representationType,
        feePercent: patch.feePercent ?? null,
        rentRowCount: Array.isArray(parsed.rentRows) ? parsed.rentRows.length : 0,
        brokerCount: Array.isArray(parsed.brokers) ? parsed.brokers.length : 0
      }
    });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    res.status(400).json({ success: false, error: msg });
  }
});
submissionsApiRouter.post("/:id/import-listing-pdf", async (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsedBody = importListingPdfBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ success: false, error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const filename = parsedBody.data.filename.toLowerCase();
  if (!filename.endsWith(".pdf")) {
    res.status(400).json({ success: false, error: "filename must end in .pdf" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  if (row.formType !== "listing") {
    res.status(400).json({ success: false, error: "Listing PDF import is only supported for listing submissions." });
    return;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  let buffer;
  try {
    buffer = Buffer.from(parsedBody.data.base64Data, "base64");
  } catch {
    res.status(400).json({ success: false, error: "Invalid base64 data" });
    return;
  }
  if (!buffer.length) {
    res.status(400).json({ success: false, error: "Empty file" });
    return;
  }
  const maxBytes = 100 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).json({ success: false, error: "File too large (max 100MB)" });
    return;
  }
  try {
    const parsed = await parseListingFormPdfBuffer(buffer);
    if (!parsed.address && !parsed.city && parsed.spaces.length === 0) {
      throw new Error("No filled listing input form fields were found in this PDF.");
    }
    const patch = listingFormPatchFromParsed(parsed);
    const prevImport = patch.listingFormImport && typeof patch.listingFormImport === "object" ? patch.listingFormImport : {};
    patch.listingFormImport = { ...prevImport, filename: parsedBody.data.filename };
    const nextPayload = { ...payload, ...patch };
    await db.update(submissions).set({
      payload: JSON.stringify(nextPayload),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq10(submissions.id, id));
    res.json({
      success: true,
      data: {
        listingName: parsed.listingName,
        address: parsed.address,
        city: parsed.city,
        zip: parsed.zip,
        propertyType: parsed.propertyType,
        transactionType: parsed.transactionType,
        spaceCount: parsed.spaces.length,
        totalBldgSF: parsed.totalBldgSF,
        sqft: parsed.sqft
      }
    });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    res.status(400).json({ success: false, error: msg });
  }
});
submissionsApiRouter.put("/:id", async (req, res) => {
  const user = req.user;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  const nextStatus = parsed.data.status;
  if (nextStatus !== void 0 && !isAdmin) {
    res.status(403).json({ success: false, error: "Only admins can change status" });
    return;
  }
  await db.update(submissions).set({
    status: nextStatus ?? row.status,
    reference: parsed.data.reference ?? row.reference,
    payload: parsed.data.payload !== void 0 ? JSON.stringify(parsed.data.payload) : row.payload,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq10(submissions.id, id));
  res.json({ success: true });
});
submissionsApiRouter.delete("/:id", async (req, res) => {
  const user = req.user;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }
  const rows = await db.select().from(submissions).where(eq10(submissions.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  const isAdmin = user.role === "admin";
  if (!isAdmin && row.submittedByOpenId !== user.openId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  await db.delete(submissions).where(eq10(submissions.id, id));
  res.json({ success: true });
});

// server/brokerAdminApi.ts
init_db();
init_schema();
import { Router as Router4 } from "express";
import { z as z12 } from "zod/v4";
import { desc as desc6, eq as eq11, sql as sql5 } from "drizzle-orm";

// server/middleware/requireAuth.ts
var requireAuth = async (req, res, next) => {
  const user = await resolvePlatformUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = user;
  next();
};
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (user.role === "admin") {
      next();
      return;
    }
    if (allowedRoles.includes(user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}

// server/brokerAdminApi.ts
var brokerAdminApiRouter = Router4();
brokerAdminApiRouter.use(requireAuth, requireRole("admin"));
brokerAdminApiRouter.get("/requests", async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const status = String(req.query.status ?? "").trim();
  const owner = String(req.query.owner ?? "").trim();
  const q = String(req.query.q ?? "").trim().toLowerCase();
  let rows = await db.select().from(brokerAdminRequests).orderBy(desc6(brokerAdminRequests.createdAt)).limit(limit);
  if (status) rows = rows.filter((r) => r.status === status);
  if (owner) rows = rows.filter((r) => (r.owner ?? "") === owner);
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.title ?? ""} ${r.fromEmail ?? ""} ${r.reference ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  res.json({
    success: true,
    data: rows
  });
});
brokerAdminApiRouter.get("/stats", async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });
  const staleDays = Math.max(0, parseInt(String(req.query.staleDays ?? "3"), 10) || 3);
  const staleMs = staleDays * 24 * 60 * 60 * 1e3;
  const staleBefore = new Date(Date.now() - staleMs);
  const counts = await db.select({
    status: brokerAdminRequests.status,
    count: sql5`count(*)`
  }).from(brokerAdminRequests).groupBy(brokerAdminRequests.status);
  const stale = await db.select({
    id: brokerAdminRequests.id,
    title: brokerAdminRequests.title,
    status: brokerAdminRequests.status,
    owner: brokerAdminRequests.owner,
    createdAt: brokerAdminRequests.createdAt
  }).from(brokerAdminRequests).where(sql5`${brokerAdminRequests.updatedAt} < ${staleBefore}`).orderBy(desc6(brokerAdminRequests.updatedAt)).limit(50);
  res.json({
    success: true,
    data: {
      counts,
      staleDays,
      staleCount: stale.length,
      stale
    }
  });
});
brokerAdminApiRouter.get("/requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });
  const rows = await db.select().from(brokerAdminRequests).where(eq11(brokerAdminRequests.id, id)).limit(1);
  const row = rows[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  const files = await db.select().from(uploads).where(eq11(uploads.reference, `brokerAdminRequest:${id}`)).orderBy(desc6(uploads.createdAt)).limit(500);
  res.json({ success: true, data: { request: row, attachments: files } });
});
var updateSchema2 = z12.object({
  title: z12.string().trim().max(512).optional(),
  status: z12.string().trim().max(32).optional(),
  owner: z12.string().trim().max(64).optional().nullable(),
  category: z12.string().trim().max(64).optional().nullable(),
  confidential: z12.boolean().optional(),
  systemImpact: z12.array(z12.string()).optional(),
  dueDate: z12.string().optional().nullable(),
  priority: z12.string().trim().max(16).optional().nullable(),
  dealiusDealId: z12.string().trim().max(64).optional().nullable(),
  dealiusListingId: z12.string().trim().max(64).optional().nullable(),
  docusignEnvelopeId: z12.string().trim().max(128).optional().nullable(),
  reference: z12.string().trim().max(512).optional().nullable(),
  notes: z12.string().trim().max(5e4).optional().nullable()
});
brokerAdminApiRouter.put("/requests/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: "Invalid id" });
    return;
  }
  const parsed = updateSchema2.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const db = await getDb();
  if (!db) return res.status(503).json({ success: false, error: "Database unavailable" });
  const patch = {};
  const v = parsed.data;
  if (v.title !== void 0) patch.title = v.title;
  if (v.status !== void 0) patch.status = v.status;
  if (v.owner !== void 0) patch.owner = v.owner;
  if (v.category !== void 0) patch.category = v.category;
  if (v.confidential !== void 0) patch.confidential = v.confidential ? 1 : 0;
  if (v.systemImpact !== void 0) patch.systemImpact = JSON.stringify(v.systemImpact);
  if (v.dueDate !== void 0) patch.dueDate = v.dueDate ? new Date(v.dueDate) : null;
  if (v.priority !== void 0) patch.priority = v.priority;
  if (v.dealiusDealId !== void 0) patch.dealiusDealId = v.dealiusDealId;
  if (v.dealiusListingId !== void 0) patch.dealiusListingId = v.dealiusListingId;
  if (v.docusignEnvelopeId !== void 0) patch.docusignEnvelopeId = v.docusignEnvelopeId;
  if (v.reference !== void 0) patch.reference = v.reference;
  if (v.notes !== void 0) patch.notes = v.notes;
  await db.update(brokerAdminRequests).set({ ...patch, updatedAt: /* @__PURE__ */ new Date() }).where(eq11(brokerAdminRequests.id, id));
  res.json({ success: true });
});

// server/mapsApi.ts
import { Router as Router5 } from "express";
import { URL as URL2 } from "url";
var mapsApiRouter = Router5();
function requireMapsKey(res) {
  const key = ENV.googleMapsApiKey?.trim();
  if (!key) {
    res.status(503).json({
      success: false,
      error: "Google Maps is not configured (set GOOGLE_MAPS_API_KEY)."
    });
    return null;
  }
  return key;
}
async function proxyGoogleMapsAsset(req, res, endpoint) {
  const key = requireMapsKey(res);
  if (!key) return;
  const url = new URL2(`https://maps.googleapis.com${endpoint}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(req.query)) {
    if (k.toLowerCase() === "key") continue;
    if (v === void 0 || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(k, String(item)));
    } else {
      url.searchParams.append(k, String(v));
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal
    });
    if (!upstream.ok) {
      const text2 = await upstream.text().catch(() => "");
      res.status(upstream.status).json({
        success: false,
        error: `Google Maps request failed (${upstream.status})`,
        details: text2.slice(0, 2e3)
      });
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } finally {
    clearTimeout(timeout);
  }
}
mapsApiRouter.get("/maps/api/streetview", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/streetview");
});
mapsApiRouter.get("/maps/maps/api/streetview", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/streetview");
});
mapsApiRouter.get("/maps/api/staticmap", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/staticmap");
});
mapsApiRouter.get("/maps/maps/api/staticmap", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/staticmap");
});

// server/adminUsersApi.ts
init_db();
import { Router as Router6 } from "express";

// server/adminUsers/requirePlatformAdmin.ts
var requirePlatformAdmin = async (req, res, next) => {
  const user = await resolvePlatformUserFromRequest(req);
  if (!user) {
    sendAdminError(res, 401, "UNAUTHORIZED", "Authentication required.");
    return;
  }
  if (user.role !== "admin") {
    sendAdminError(res, 403, "FORBIDDEN", "Administrator access is required for this resource.");
    return;
  }
  req.user = user;
  next();
};

// server/adminUsers/schemas.ts
import { z as z13 } from "zod/v4";
var usernameRegex = /^[a-z][a-z0-9_-]{1,30}$/;
var platformRoleSchema = z13.enum(["admin", "broker", "readonly"]);
var listUsersSortSchema = z13.enum(["name_asc", "recent", "last_login"]);
var listUsersQuerySchema = z13.object({
  search: z13.string().optional(),
  role: platformRoleSchema.optional(),
  is_active: z13.enum(["true", "false"]).optional(),
  sort: listUsersSortSchema.optional().default("recent"),
  page: z13.coerce.number().int().positive().default(1),
  page_size: z13.coerce.number().int().positive().max(100).default(25)
});
var createUserBodySchema = z13.object({
  email: z13.string().trim().email().max(320),
  username: z13.string().trim().regex(usernameRegex, "Invalid username format."),
  full_name: z13.string().trim().min(1).max(255),
  role: platformRoleSchema,
  office: z13.string().trim().max(255).nullable().optional(),
  phone: z13.string().trim().max(64).nullable().optional(),
  send_invite: z13.boolean().optional().default(false)
});
var patchUserBodySchema = z13.object({
  email: z13.string().trim().email().max(320).optional(),
  username: z13.string().trim().regex(usernameRegex, "Invalid username format.").optional(),
  full_name: z13.string().trim().min(1).max(255).optional(),
  role: platformRoleSchema.optional(),
  office: z13.union([z13.string().trim().max(255), z13.null()]).optional(),
  phone: z13.union([z13.string().trim().max(64), z13.null()]).optional(),
  is_active: z13.boolean().optional()
}).refine((obj) => Object.keys(obj).length > 0, { message: "At least one field is required." });
var uuidParamSchema = z13.string().uuid();

// server/adminUsers/inviteMail.ts
import nodemailer2 from "nodemailer";
function isAdminInviteSmtpConfigured() {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}
async function sendUserInviteEmail(params) {
  if (!isAdminInviteSmtpConfigured()) {
    return { ok: false, error: "SMTP is not configured." };
  }
  const companyName = String(await getSetting("branding.company_name"));
  const subject = `Your ${companyName} Broker Tool account`;
  const text2 = [
    `An administrator created an account for you on the ${companyName} Broker Tool.`,
    "",
    `Username: ${params.username}`,
    "",
    `Sign in: ${params.loginUrl}`,
    "",
    `\u2014 ${companyName}`
  ].join("\n");
  try {
    const transporter = nodemailer2.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      requireTLS: !ENV.smtpSecure,
      auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : void 0
    });
    await transporter.sendMail({
      from: ENV.smtpFrom,
      to: params.to,
      subject,
      text: text2
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// server/adminUsers/userService.ts
init_schema();
import { hash } from "bcryptjs";
import { and as and4, asc, count, desc as desc7, eq as eq12, ne as ne2, or as or4, like as like2, sql as sql6 } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

// server/adminUsers/guards.ts
function lastActiveAdminBlocked(target, patch, activeAdminCount) {
  if (target.role !== "admin" || !target.isActive) return null;
  const demoted = patch.role !== void 0 && patch.role !== "admin";
  const deactivated = patch.is_active === false;
  if (!demoted && !deactivated) return null;
  if (activeAdminCount <= 1) {
    return "This change would remove the last active administrator. Assign another admin first.";
  }
  return null;
}
function selfRoleOrDeactivationBlocked(actorId, targetId, patch) {
  if (actorId !== targetId) return null;
  if (patch.role !== void 0 && patch.role !== "admin") {
    return "You cannot change your own role.";
  }
  if (patch.is_active === false) {
    return "You cannot deactivate your own account.";
  }
  return null;
}
function selfDeactivationBlocked(actorId, targetId) {
  if (actorId !== targetId) return null;
  return "You cannot deactivate your own account.";
}

// server/adminUsers/userService.ts
function iso(d) {
  if (!d) return null;
  return d.toISOString();
}
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    full_name: row.fullName,
    role: row.role,
    office: row.office,
    phone: row.phone,
    is_active: row.isActive,
    last_login_at: iso(row.lastLoginAt),
    created_at: iso(row.createdAt),
    created_by_name: row.createdByName,
    ...row.forcePasswordChangeNextLogin !== void 0 ? { force_password_change_next_login: row.forcePasswordChangeNextLogin } : {}
  };
}
function likePattern(search) {
  const t2 = search.trim().toLowerCase().replace(/[%_\\]/g, "");
  if (!t2) return null;
  return `%${t2}%`;
}
async function listUsers(db, query) {
  const creator = alias(appUsers, "creator");
  const page = query.page;
  const pageSize = query.page_size;
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const pat = query.search ? likePattern(query.search) : null;
  if (pat) {
    conditions.push(
      or4(like2(appUsers.username, pat), like2(appUsers.email, pat), like2(appUsers.fullName, pat))
    );
  }
  if (query.role) {
    conditions.push(eq12(appUsers.role, query.role));
  }
  if (query.is_active !== void 0) {
    conditions.push(eq12(appUsers.isActive, query.is_active === "true"));
  }
  const whereClause = conditions.length ? and4(...conditions) : void 0;
  const totalRow = await db.select({ c: count() }).from(appUsers).where(whereClause);
  const total = Number(totalRow[0]?.c ?? 0);
  const activeAdminsRow = await db.select({ c: count() }).from(appUsers).where(and4(eq12(appUsers.role, "admin"), eq12(appUsers.isActive, true)));
  const active_admin_count = Number(activeAdminsRow[0]?.c ?? 0);
  const orderBy = query.sort === "name_asc" ? [asc(appUsers.fullName), asc(appUsers.email)] : query.sort === "last_login" ? [asc(sql6`(${appUsers.lastLoginAt} IS NULL)`), desc7(appUsers.lastLoginAt)] : [desc7(appUsers.createdAt)];
  const rows = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdByName: creator.fullName
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(whereClause).orderBy(...orderBy).limit(pageSize).offset(offset);
  return {
    users: rows.map((r) => publicUser(r)),
    total,
    page,
    page_size: pageSize,
    active_admin_count
  };
}
async function getUserDetail(db, id) {
  const creator = alias(appUsers, "creator");
  const rows = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdBy: appUsers.createdBy,
    createdByName: creator.fullName,
    deactivatedAt: appUsers.deactivatedAt,
    forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(eq12(appUsers.id, id)).limit(1);
  const u = rows[0];
  if (!u) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  const audits = await db.select({
    id: auditLog.id,
    user_id: auditLog.userId,
    action: auditLog.action,
    target_type: auditLog.targetType,
    target_id: auditLog.targetId,
    metadata: auditLog.metadata,
    ip_address: auditLog.ipAddress,
    created_at: auditLog.createdAt
  }).from(auditLog).where(and4(eq12(auditLog.targetType, "user"), eq12(auditLog.targetId, id))).orderBy(desc7(auditLog.createdAt)).limit(20);
  const base = publicUser({
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    office: u.office,
    phone: u.phone,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    createdByName: u.createdByName,
    forcePasswordChangeNextLogin: u.forcePasswordChangeNextLogin
  });
  return {
    user: {
      ...base,
      created_by: u.createdBy,
      deactivated_at: iso(u.deactivatedAt)
    },
    audit_log: audits.map((a) => ({
      ...a,
      created_at: iso(a.created_at)
    }))
  };
}
async function countActiveAdmins(db) {
  const [r] = await db.select({ c: count() }).from(appUsers).where(and4(eq12(appUsers.role, "admin"), eq12(appUsers.isActive, true)));
  return Number(r?.c ?? 0);
}
async function createUser(db, body, actor, loginBaseUrl2, req) {
  const email = body.email.trim().toLowerCase();
  const username = body.username.trim().toLowerCase();
  const dupEmail = await db.select({ id: appUsers.id }).from(appUsers).where(eq12(appUsers.email, email)).limit(1);
  if (dupEmail.length) {
    throw new AdminUserError(409, "DUPLICATE_EMAIL", "That email is already registered.", "email");
  }
  const dupUser = await db.select({ id: appUsers.id }).from(appUsers).where(eq12(appUsers.username, username)).limit(1);
  if (dupUser.length) {
    throw new AdminUserError(409, "DUPLICATE_USERNAME", "That username is already taken.", "username");
  }
  const passwordHash = await hash(crypto.randomUUID(), 10);
  const id = crypto.randomUUID();
  try {
    await db.insert(appUsers).values({
      id,
      email,
      username,
      fullName: body.full_name.trim(),
      role: body.role,
      office: body.office?.trim() || null,
      phone: body.phone?.trim() || null,
      passwordHash,
      forcePasswordChangeNextLogin: false,
      isActive: true,
      createdBy: actor.id
    });
  } catch (e) {
    const errno = e?.errno;
    if (errno === 1062) {
      throw new AdminUserError(409, "DUPLICATE", "Email or username already exists.");
    }
    throw e;
  }
  let emailSent = false;
  let note;
  if (body.send_invite && isAdminInviteSmtpConfigured()) {
    const r = await sendUserInviteEmail({
      to: email,
      username,
      loginUrl: `${loginBaseUrl2.replace(/\/$/, "")}/login`
    });
    emailSent = r.ok;
    if (!r.ok) note = r.error;
  } else if (body.send_invite && !isAdminInviteSmtpConfigured()) {
    note = "Email not configured \u2014 you can inform the user to login with their email.";
  }
  await writeAuditLog(
    actor.id,
    "user.created",
    "user",
    id,
    { role: body.role, created_by_name: actor.fullName },
    req
  );
  const creator = alias(appUsers, "creator");
  const [withCreator] = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdByName: creator.fullName,
    forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(eq12(appUsers.id, id)).limit(1);
  if (!withCreator) {
    throw new AdminUserError(500, "CREATE_FAILED", "User was created but could not be reloaded.");
  }
  return {
    user: publicUser(withCreator),
    email_sent: emailSent,
    note
  };
}
async function patchUser(db, id, body, actor, req) {
  const [current] = await db.select().from(appUsers).where(eq12(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  const patch = {};
  if (body.role !== void 0) patch.role = body.role;
  if (body.is_active !== void 0) patch.is_active = body.is_active;
  const selfBlock = selfRoleOrDeactivationBlocked(actor.id, id, patch);
  if (selfBlock) {
    const field = body.is_active !== void 0 ? "is_active" : body.role !== void 0 ? "role" : void 0;
    throw new AdminUserError(400, "SELF_UPDATE_FORBIDDEN", selfBlock, field);
  }
  const admins = await countActiveAdmins(db);
  const lastBlock = lastActiveAdminBlocked(current, patch, admins);
  if (lastBlock) {
    throw new AdminUserError(400, "LAST_ADMIN", lastBlock);
  }
  if (body.email !== void 0) {
    const em = body.email.trim().toLowerCase();
    const clash = await db.select({ id: appUsers.id }).from(appUsers).where(and4(eq12(appUsers.email, em), ne2(appUsers.id, id))).limit(1);
    if (clash.length) {
      throw new AdminUserError(409, "DUPLICATE_EMAIL", "That email is already registered.", "email");
    }
  }
  if (body.username !== void 0) {
    const un = body.username.trim().toLowerCase();
    const clash = await db.select({ id: appUsers.id }).from(appUsers).where(and4(eq12(appUsers.username, un), ne2(appUsers.id, id))).limit(1);
    if (clash.length) {
      throw new AdminUserError(409, "DUPLICATE_USERNAME", "That username is already taken.", "username");
    }
  }
  const set = {};
  if (body.email !== void 0) set.email = body.email.trim().toLowerCase();
  if (body.username !== void 0) set.username = body.username.trim().toLowerCase();
  if (body.full_name !== void 0) set.fullName = body.full_name.trim();
  if (body.role !== void 0) set.role = body.role;
  if (body.office !== void 0) set.office = body.office === null ? null : body.office.trim() || null;
  if (body.phone !== void 0) set.phone = body.phone === null ? null : body.phone.trim() || null;
  if (body.is_active !== void 0) {
    set.isActive = body.is_active;
    if (body.is_active) {
      set.deactivatedAt = null;
    } else {
      set.deactivatedAt = /* @__PURE__ */ new Date();
    }
  }
  if (Object.keys(set).length === 0) {
    throw new AdminUserError(400, "NO_CHANGES", "No valid changes supplied.");
  }
  const before = {
    email: current.email,
    username: current.username,
    full_name: current.fullName,
    role: current.role,
    office: current.office,
    phone: current.phone,
    is_active: current.isActive
  };
  try {
    await db.update(appUsers).set(set).where(eq12(appUsers.id, id));
  } catch (e) {
    const errno = e?.errno;
    if (errno === 1062) {
      throw new AdminUserError(409, "DUPLICATE", "Email or username already exists.");
    }
    throw e;
  }
  const [updated] = await db.select().from(appUsers).where(eq12(appUsers.id, id)).limit(1);
  const after = {
    email: updated.email,
    username: updated.username,
    full_name: updated.fullName,
    role: updated.role,
    office: updated.office,
    phone: updated.phone,
    is_active: updated.isActive
  };
  let action = "user.updated";
  if (body.is_active === false && current.isActive) action = "user.deactivated";
  else if (body.role !== void 0 && body.role !== current.role) action = "user.role_changed";
  await writeAuditLog(actor.id, action, "user", id, { before, after }, req);
  const creator = alias(appUsers, "creator");
  const [withCreator] = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdByName: creator.fullName,
    forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(eq12(appUsers.id, id)).limit(1);
  return publicUser(withCreator);
}
async function softDeleteUser(db, id, actor, req) {
  if (actor.id === id) {
    throw new AdminUserError(400, "SELF_UPDATE_FORBIDDEN", selfDeactivationBlocked(actor.id, id));
  }
  const [current] = await db.select().from(appUsers).where(eq12(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  if (!current.isActive) {
    throw new AdminUserError(400, "ALREADY_INACTIVE", "User is already deactivated.");
  }
  const admins = await countActiveAdmins(db);
  const lastBlock = lastActiveAdminBlocked(current, { is_active: false }, admins);
  if (lastBlock) {
    throw new AdminUserError(400, "LAST_ADMIN", lastBlock);
  }
  await db.update(appUsers).set({ isActive: false, deactivatedAt: /* @__PURE__ */ new Date() }).where(eq12(appUsers.id, id));
  await writeAuditLog(actor.id, "user.deactivated", "user", id, {}, req);
  const creator = alias(appUsers, "creator");
  const [withCreator] = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdByName: creator.fullName,
    forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
    deactivatedAt: appUsers.deactivatedAt
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(eq12(appUsers.id, id)).limit(1);
  return {
    ...publicUser(withCreator),
    deactivated_at: iso(withCreator.deactivatedAt)
  };
}
async function reactivateUser(db, id, actor, req) {
  const [current] = await db.select().from(appUsers).where(eq12(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  if (current.isActive) {
    throw new AdminUserError(400, "ALREADY_ACTIVE", "User is already active.");
  }
  await db.update(appUsers).set({ isActive: true, deactivatedAt: null }).where(eq12(appUsers.id, id));
  await writeAuditLog(actor.id, "user.reactivated", "user", id, {}, req);
  const creator = alias(appUsers, "creator");
  const [withCreator] = await db.select({
    id: appUsers.id,
    email: appUsers.email,
    username: appUsers.username,
    fullName: appUsers.fullName,
    role: appUsers.role,
    office: appUsers.office,
    phone: appUsers.phone,
    isActive: appUsers.isActive,
    lastLoginAt: appUsers.lastLoginAt,
    createdAt: appUsers.createdAt,
    createdByName: creator.fullName,
    forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin
  }).from(appUsers).leftJoin(creator, eq12(appUsers.createdBy, creator.id)).where(eq12(appUsers.id, id)).limit(1);
  return publicUser(withCreator);
}

// server/adminUsersApi.ts
var adminUsersRouter = Router6();
adminUsersRouter.use(requirePlatformAdmin);
function loginBaseUrl(req) {
  const fromEnv = (process.env.PUBLIC_APP_URL ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host") ?? "localhost"}`;
}
function asyncAdmin(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch((err2) => {
      if (err2 instanceof AdminUserError) {
        sendAdminUserError(res, err2);
        return;
      }
      next(err2);
    });
  };
}
adminUsersRouter.get(
  "/config",
  asyncAdmin(async (_req, res) => {
    res.json({ invite_email_configured: isAdminInviteSmtpConfigured() });
  })
);
adminUsersRouter.get(
  "/",
  asyncAdmin(async (req, res) => {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid query parameters.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const data = await listUsers(db, parsed.data);
    res.json(data);
  })
);
adminUsersRouter.post(
  "/",
  asyncAdmin(async (req, res) => {
    const parsed = createUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid request body.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const out = await createUser(db, parsed.data, req.user, loginBaseUrl(req), req);
    res.status(201).json(out);
  })
);
adminUsersRouter.get(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const data = await getUserDetail(db, idParsed.data);
    res.json(data);
  })
);
adminUsersRouter.patch(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const parsed = patchUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid request body.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await patchUser(db, idParsed.data, parsed.data, req.user, req);
    res.json(user);
  })
);
adminUsersRouter.delete(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await softDeleteUser(db, idParsed.data, req.user, req);
    res.json(user);
  })
);
adminUsersRouter.post(
  "/:id/reactivate",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await reactivateUser(db, idParsed.data, req.user, req);
    res.json(user);
  })
);

// server/adminSettingsApi.ts
init_db();
import { Router as Router7 } from "express";
import { z as z14 } from "zod/v4";
import { count as count2 } from "drizzle-orm";
init_schema();
var categorySchema = z14.enum(["branding", "workflow", "notifications", "integrations", "security"]);
var adminSettingsRouter = Router7();
adminSettingsRouter.use(requirePlatformAdmin);
function asyncAdmin2(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch((err2) => {
      if (err2 instanceof AdminUserError) {
        sendAdminUserError(res, err2);
        return;
      }
      next(err2);
    });
  };
}
adminSettingsRouter.get(
  "/",
  asyncAdmin2(async (_req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    res.json(await getGroupedSettings(true));
  })
);
adminSettingsRouter.get(
  "/meta",
  asyncAdmin2(async (_req, res) => {
    res.json({ invite_email_configured: isAdminInviteSmtpConfigured() });
  })
);
adminSettingsRouter.post(
  "/actions/revoke-all-sessions",
  asyncAdmin2(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const [row] = await db.select({ c: count2() }).from(appSessions);
    const cleared = Number(row?.c ?? 0);
    await db.delete(appSessions);
    await writeAuditLog(req.user.id, "sessions.revoked_all", "system", null, { sessions_cleared: cleared }, req);
    res.json({ cleared });
  })
);
var dealiusVerifyBodySchema = z14.object({
  username: z14.string().trim().min(1).max(320),
  password: z14.string().min(1).max(512)
});
adminSettingsRouter.post(
  "/integrations/dealius/verify",
  asyncAdmin2(async (req, res) => {
    const parsed = dealiusVerifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(res, 400, "VALIDATION_ERROR", issue?.message ?? "Invalid body.", issue?.path?.join("."));
      return;
    }
    const result = await verifyDealiusCredentials(parsed.data.username, parsed.data.password);
    res.json(result);
  })
);
adminSettingsRouter.post(
  "/integrations/dealius/test",
  asyncAdmin2(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const result = await runDealiusSettingsTest(db, req.user.id, req);
    res.json(result);
  })
);
adminSettingsRouter.get(
  "/:category",
  asyncAdmin2(async (req, res) => {
    const parsed = categorySchema.safeParse(req.params.category);
    if (!parsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid category.", "category");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    res.json(await getGroupedCategory(parsed.data, true));
  })
);
adminSettingsRouter.patch(
  "/",
  asyncAdmin2(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Body must be a flat object of setting keys to values.");
      return;
    }
    const out = await patchSettings(db, req.body, req.user.id, req);
    res.json(out);
  })
);

// server/publicSettingsApi.ts
import { Router as Router8 } from "express";
var publicSettingsRouter = Router8();
publicSettingsRouter.get("/public", async (_req, res) => {
  try {
    res.json(await getPublicToolSettings());
  } catch (error) {
    console.error("[public settings]", error);
    res.status(500).json({ error: { code: "SETTINGS_ERROR", message: "Could not load public settings." } });
  }
});

// server/adminAuditLogApi.ts
init_schema();
init_db();
import { Router as Router9 } from "express";
import { and as and5, desc as desc8, eq as eq13, gte as gte2, lte as lte2, or as or5, sql as sql7 } from "drizzle-orm";
var adminAuditLogRouter = Router9();
adminAuditLogRouter.use(requirePlatformAdmin);
var PAGE_SIZE = 50;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function stripLikeWildcards(s) {
  return s.replace(/[%_\\]/g, "").trim().slice(0, 200);
}
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
adminAuditLogRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: { code: "DB_UNAVAILABLE", message: "Database unavailable." } });
      return;
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;
    const userQ = String(req.query.user ?? "").trim();
    const actionQ = String(req.query.action ?? "").trim();
    const targetQ = String(req.query.target ?? "").trim();
    const fromRaw = String(req.query.from ?? "").trim();
    const toRaw = String(req.query.to ?? "").trim();
    const parts = [];
    if (actionQ) {
      const s = stripLikeWildcards(actionQ);
      if (s.length) {
        parts.push(sql7`lower(${auditLog.action}) like lower(${"%" + s.toLowerCase() + "%"})`);
      }
    }
    if (targetQ) {
      const s = stripLikeWildcards(targetQ);
      if (s.length) {
        const pat = "%" + s.toLowerCase() + "%";
        parts.push(
          or5(
            sql7`lower(${auditLog.targetType}) like lower(${pat})`,
            sql7`lower(${auditLog.targetId}) like lower(${pat})`
          )
        );
      }
    }
    if (fromRaw) {
      const d = new Date(fromRaw);
      if (!Number.isNaN(d.getTime())) {
        parts.push(gte2(auditLog.createdAt, d));
      }
    }
    if (toRaw) {
      const d = new Date(toRaw);
      if (!Number.isNaN(d.getTime())) {
        const end = new Date(d);
        end.setUTCHours(23, 59, 59, 999);
        parts.push(lte2(auditLog.createdAt, end));
      }
    }
    if (userQ) {
      const s = stripLikeWildcards(userQ);
      const idMatch = UUID_RE.test(userQ) ? eq13(auditLog.userId, userQ) : void 0;
      if (s.length) {
        const pat = "%" + s.toLowerCase() + "%";
        const emailMatch = sql7`lower(${appUsers.email}) like lower(${pat})`;
        const nameMatch = sql7`lower(${appUsers.fullName}) like lower(${pat})`;
        parts.push(idMatch ? or5(emailMatch, nameMatch, idMatch) : or5(emailMatch, nameMatch));
      } else if (idMatch) {
        parts.push(idMatch);
      }
    }
    const whereClause = parts.length ? and5(...parts) : void 0;
    const countRows = await db.select({ c: sql7`count(*)` }).from(auditLog).leftJoin(appUsers, eq13(appUsers.id, auditLog.userId)).where(whereClause);
    const total = Number(countRows[0]?.c ?? 0);
    const rows = await db.select({
      id: auditLog.id,
      userId: auditLog.userId,
      userEmail: appUsers.email,
      userFullName: appUsers.fullName,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      ipAddress: auditLog.ipAddress,
      createdAt: auditLog.createdAt
    }).from(auditLog).leftJoin(appUsers, eq13(appUsers.id, auditLog.userId)).where(whereClause).orderBy(desc8(auditLog.createdAt)).limit(PAGE_SIZE).offset(offset);
    res.json({
      page,
      page_size: PAGE_SIZE,
      total,
      rows
    });
  })
);

// server/dealiusAdminApi.ts
import { Router as Router10 } from "express";
import { z as z15 } from "zod/v4";
import { nanoid as nanoid6 } from "nanoid";
init_db();
init_schema();

// server/services/pdfTextScrape.ts
function str4(raw) {
  return String(raw ?? "").trim();
}
function num4(raw) {
  const value = str4(raw);
  if (!value) return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}
async function extractPdfPlainText(buffer, maxChars = 8e4) {
  const { PDFParse: PDFParse2 } = await import("pdf-parse");
  const parser = new PDFParse2({ data: buffer });
  try {
    const textResult = await parser.getText();
    const text2 = str4(textResult.text).replace(/\s+/g, " ");
    return text2.slice(0, maxChars);
  } finally {
    await parser.destroy?.();
  }
}
function heuristicsFromPdfText(text2) {
  const patch = {};
  const upper = text2.toUpperCase();
  const csz = text2.match(
    /([0-9]{1,5}\s+[^,\n]{3,80}?)\s*,\s*([A-Za-z][A-Za-z\s]{2,40}?)\s*,\s*(CA|California)\s+(\d{5}(?:-\d{4})?)/i
  ) || text2.match(
    /([0-9]{1,5}\s+[^,\n]{3,80}?)\s*,\s*([A-Za-z][A-Za-z\s]{2,40}?)\s+(CA|California)\s+(\d{5}(?:-\d{4})?)/i
  );
  if (csz) {
    patch.address = csz[1].replace(/\s+/g, " ").trim();
    patch.city = csz[2].replace(/\s+/g, " ").trim();
    patch.zip = csz[4].replace(/\D/g, "").slice(0, 5);
  } else {
    const cityStateZip = text2.match(
      /\b([A-Za-z][A-Za-z\s]{2,40}?)\s*,\s*(CA|California)\s+(\d{5}(?:-\d{4})?)\b/i
    );
    if (cityStateZip) {
      patch.city = cityStateZip[1].replace(/\s+/g, " ").trim();
      patch.zip = cityStateZip[3].replace(/\D/g, "").slice(0, 5);
    }
    const street = text2.match(
      /\b(\d{1,5}\s+[NSEW]?\s*[A-Za-z0-9.\s]{3,60}?(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Road|Rd\.?|Way|Lane|Ln\.?|Court|Ct\.?))\b/i
    );
    if (street && !patch.address) patch.address = street[1].replace(/\s+/g, " ").trim();
  }
  const feeMatch = text2.match(/(?:commission|broker(?:'|’)?s? fee)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (feeMatch) {
    const pct = num4(feeMatch[1]);
    if (pct != null && pct > 0) {
      patch.feePercent = pct <= 1 ? pct * 100 : pct;
      patch.commissionRate = String(patch.feePercent);
    }
  }
  const lessor = text2.match(/(?:lessor|sublessor|landlord)\s*[:#]?\s*([^\n]{3,120}?)(?=\s{2,}|\s+lessee|\s+tenant|$)/i);
  const lessee = text2.match(/(?:lessee|tenant)\s*[:#]?\s*([^\n]{3,120}?)(?=\s{2,}|\s+lessor|\s+landlord|$)/i);
  if (lessor) patch.lessorName = lessor[1].replace(/\s+/g, " ").trim();
  if (lessee) patch.lesseeName = lessee[1].replace(/\s+/g, " ").trim();
  if (patch.lessorName || patch.lesseeName) {
    patch.clientCo = str4(patch.lessorName);
    patch.oppositeCo = str4(patch.lesseeName);
  }
  const start = text2.match(/(?:commencement|start)\s*date\s*[:#]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  const end = text2.match(/(?:expiration|expiry|end)\s*date\s*[:#]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (start) patch.startDate = start[1];
  if (end) patch.endDate = end[1];
  const looksListingDoc = /listing agreement|exclusive agency|exclusive right to (?:lease|sell)|listing brokerage/i.test(text2) || upper.includes("FOR LEASE") && upper.includes("PREMISES");
  return {
    patch,
    hints: { looksListingDoc, textSample: text2.slice(0, 280) }
  };
}
function mergeScrapePatches(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (key.startsWith("_")) {
      out[key] = value;
      continue;
    }
    const current = out[key];
    const empty = current === void 0 || current === null || current === "" || Array.isArray(current) && current.length === 0;
    if (empty && value !== void 0 && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

// server/dealiusAdminApi.ts
function jsonErr(res, status, error, extra) {
  res.status(status).json({ success: false, error, ...extra });
}
function inferMimeType(filename) {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xlsm")) {
    return "application/vnd.ms-excel.sheet.macroEnabled.12";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  return null;
}
var dealiusAdminApiRouter = Router10();
dealiusAdminApiRouter.use(async (req, res, next) => {
  try {
    const user = await resolvePortalRequestUser(req);
    if (!user) {
      jsonErr(res, 401, "Not authenticated");
      return;
    }
    if (user.role !== "admin") {
      jsonErr(res, 403, "Admin access required");
      return;
    }
    req.user = user;
    next();
  } catch {
    jsonErr(res, 401, "Not authenticated");
  }
});
var pushBody = z15.object({
  entryMode: z15.enum(["deal", "listing"]),
  entry: z15.record(z15.string(), z15.unknown())
});
dealiusAdminApiRouter.post("/push", async (req, res) => {
  const parsed = pushBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }
  try {
    const { entryMode, entry } = parsed.data;
    const validation = entryMode === "listing" ? validateListingEntryForDealiusPush(entry) : validateDealEntryForDealiusPush(entry);
    if (!validation.ok) {
      jsonErr(res, 400, validation.errors.join(" "), { errors: validation.errors });
      return;
    }
    const data = entryMode === "listing" ? await pushListingEntryToDealius({ entry }) : await pushDealEntryToDealius({ entry });
    res.json({ success: true, data });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    jsonErr(res, 500, msg);
  }
});
var dealiusDocumentBody2 = z15.object({
  entityType: z15.enum(["deal", "listing"]),
  entityId: z15.union([z15.string(), z15.number()]).transform((v) => String(v).trim()).pipe(z15.string().min(1).max(64)),
  files: z15.array(
    z15.object({
      filename: z15.string().trim().min(1).max(255),
      mimeType: z15.string().trim().min(1).max(128).default("application/octet-stream"),
      base64Data: z15.string().min(1),
      documentType: z15.string().trim().max(128).optional().nullable()
    })
  ).min(1).max(10)
});
dealiusAdminApiRouter.post("/documents", async (req, res) => {
  const user = req.user;
  const parsed = dealiusDocumentBody2.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }
  const { entityType, entityId, files } = parsed.data;
  const maxBytes = 100 * 1024 * 1024;
  const client = new DealiusClient();
  let token;
  try {
    token = await authenticateConfiguredDealius(client);
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    jsonErr(res, 500, msg);
    return;
  }
  const db = await getDb();
  const results = [];
  for (const file of files) {
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    let buffer;
    try {
      buffer = Buffer.from(file.base64Data, "base64");
    } catch {
      results.push({ filename: file.filename, success: false, error: "Invalid base64 data" });
      continue;
    }
    if (!buffer.length) {
      results.push({ filename: file.filename, success: false, error: "Empty file" });
      continue;
    }
    if (buffer.length > maxBytes) {
      results.push({ filename: file.filename, success: false, error: "File too large (max 100MB)" });
      continue;
    }
    const fileKey = `broker-docs/dealius/${entityType}/${entityId}/${nanoid6(10)}-${safeFilename}`;
    const normalizedMimeType = file.mimeType && file.mimeType !== "application/octet-stream" ? file.mimeType : inferMimeType(file.filename) ?? "application/octet-stream";
    const stored = await storagePut(fileKey, buffer, normalizedMimeType);
    if (db) {
      try {
        await db.insert(uploads).values({
          fileKey,
          url: stored.url,
          filename: file.filename,
          mimeType: normalizedMimeType,
          fileSize: buffer.length,
          category: "dealius-document",
          reference: `dealius:${entityType}:${entityId}`,
          uploaderName: user.name ?? "Admin",
          uploaderOpenId: user.openId
        });
      } catch {
      }
    }
    const uploaded = await client.uploadDocument({
      token,
      entityType,
      entityId,
      filename: file.filename,
      mimeType: normalizedMimeType,
      buffer,
      documentType: file.documentType ?? null
    });
    const success = uploaded.status >= 200 && uploaded.status < 300;
    results.push({
      filename: file.filename,
      success,
      status: uploaded.status,
      response: uploaded.text.slice(0, 500),
      fileKey,
      url: stored.url,
      documentType: file.documentType ?? null
    });
  }
  const failed = results.filter((r) => !r.success);
  res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    data: { entityType, entityId, results },
    error: failed.length ? `${failed.length} document(s) failed to attach to Dealius.` : void 0
  });
});
var scrapeBody = z15.object({
  filename: z15.string().trim().min(1).max(255),
  mimeType: z15.string().trim().min(1).max(128).optional(),
  base64Data: z15.string().min(1)
});
dealiusAdminApiRouter.post("/scrape", async (req, res) => {
  const parsed = scrapeBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    jsonErr(res, 400, parsed.error.issues[0]?.message ?? "Invalid body");
    return;
  }
  const maxBytes = 100 * 1024 * 1024;
  const { filename, base64Data } = parsed.data;
  const normalizedMimeType = parsed.data.mimeType && parsed.data.mimeType !== "application/octet-stream" ? parsed.data.mimeType : inferMimeType(filename) ?? "application/octet-stream";
  let buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    jsonErr(res, 400, "Invalid base64 data");
    return;
  }
  if (!buffer.length) {
    jsonErr(res, 400, "Empty file");
    return;
  }
  if (buffer.length > maxBytes) {
    jsonErr(res, 400, "File too large (max 100MB)");
    return;
  }
  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm") || lower.endsWith(".xls")) {
      const parsedVoucher = parseLeeVoucherExcelBuffer(buffer);
      const patch = submissionPayloadPatchFromParsedVoucher(parsedVoucher);
      if (typeof patch.repTypeID === "number") patch.repTypeID = String(patch.repTypeID);
      res.json({
        success: true,
        data: {
          source: "voucher_excel",
          entryMode: "deal",
          mimeType: normalizedMimeType,
          filename,
          patch
        }
      });
      return;
    }
    if (lower.endsWith(".pdf")) {
      const warnings = [];
      let patch = {};
      let source = "listing_pdf_text";
      try {
        const parsedListing = await parseListingFormPdfBuffer(buffer);
        patch = listingFormPatchFromParsed(parsedListing);
        source = "listing_form_pdf";
      } catch {
      }
      let plain = "";
      try {
        plain = await extractPdfPlainText(buffer);
      } catch {
        warnings.push("Could not extract text from PDF.");
      }
      if (plain.length > 50) {
        try {
          const { invokeLLM: invokeLLM2 } = await import("../_core/llm");
          const { getSetting: getSetting2 } = await import("../settings/getSetting");
          const company = String(await getSetting2("branding.company_name").catch(() => "Lee & Associates"));
          const trimmedText = plain.slice(0, 4e4);
          const llmResponse = await invokeLLM2({
            messages: [
              {
                role: "system",
                content: `You are a commercial real estate listing data extraction specialist for ${company}.
Extract structured data from a listing agreement, exclusive right to represent, or property marketing document.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Extract ONLY values you can identify with HIGH CONFIDENCE.
- For "spaces": extract ALL suites/units/spaces mentioned with their individual SF and asking rates.
- Monetary values: numeric strings, no $ or commas. "$1.25/SF/Mo" \u2192 "1.25".
- SF values: numeric strings without commas. "12,500 SF" \u2192 "12500".
- Dates: YYYY-MM-DD format.
- Property type: exactly Industrial, Office, Retail, Land, or Other.
- Transaction type: exactly Lease, Sale, Sublease, or "Sale or Lease".
- Commission: numeric percentage as string. "6%" \u2192 "6".
- Owner/lessor: the property owner or landlord company name ONLY, not random words.
- Address: street address only (no city/state/zip).
- State: two-letter abbreviation.
- Broker names: full name only. If multiple brokers listed, separate with semicolons.`
              },
              {
                role: "user",
                content: `Extract listing data from the document below. Return JSON matching this schema:

{
  "address": "street address only",
  "city": "city name",
  "state": "two-letter state",
  "zip": "5-digit zip",
  "propertyType": "Industrial|Office|Retail|Land|Other",
  "transactionType": "Lease|Sale|Sublease|Sale or Lease",
  "ownerCompany": "property owner / landlord company",
  "lessorName": "lessor if different from owner",
  "totalBldgSF": "total building SF as number string",
  "yearBuilt": "year built",
  "askingRate": "lease rate per SF",
  "askingPrice": "sale price",
  "feePercent": "commission percentage",
  "listingAgentName": "broker name(s), semicolon separated",
  "listingStartDate": "YYYY-MM-DD",
  "listingExpiryDate": "YYYY-MM-DD",
  "listingNotes": "key property features, brief",
  "spaces": [{ "suite": "", "sqft": "", "askingRate": "", "availableDate": "", "comments": "" }]
}

=== EXAMPLE 1: Multi-space lease listing ===
INPUT: "EXCLUSIVE LISTING AGREEMENT ... Owner: Pacific Industrial Partners LLC ... Property: 8400 Central Ave, Rancho Cucamonga, CA 91730 ... Total Building: 45,000 SF ... Year Built: 2005 ... Suite 100 - 12,000 SF - $1.15/SF/Mo NNN - Available Now ... Suite 210 - 8,500 SF - $1.25/SF/Mo NNN - Available 07/01/2026 ... Suite 305 - 6,200 SF - $1.10/SF/Mo NNN ... Commission: 5% of aggregate lease value ... Listing Agent: John Smith, Lee & Associates ... Term: 12 months from 05/01/2026 to 04/30/2027"
OUTPUT:
{"address":"8400 Central Ave","city":"Rancho Cucamonga","state":"CA","zip":"91730","propertyType":"Industrial","transactionType":"Lease","ownerCompany":"Pacific Industrial Partners LLC","totalBldgSF":"45000","yearBuilt":"2005","feePercent":"5","listingAgentName":"John Smith","listingStartDate":"2026-05-01","listingExpiryDate":"2027-04-30","spaces":[{"suite":"100","sqft":"12000","askingRate":"1.15","comments":"NNN"},{"suite":"210","sqft":"8500","askingRate":"1.25","availableDate":"2026-07-01","comments":"NNN"},{"suite":"305","sqft":"6200","askingRate":"1.10","comments":"NNN"}]}

=== EXAMPLE 2: Sale or lease with single space ===
INPUT: "EXCLUSIVE RIGHT TO SELL OR LEASE ... 2200 E Orangewood Ave, Anaheim, CA 92806 ... Owner/Lessor: Westgate Properties Inc and Westgate Holdings ... Industrial warehouse, 22,400 SF on 1.2 acres ... Built 1998 ... Asking: $4,250,000 for sale or $1.35/SF/Mo NNN for lease ... Commission to listing broker: 4% sale / 6% lease ... Listing Brokers: Jane Doe; Mike Johnson ... Agreement dated 03/15/2026, expires 09/15/2026"
OUTPUT:
{"address":"2200 E Orangewood Ave","city":"Anaheim","state":"CA","zip":"92806","propertyType":"Industrial","transactionType":"Sale or Lease","ownerCompany":"Westgate Properties Inc","totalBldgSF":"22400","yearBuilt":"1998","askingRate":"1.35","askingPrice":"4250000","feePercent":"4","listingAgentName":"Jane Doe; Mike Johnson","listingStartDate":"2026-03-15","listingExpiryDate":"2026-09-15","listingNotes":"1.2 acres, NNN lease terms","spaces":[{"suite":"","sqft":"22400","askingRate":"1.35","comments":"NNN"}]}

=== EXAMPLE 3: Owner representation with property details ===
INPUT: "EXCLUSIVE AGENCY LISTING AGREEMENT ... this agreement between Diamond Realty Group (Owner) and Lee & Associates ... property located at 11330 Diamond Back Way, Grass Valley, CA 95945 ... industrial/flex building ... Commission shall be six percent (6%) ... Broker: Taylor Barnes"
OUTPUT:
{"address":"11330 Diamond Back Way","city":"Grass Valley","state":"CA","zip":"95945","propertyType":"Industrial","transactionType":"Lease","ownerCompany":"Diamond Realty Group","feePercent":"6","listingAgentName":"Taylor Barnes"}

=== NOW EXTRACT FROM THIS DOCUMENT ===
${trimmedText}`
              }
            ],
            maxTokens: 2048
          });
          const raw = llmResponse.choices?.[0]?.message?.content;
          if (typeof raw === "string" && raw.trim()) {
            const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            const llmData = JSON.parse(cleaned);
            if (llmData && typeof llmData === "object") {
              for (const [key, value] of Object.entries(llmData)) {
                if (key === "spaces" && Array.isArray(value) && value.length > 0) {
                  const existingSpaces = Array.isArray(patch.spaces) ? patch.spaces : [];
                  if (!existingSpaces.length || existingSpaces.every((s) => !s.suite && !s.sqft)) {
                    patch.spaces = value;
                  }
                } else if (value !== null && value !== void 0 && String(value).trim() !== "") {
                  const existing = patch[key];
                  const isEmpty = existing === void 0 || existing === null || String(existing).trim() === "";
                  if (isEmpty) {
                    patch[key] = value;
                  }
                }
              }
              source = "listing_llm";
            }
          }
        } catch (llmErr) {
          const llmMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
          warnings.push(`LLM extraction skipped: ${llmMsg.slice(0, 120)}`);
        }
      }
      if (plain.length > 0) {
        const { patch: textPatch, hints } = heuristicsFromPdfText(plain);
        patch = mergeScrapePatches(patch, textPatch);
        patch._hints = hints;
      }
      const addr = String(patch.address ?? "").trim();
      const suite = String(patch.suite ?? "").trim();
      if (!String(patch.listingName ?? "").trim() && addr) {
        patch.listingName = suite ? `${addr}, Ste ${suite}` : addr;
      }
      if (!String(patch.ownerCompany ?? "").trim() && String(patch.lessorName ?? "").trim()) {
        const lessor = String(patch.lessorName).trim();
        if (lessor.length > 2) patch.ownerCompany = lessor;
      }
      if (String(patch.commission ?? "").trim() === "" && patch.feePercent != null) {
        patch.commission = patch.feePercent;
      }
      res.json({
        success: true,
        data: {
          source,
          entryMode: "listing",
          mimeType: normalizedMimeType,
          filename,
          patch,
          warnings
        }
      });
      return;
    }
    jsonErr(res, 400, "Unsupported file type. Upload .xlsx/.xlsm/.xls voucher or .pdf listing agreement / listing form.");
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    jsonErr(res, 500, `Could not scrape file: ${msg}`);
  }
});
dealiusAdminApiRouter.get("/status", async (_req, res) => {
  try {
    const client = new DealiusClient();
    const token = await authenticateConfiguredDealius(client);
    res.json({ success: true, data: { authenticated: Boolean(token) } });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    jsonErr(res, 500, msg);
  }
});

// server/_core/index.ts
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto2;
}
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Node] Unhandled Rejection at:", promise, "reason:", reason);
});
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "250mb" }));
  app.use(express2.urlencoded({ limit: "250mb", extended: true }));
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });
  app.get("/api/seed-prod", async (req, res) => {
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDb;
      const connection = await db();
      if (!connection) {
        res.status(503).json({ error: "DB offline" });
        return;
      }
      const { sql: sql8 } = await import("drizzle-orm");
      const sqlContent = fs4.readFileSync(path3.resolve(process.cwd(), "drizzle/seed_app_users_and_settings.sql"), "utf-8");
      const statements = sqlContent.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
      for (const statement of statements) {
        if (statement.toUpperCase().startsWith("SET ") || statement.toUpperCase().startsWith("INSERT ")) {
          await connection.execute(sql8.raw(statement));
        }
      }
      res.json({ success: true, count: statements.length });
    } catch (err2) {
      console.error(err2);
      res.status(500).json({ error: String(err2) });
    }
  });
  app.get(["/", "/beta", "/beta/*", "/404"], (req, res) => {
    const ua = req.headers["user-agent"] || "";
    if (ua.toLowerCase().includes("elb-healthchecker")) {
      res.status(200).send("OK");
      return;
    }
    res.redirect(302, "/tool");
  });
  registerOAuthRoutes(app);
  app.use("/api/v1", restApiRouter);
  app.use("/api", mapsApiRouter);
  app.use("/api/auth", authApiRouter);
  app.use("/api/submissions", submissionsApiRouter);
  app.use("/api/dealius", dealiusAdminApiRouter);
  app.use("/api/broker-admin", brokerAdminApiRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
  app.use("/api/admin/audit-log", adminAuditLogRouter);
  app.use("/api/settings", publicSettingsRouter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
