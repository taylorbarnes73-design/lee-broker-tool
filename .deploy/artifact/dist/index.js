// server/_core/index.ts
import "dotenv/config";
import { webcrypto as webcrypto2 } from "node:crypto";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
var uploads = mysqlTable("uploads", {
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
var submissions = mysqlTable("submissions", {
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
});
var compImports = mysqlTable("compImports", {
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
var leaseComps = mysqlTable("leaseComps", {
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
var saleComps = mysqlTable("saleComps", {
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
  // Direct OpenAI fallback (used when Forge is not configured).
  // The LLM layer prefers Forge when set; otherwise falls back to OPENAI_API_KEY.
  openaiApiUrl: (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  // AWS storage placeholders for future direct-S3 integration
  awsS3Bucket: process.env.AWS_S3_BUCKET ?? "",
  awsS3Region: process.env.AWS_S3_REGION ?? process.env.AWS_REGION ?? "",
  // Admin
  adminEmail: process.env.ADMIN_EMAIL ?? "",
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
  localAdminEmails: (process.env.LOCAL_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
};

// server/db.ts
var _db = null;
var _pool = null;
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
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
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var LOCAL_OPEN_ID_PREFIX = "local:";
var normalizeEmail = (value) => value.trim().toLowerCase();
var toLocalOpenId = (email) => `${LOCAL_OPEN_ID_PREFIX}${normalizeEmail(email)}`;
var isLocalOpenId = (openId) => openId.startsWith(LOCAL_OPEN_ID_PREFIX);
var emailFromLocalOpenId = (openId) => isLocalOpenId(openId) ? openId.slice(LOCAL_OPEN_ID_PREFIX.length) : null;
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
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
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
          role: email && ENV.localAdminEmails.includes(email.toLowerCase()) ? "admin" : void 0
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
        lastSignedIn: signedInAt
      });
      return {
        ...user,
        name: session.name || user.name,
        email: email ?? user.email,
        loginMethod: "local",
        lastSignedIn: signedInAt
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
      lastSignedIn: signedInAt
    });
    return user;
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
  { id: "1008", name: "Frank Adler", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "fadler@lee-associates.com" },
  { id: "1009", name: "Sean Ahern", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "sahern@lee-associates.com" },
  { id: "1011", name: "Tim Arguello", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "targuello@lee-associates.com" },
  { id: "1012", name: "Chris Barnett (Shareholder)", roles: "Broker", office: "Not Specified", email: "cbarnett@lee-associates.com" },
  { id: "1014", name: "Brian Garbutt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bgarbutt@lee-associates.com" },
  { id: "1016", name: "Ken Gould", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "kgould@lee-associates.com" },
  { id: "1017", name: "Bob Griffin", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bgriffin@lee-associates.com" },
  { id: "1019", name: "Jeff Hirsch", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhirsch@lee-associates.com" },
  { id: "1020", name: "Jack Hogan", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhogan@lee-associates.com" },
  { id: "1021", name: "Mike Long", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mlong@lee-associates.com" },
  { id: "1045", name: "Tom West", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "twest@lee-associates.com" },
  { id: "1051", name: "Gary McArdell", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "gmcardell@lee-associates.com" },
  { id: "1054", name: "Matt Durkin", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mdurkin@lee-associates.com" },
  { id: "1056", name: "Judd Hietbrink", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jhietbrink@lee-associates.com" },
  { id: "1060", name: "David Bolt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "dbolt@lee-associates.com" },
  { id: "1063", name: "Brian Barson", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bbarson@lee-associates.com" },
  { id: "1067", name: "Tim Walker", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "timwalker@lee-associates.com" },
  { id: "1071", name: "Brad Schneider", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bschneider@lee-associates.com" },
  { id: "1076", name: "Rick Turner", roles: "Broker, Manager", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "rturner@lee-associates.com" },
  { id: "1078", name: "Jonathan Mejia", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jmejia@lee-associates.com" },
  { id: "1080", name: "Matt Christensen", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mchristensen@lee-associates.com" },
  { id: "1083", name: "David Kluver", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "dkluver@lee-associates.com" },
  { id: "1092", name: "Carter Harrington", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "charrington@lee-associates.com" },
  { id: "1095", name: "Alejandro Sherratt", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "temporary@lee-associates.com" },
  { id: "1099", name: "Charlie Winn", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "cwinn@lee-associates.com" },
  { id: "1102", name: "Eva Abrego", roles: "Office Admin", office: "Black Hole, Lee & Associates Realty Group Newport Beach, Inc., LeeNewport, Not Specified", email: "eabrego@lee-associates.com" },
  { id: "1105", name: "Kelsey Morris", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "kmorris@lee-associates.com" },
  { id: "1108", name: "Hayden Toland", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "htoland@lee-associates.com" },
  { id: "1109", name: "Miles Toland", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mtoland@lee-associates.com" },
  { id: "1110", name: "Matt Biggs", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mbiggs@lee-associates.com" },
  { id: "1112", name: "Matt Lawer", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "mlawer@lee-associates.com" },
  { id: "1113", name: "Brendan Smith", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "bsmith@lee-associates.com" },
  { id: "1114", name: "Nick Dumke", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "ndumke@lee-associates.com" },
  { id: "1116", name: "John Gessford", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jgessford@lee-associates.com" },
  { id: "1118", name: "Stephen Madigan", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "smadigan@lee-associates.com" },
  { id: "1119", name: "Jessica O'Brien", roles: "Admin Assistant", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "jobrien@lee-associates.com" },
  { id: "1121", name: "Erissa Kat", roles: "Office Admin", office: "Not Specified, Black Hole, Lee & Associates Realty Group Newport Beach, Inc., LeeNewport", email: "ekat@lee-associates.com" },
  { id: "1123", name: "Pitzer Gills", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "pgills@lee-associates.com" },
  { id: "1124", name: "Taylor Barnes", roles: "Office Admin", office: "Lee & Associates Realty Group Newport Beach, Inc., Black Hole, LeeNewport, Not Specified", email: "tbarnes@lee-associates.com" },
  { id: "1125", name: "Libby Gessford", roles: "Broker", office: "Lee & Associates Realty Group Newport Beach, Inc.", email: "lgessford@lee-associates.com" }
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
import { z } from "zod";

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
  return new S3Client({ region: ENV.awsS3Region || ENV.awsRegion });
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
import { desc as desc4 } from "drizzle-orm";
import { z as z7 } from "zod/v4";
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
import { z as z2 } from "zod/v4";
var listingFields = z2.object({
  propertyType: z2.string().optional(),
  transactionType: z2.string().optional(),
  address: z2.string().optional(),
  city: z2.string().optional(),
  state: z2.string().optional(),
  zip: z2.string().optional(),
  rateSfMo: z2.string().optional(),
  term: z2.string().optional(),
  leaseType: z2.string().optional(),
  buildingSf: z2.string().optional(),
  suiteSf: z2.string().optional(),
  askingPrice: z2.string().optional(),
  listingAgentName: z2.string().optional(),
  listingAgentLicense: z2.string().optional(),
  comments: z2.string().optional()
});
var voucherFields = z2.object({
  representationType: z2.string().optional(),
  clientName: z2.string().optional(),
  transactionType: z2.string().optional(),
  address: z2.string().optional(),
  city: z2.string().optional(),
  state: z2.string().optional(),
  zip: z2.string().optional(),
  dealSf: z2.string().optional(),
  commissionRate: z2.string().optional(),
  term: z2.string().optional(),
  commencementDate: z2.string().optional(),
  expirationDate: z2.string().optional(),
  baseRent: z2.string().optional(),
  lessorName: z2.string().optional(),
  lesseeName: z2.string().optional(),
  listingAgentName: z2.string().optional(),
  procuringAgentName: z2.string().optional(),
  totalConsideration: z2.string().optional(),
  notes: z2.string().optional()
});
var signFields = z2.object({
  propertyAddress: z2.string().optional(),
  city: z2.string().optional(),
  state: z2.string().optional(),
  zip: z2.string().optional(),
  signType: z2.string().optional(),
  signSize: z2.string().optional(),
  quantity: z2.string().optional(),
  nameRider: z2.string().optional(),
  requestedBy: z2.string().optional(),
  specialInstructions: z2.string().optional(),
  accessInstructions: z2.string().optional()
});
var compFields = z2.object({
  compType: z2.string().optional(),
  address: z2.string().optional(),
  city: z2.string().optional(),
  state: z2.string().optional(),
  zip: z2.string().optional(),
  buildingSf: z2.string().optional(),
  dealSf: z2.string().optional(),
  leaseRate: z2.string().optional(),
  term: z2.string().optional(),
  commencementDate: z2.string().optional(),
  tenantName: z2.string().optional(),
  landlordName: z2.string().optional(),
  salePrice: z2.string().optional(),
  pricePerSf: z2.string().optional(),
  propertyType: z2.string().optional(),
  brokerName: z2.string().optional(),
  comments: z2.string().optional()
});
var tabFieldSchemas = {
  listing: listingFields,
  voucher: voucherFields,
  sign: signFields,
  comp: compFields
};
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
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
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
var PARSE_SYSTEM = `You are a commercial real estate data extraction specialist for Lee & Associates Newport Beach.
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
var BROCHURE_SYSTEM = `You are a commercial real estate data extraction specialist for Lee & Associates Newport Beach.
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
var aiAssistRouter = router({
  /**
   * Parse a natural language deal description into structured form fields.
   */
  parse: publicProcedure.input(
    z2.object({
      description: z2.string().min(5).max(3e3),
      tab: z2.enum(["listing", "voucher", "sign", "comp"])
    })
  ).mutation(async ({ input }) => {
    const { description, tab } = input;
    const schema = tabFieldSchemas[tab];
    const fieldNames = Object.keys(schema.shape);
    const response = await invokeLLM({
      messages: [
        { role: "system", content: PARSE_SYSTEM },
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
    z2.object({
      currentFields: z2.record(z2.string(), z2.string()),
      tab: z2.enum(["listing", "voucher", "sign", "comp"])
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
   * Fetches the file server-side to avoid CORS issues and sends as base64.
   */
  scrapeBrochure: publicProcedure.input(
    z2.object({
      // Accept either a public http(s) URL (e.g. an S3 object) or a data:
      // URL uploaded inline from the browser. Both are fetched server-side.
      fileUrl: z2.string().refine(
        (v) => /^https?:\/\//i.test(v) || /^data:[^;]+;base64,/i.test(v),
        { message: "fileUrl must be an http(s) URL or a data: URL" }
      ),
      mimeType: z2.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).default("application/pdf")
    })
  ).mutation(async ({ input }) => {
    const { fileUrl, mimeType } = input;
    const fieldNames = Object.keys(listingFields.shape);
    let base64Data;
    try {
      const fileResp = await fetch(fileUrl, { signal: AbortSignal.timeout(3e4) });
      if (!fileResp.ok) throw new Error(`File fetch failed: ${fileResp.status}`);
      const buffer = await fileResp.arrayBuffer();
      base64Data = Buffer.from(buffer).toString("base64");
    } catch (e) {
      return {
        success: false,
        fields: {},
        tab: "listing",
        fieldCount: 0,
        error: `Could not fetch file: ${e.message}`
      };
    }
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const userContent = [
      {
        type: "image_url",
        image_url: { url: dataUrl, detail: "high" }
      },
      {
        type: "text",
        text: `Extract all listing fields you can identify from this ${mimeType === "application/pdf" ? "PDF brochure" : "brochure image"}.

Available fields: ${fieldNames.join(", ")}

Return JSON with only fields you can confidently extract:`
      }
    ];
    const response = await invokeLLM({
      messages: [
        { role: "system", content: BROCHURE_SYSTEM },
        { role: "user", content: userContent }
      ],
      response_format: {
        type: "json_schema",
        json_schema: buildJsonSchema("brochure_listing_fields", fieldNames)
      }
    });
    const raw = response.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(raw);
    const fields = sanitizeAiFields("listing", parsed);
    return {
      success: true,
      fields,
      tab: "listing",
      fieldCount: Object.keys(fields).length
    };
  }),
  /**
   * Review parsed voucher/deal data and return structured suggestions.
   * Used by the Dealius integration panel — no external API key required.
   */
  reviewVoucher: publicProcedure.input(
    z2.object({
      dealData: z2.record(z2.string(), z2.unknown())
    })
  ).mutation(async ({ input }) => {
    const suggestions = runVoucherAudit(input.dealData);
    return { success: true, suggestions };
  })
});

// server/routers/compData.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { desc as desc2 } from "drizzle-orm";
import { z as z3 } from "zod/v4";

// server/services/compData.ts
import { and, desc, eq as eq2, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";

// shared/comp-data.ts
import XLSX from "xlsx";
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
function cleanDate(value) {
  const fromExcelSerial = (serial) => {
    const parsed2 = XLSX.SSF.parse_date_code(serial);
    if (!parsed2 || !parsed2.y || parsed2.y < 1900 || parsed2.y > 2100) return "";
    const month = String(parsed2.m).padStart(2, "0");
    const day = String(parsed2.d).padStart(2, "0");
    return `${parsed2.y}-${month}-${day}`;
  };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelDate = fromExcelSerial(value);
    if (excelDate) return excelDate;
  }
  const text2 = cleanText(value);
  if (!text2) return "";
  const numericText = Number(text2);
  if (Number.isFinite(numericText)) {
    const excelDate = fromExcelSerial(numericText);
    if (excelDate) return excelDate;
  }
  const parsed = new Date(text2);
  if (Number.isNaN(parsed.getTime())) return text2;
  const year = parsed.getUTCFullYear();
  if (year < 1900 || year > 2100) return "";
  return parsed.toISOString().slice(0, 10);
}
function cleanFlag(value) {
  const text2 = cleanText(value).toUpperCase();
  if (text2 === "Y" || text2 === "YES" || text2 === "TRUE") return "Yes";
  if (text2 === "N" || text2 === "NO" || text2 === "FALSE") return "No";
  return cleanText(value);
}
function joinAddress(parts) {
  const streetCore = parts.map(cleanText).filter(Boolean).join(" ");
  return streetCore.replace(/\s+/g, " ").trim();
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
function formatCurrency(value, decimals = 0) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}
function formatCurrencyPerSf(value, suffix = "") {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "";
  const decimals = value % 1 === 0 ? 2 : 3;
  return `${formatCurrency(value, decimals)}${suffix}`;
}
function formatReportDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US");
}
function buildBrokerLine(kind, brokerage, agents) {
  const namedAgents = agents.map((a) => a.trim()).filter(Boolean);
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
  return XLSX.utils.sheet_to_json(sheet, {
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
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
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
      "Trans. Date": record.transactionDate,
      "Prop. Type": record.propertyType,
      "On Mrkt": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Lessee: record.lessee,
      "Rent/SqFt": [formatCurrencyPerSf(record.rentPerSqFt), record.rentType].filter(Boolean).join(" "),
      "TI Allow": record.tia,
      "Expir. Date": record.expirationDate,
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
      "Occ Date": record.occupancyDate,
      Parking: record.parkingRatio,
      "Yr Built": formatNumber(record.yearBuilt),
      HT: formatNumber(record.clearHeight),
      Land: formatNumber(record.landSqFt),
      "Options/Rent Adj": [record.options, record.rentAdjustments].filter(Boolean).join(" / ")
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
      "Trans. Date": record.transactionDate,
      "Prop. Type": record.propertyType,
      "Yr Built": formatNumber(record.yearBuilt),
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
      "Trans. Type": record.transactionType,
      "Cap Rate": record.capRate !== null ? `${record.capRate}%` : "",
      "Bldg. Class": record.buildingClass,
      Amps: formatNumber(record.amperage),
      Clr: formatNumber(record.clearHeight),
      Yard: record.yard,
      "Buyer Previous Location": record.buyerPriorLocation
    }
  };
}

// server/services/compData.ts
var INSERT_BATCH_SIZE = 500;
function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
function numberFromCount(value) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
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
    photo: record.photo ?? ""
  };
}
function mapSaleSearchResult(row) {
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
    photo: record.photo ?? ""
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
    await db.update(compImports).set({ leaseCount: sql`${compImports.leaseCount} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, activeImport.id));
    return {
      importId: activeImport.id,
      compId: inserted.insertId ?? null
    };
  } else {
    const rows = buildSaleInsertRows([record], activeImport.id);
    const [inserted] = await db.insert(saleComps).values(rows);
    await db.update(compImports).set({ saleCount: sql`${compImports.saleCount} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(compImports.id, activeImport.id));
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
    if (cities.length) conditions2.push(inArray(leaseComps.city, cities));
    if (markets.length) conditions2.push(inArray(leaseComps.market, markets));
    if (subMarkets.length) conditions2.push(inArray(leaseComps.subMarket, subMarkets));
    if (propertyTypes.length) conditions2.push(inArray(leaseComps.propertyType, propertyTypes));
    if (sfMin !== void 0) conditions2.push(sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${leaseComps.rawPayload}, '$.leasedSqFt')) AS SIGNED) >= ${sfMin}`);
    if (sfMax !== void 0) conditions2.push(sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${leaseComps.rawPayload}, '$.leasedSqFt')) AS SIGNED) <= ${sfMax}`);
    if (dateFrom) conditions2.push(gte(leaseComps.transactionDate, dateFrom));
    if (dateTo) conditions2.push(lte(leaseComps.transactionDate, dateTo));
    const whereClause2 = and(...conditions2);
    const countRows2 = await db.select({ count: sql`count(*)` }).from(leaseComps).where(whereClause2);
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
  if (cities.length) conditions.push(inArray(saleComps.city, cities));
  if (markets.length) conditions.push(inArray(saleComps.market, markets));
  if (subMarkets.length) conditions.push(inArray(saleComps.subMarket, subMarkets));
  if (propertyTypes.length) conditions.push(inArray(saleComps.propertyType, propertyTypes));
  if (sfMin !== void 0) conditions.push(sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${saleComps.rawPayload}, '$.buildingSqFt')) AS SIGNED) >= ${sfMin}`);
  if (sfMax !== void 0) conditions.push(sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${saleComps.rawPayload}, '$.buildingSqFt')) AS SIGNED) <= ${sfMax}`);
  if (dateFrom) conditions.push(gte(saleComps.transactionDate, dateFrom));
  if (dateTo) conditions.push(lte(saleComps.transactionDate, dateTo));
  const whereClause = and(...conditions);
  const countRows = await db.select({ count: sql`count(*)` }).from(saleComps).where(whereClause);
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
var compTypeSchema = z3.enum(["lease", "sale"]);
var filterArr = z3.array(z3.string().trim().max(120)).optional();
var searchInputSchema = z3.object({
  compType: compTypeSchema,
  query: z3.string().trim().max(200).optional(),
  cities: filterArr,
  markets: filterArr,
  subMarkets: filterArr,
  propertyTypes: filterArr,
  sfMin: z3.number().min(0).optional(),
  sfMax: z3.number().min(0).optional(),
  dateFrom: z3.string().trim().max(32).optional(),
  dateTo: z3.string().trim().max(32).optional(),
  limit: z3.number().min(1).max(100).default(20),
  offset: z3.number().min(0).default(0)
});
var manualRecordSchema = z3.object({}).catchall(z3.unknown());
var addCompInputSchema = z3.object({
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
  const raw = textValue(input, key);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
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
    rentUse: textValue(input, "rentUse")
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
    askingPrice: numberValue(input, "askingPrice")
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
  listImports: adminProcedure.input(z3.object({ limit: z3.number().min(1).max(50).default(12) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 12;
    return db.select().from(compImports).orderBy(desc2(compImports.createdAt)).limit(limit);
  }),
  importWorkbook: adminProcedure.input(
    z3.object({
      fileKey: z3.string().min(1),
      filename: z3.string().min(1)
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
import { execSync } from "child_process";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import { z as z4 } from "zod/v4";
var fieldSchema = z4.object({
  label: z4.string(),
  value: z4.string()
});
var sectionSchema = z4.object({
  title: z4.string(),
  fields: z4.array(fieldSchema)
});
var pdfAttachmentSchema = z4.object({
  filename: z4.string().trim().min(1).max(255),
  mimeType: z4.literal("application/pdf").default("application/pdf"),
  base64Data: z4.string().min(1)
});
var sendToAdminInput = z4.object({
  formType: z4.enum(["listing", "voucher", "sign"]),
  brokerName: z4.string().optional(),
  propertyAddress: z4.string().optional(),
  sections: z4.array(sectionSchema),
  senderEmail: z4.string().email().optional(),
  pdfAttachment: pdfAttachmentSchema.optional()
});
function formLabelFor(formType) {
  return formType === "listing" ? "Listing Entry" : formType === "sign" ? "Sign Request" : "Commission Voucher";
}
function sanitizeFileName(filename) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}
function buildEmailBody(params) {
  const { formType, brokerName, propertyAddress, sections, archivedPdfUrl, archivedPdfName } = params;
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
    `Lee & Associates Newport Beach - ${formLabelFor(formType)} Submission`,
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
    "This email was generated automatically by the Lee & Associates Broker Submission Tool.",
    "Taylor Barnes | Lee & Associates Newport Beach"
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
    const { formType, brokerName = "", propertyAddress = "", sections, senderEmail, pdfAttachment } = input;
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
    const subject = `[Lee & Associates] ${formLabelFor(formType)} Submission${addressPart}`;
    const content = buildEmailBody({
      formType,
      brokerName,
      propertyAddress,
      sections,
      archivedPdfUrl: archivedPdf?.url,
      archivedPdfName: archivedPdf?.filename
    });
    const to = [adminEmail];
    const cc = senderEmail ? [senderEmail] : [];
    const delivery = await deliverSubmissionEmail({
      to,
      cc,
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
        deliveryError: delivery.error
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
  })
});

// server/routers/contracts.ts
import { z as z5 } from "zod";
import { execSync as execSync2 } from "child_process";
var redlineSchema = z5.object({
  paragraph: z5.string(),
  type: z5.enum(["strikethrough", "added", "modified"]),
  note: z5.string()
});
var contractDataSchema = z5.object({
  contractType: z5.string(),
  agreementDate: z5.string().optional(),
  party1Name: z5.string().optional(),
  party1Entity: z5.string().optional(),
  party1Address: z5.string().optional(),
  party1Phone: z5.string().optional(),
  party1Fax: z5.string().optional(),
  agentName: z5.string().optional(),
  agentAddress: z5.string().optional(),
  agentPhone: z5.string().optional(),
  agentFax: z5.string().optional(),
  brokerDre: z5.string().optional(),
  agentIndividual: z5.string().optional(),
  agentTitle: z5.string().optional(),
  agentDre: z5.string().optional(),
  agentEmail: z5.string().optional(),
  propAddress: z5.string().optional(),
  propCity: z5.string().optional(),
  propState: z5.string().optional(),
  propZip: z5.string().optional(),
  propCounty: z5.string().optional(),
  propDesc: z5.string().optional(),
  mlDate: z5.string().optional(),
  mlAmendments: z5.string().optional(),
  mlLessor: z5.string().optional(),
  mlLessee: z5.string().optional(),
  termStart: z5.string().optional(),
  termEnd: z5.string().optional(),
  subleaseTerms: z5.string().optional(),
  commType: z5.string().optional(),
  commAmount: z5.string().optional(),
  arbitration: z5.string().optional(),
  additionalProvisions: z5.string().optional(),
  sig1Name: z5.string().optional(),
  sig1Title: z5.string().optional(),
  redlines: z5.array(redlineSchema).optional()
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
function buildDataSheet(data) {
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
    "Taylor Barnes | Lee & Associates Newport Beach | (949) 724-4755"
  ].filter((l) => l !== void 0 && l !== "  : ").join("\n");
}
var contractsRouter = router({
  /**
   * Extract contract fields and redlines from an uploaded PDF using AI vision.
   */
  extractContract: publicProcedure.input(
    z5.object({
      /** Public URL of the uploaded PDF (from S3 / CDN) */
      pdfUrl: z5.string().url(),
      contractType: z5.string()
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
      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "file_url",
              file_url: {
                url: input.pdfUrl,
                mime_type: "application/pdf"
              }
            }
          ]
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
      const dateFields = ["agreementDate", "mlDate", "termStart", "termEnd"];
      for (const f of dateFields) {
        if (parsed[f]) parsed[f] = parseToIsoDate(String(parsed[f]));
      }
      return { success: true, data: parsed, error: null };
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return { success: false, error: msg, data: null };
    }
  }),
  /**
   * Submit a completed contract data sheet to the admin via Outlook MCP.
   */
  submitContractToAdmin: publicProcedure.input(
    z5.object({
      contractData: contractDataSchema,
      brokerName: z5.string().optional(),
      senderEmail: z5.string().optional(),
      notes: z5.string().optional()
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
    const dataSheet = buildDataSheet(dataWithNotes);
    const contractLabel = contractData.contractType || "Contract";
    const addressPart = [contractData.propAddress, contractData.propCity].filter(Boolean).join(", ");
    const subject = `[Lee & Associates] Contract Intake \u2014 ${contractLabel}${addressPart ? ` \u2014 ${addressPart}` : ""}`;
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
import { desc as desc3, eq as eq4 } from "drizzle-orm";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z6 } from "zod/v4";
var submissionSummarySchema = z6.object({
  clientSubmissionId: z6.string().optional(),
  type: z6.string(),
  status: z6.string().optional(),
  propertyType: z6.string().optional(),
  transactionType: z6.string().optional(),
  address: z6.string().optional(),
  city: z6.string().optional(),
  state: z6.string().optional(),
  zip: z6.string().optional(),
  brokerName: z6.string().optional(),
  brokerEmail: z6.union([z6.string().email(), z6.literal("")]).optional(),
  office: z6.string().optional(),
  submittedAt: z6.string().optional(),
  updatedAt: z6.string().optional()
}).catchall(z6.unknown());
var adminStatusSchema = z6.enum(["pending", "in_review", "approved", "rejected"]);
function parsePayload(payload) {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
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
    return {
      success: true,
      stored: true,
      submissionId: result.insertId ?? null
    };
  }),
  mine: protectedProcedure.input(z6.object({ limit: z6.number().min(1).max(100).default(25) }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 25;
    const rows = await db.select().from(submissions).where(eq4(submissions.submittedByOpenId, ctx.user.openId)).orderBy(desc3(submissions.createdAt)).limit(limit);
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
  byId: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }
    const rows = await db.select().from(submissions).where(eq4(submissions.id, input.id)).limit(1);
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
  adminList: protectedProcedure.input(z6.object({ limit: z6.number().min(1).max(500).default(200) }).optional()).query(async ({ ctx, input }) => {
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
    z6.object({
      id: z6.number().int().positive(),
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
    }).where(eq4(submissions.id, input.id));
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

// server/routers.ts
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
      z7.object({
        firstName: z7.string().trim().min(1).max(60).optional(),
        lastName: z7.string().trim().min(1).max(60).optional(),
        name: z7.string().trim().min(2).max(120).optional(),
        email: z7.string().trim().email()
      }).refine(
        (value) => Boolean(value.name) || Boolean(value.firstName && value.lastName),
        {
          message: "Provide first name, last name, and email."
        }
      )
    ).mutation(async ({ ctx, input }) => {
      if (!localAuth.isEnabled()) {
        return { success: false, error: "Local auth is disabled." };
      }
      const email = localAuth.normalizeEmail(input.email);
      const enteredName = input.name?.trim() || [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ");
      const allowedDomain = (process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
      if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
        return {
          success: false,
          error: `Use your ${allowedDomain} email address.`
        };
      }
      const brokerEntry = findBrokerDirectoryEntry(email);
      const resolvedName = brokerEntry?.name || enteredName;
      const openId = localAuth.toLocalOpenId(email);
      const isAdminEmail = (process.env.LOCAL_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(email) || isBrokerDirectoryAdmin(brokerEntry);
      const role = isAdminEmail ? "admin" : "user";
      await upsertUser({
        openId,
        name: resolvedName,
        email,
        loginMethod: "local",
        role,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(openId, {
        name: resolvedName,
        email
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS
      });
      return {
        success: true,
        user: {
          name: resolvedName,
          email,
          role,
          office: brokerEntry?.office ?? null
        }
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
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
      z7.object({
        filename: z7.string(),
        mimeType: z7.string(),
        base64Data: z7.string(),
        category: z7.string().default("other"),
        reference: z7.string().optional(),
        uploaderName: z7.string().optional()
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
    getUrl: publicProcedure.input(z7.object({ fileKey: z7.string() })).query(async ({ input }) => {
      const { url } = await storageGet(input.fileKey);
      return { url };
    }),
    /**
     * List recent uploads, optionally filtered by category or reference.
     */
    list: publicProcedure.input(
      z7.object({
        category: z7.string().optional(),
        reference: z7.string().optional(),
        limit: z7.number().default(50)
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
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid as nanoid3 } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var CLIENT_INDEX_TEMPLATE = fileURLToPath(new URL("../../client/index.html", import.meta.url));
var BROKER_TOOL_TEMPLATE = fileURLToPath(new URL("../../client/public/broker_tool.html", import.meta.url));
var DEV_DIST_PUBLIC_ROOT = fileURLToPath(new URL("../../dist/public/", import.meta.url));
var PROD_PUBLIC_ROOT = path.resolve(process.cwd(), "dist/public");
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
    configFile: path.resolve(__dirname, "../..", "vite.config.ts"),
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = await fs.promises.readFile(
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
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });
  app.get("/tool", (_req, res) => {
    res.sendFile("broker_tool.html", { root: distPath });
  });
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile("index.html", { root: distPath });
  });
}

// server/restApi.ts
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { desc as desc5, eq as eq6 } from "drizzle-orm";
import { nanoid as nanoid4 } from "nanoid";
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
    const rows = await db.select().from(submissions).where(eq6(submissions.id, id)).limit(1);
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

// server/_core/index.ts
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto2;
}
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
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });
  registerOAuthRoutes(app);
  app.use("/api/v1", restApiRouter);
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
