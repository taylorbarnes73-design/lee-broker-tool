import "dotenv/config";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}
import express from "express";
import type { Request, RequestHandler, Response } from "express";
import fs from "node:fs";
import path from "node:path";

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Node] Unhandled Rejection at:", promise, "reason:", reason);
});

import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { restApiRouter } from "../restApi";
import { sdk } from "./sdk";
import { authApiRouter } from "../authApi";
import { submissionsApiRouter } from "../submissionsApi";
import { brokerAdminApiRouter } from "../brokerAdminApi";
import { mapsApiRouter } from "../mapsApi";
import { adminUsersRouter } from "../adminUsersApi";
import { adminSettingsRouter } from "../adminSettingsApi";
import { publicSettingsRouter } from "../publicSettingsApi";
import { adminAuditLogRouter } from "../adminAuditLogApi";
import { dealiusAdminApiRouter } from "../dealiusAdminApi";
import { brokerAdminIngestRouter } from "../brokerAdminIngestApi";
import { dealiusApiAdminRouter } from "../dealiusApiAdmin";
import { marketingRequestApiRouter } from "../marketingRequestApi";
import { resolveCommissionVoucherTemplatePath } from "../lib/bundledAssets";
import { startBrokerAdminIngestScheduler } from "../jobs/ingestBrokerAdminEmails";
import { storageGetBytes, storageKeyFromReference } from "../storage";
import { canReadStoredFile, type StoredFileAccessUser } from "../fileAccess";
import { getDb } from "../db";
import { uploads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { migrate } from "drizzle-orm/mysql2/migrator";

const FILE_CONTENT_RATE_LIMIT_WINDOW_MS = 60_000;
const FILE_CONTENT_RATE_LIMIT_MAX = 120;
const fileContentRateLimit = new Map<string, { windowStart: number; count: number }>();

const requireFileContentRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const identity = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
  const current = fileContentRateLimit.get(identity);
  if (!current || now - current.windowStart >= FILE_CONTENT_RATE_LIMIT_WINDOW_MS) {
    fileContentRateLimit.set(identity, { windowStart: now, count: 1 });
    next();
    return;
  }

  if (current.count >= FILE_CONTENT_RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, error: "Too many file requests. Try again later." });
    return;
  }

  current.count += 1;
  fileContentRateLimit.set(identity, current);
  next();
};

async function serveStoredFile(req: Request, res: Response, rawKey: string) {
  let key: string;
  try {
    key = storageKeyFromReference(rawKey);
  } catch {
    res.status(400).json({ success: false, error: "Invalid file key" });
    return;
  }

  try {
    const canRead = await canReadStoredFile(req.user as StoredFileAccessUser | undefined, key);
    if (!canRead) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    const { bytes } = await storageGetBytes(key);
    let filename = key.split("/").pop() || "file";
    let mimeType = "application/octet-stream";

    const db = await getDb();
    if (db) {
      const rows = await db
        .select({ filename: uploads.filename, mimeType: uploads.mimeType })
        .from(uploads)
        .where(eq(uploads.fileKey, key))
        .limit(1);
      const row = rows[0];
      if (row?.filename) filename = row.filename;
      if (row?.mimeType) mimeType = row.mimeType;
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    const safeFilename = filename.replace(/[\r\n\x00-\x1F\x7F"]/g, "").trim() || "file";
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.send(bytes);
  } catch (error) {
    console.error("[files.content] Could not serve uploaded file:", error);
    res.status(404).json({ success: false, error: "File not found" });
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function runMigrations() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("[migrate] No database configured, skipping migrations.");
      return;
    }
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[migrate] Migrations applied successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "250mb" }));
  app.use(express.urlencoded({ limit: "250mb", extended: true }));

  // Keep old bookmarks working while the React workspace owns the product URL.
  app.get(["/tool", "/broker_tool.html"], (req, res) => {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    res.redirect(302, `/portal/workspace${query}`);
  });

  // Health check endpoint for AWS Application Load Balancer
  // Must be registered before migrations run so ECS health checks pass during startup
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/files/content", requireAuth, requireFileContentRateLimit, async (req, res) => {
    const key = String(req.query.key ?? "").trim();
    if (!key) {
      res.status(400).json({ success: false, error: "key query parameter is required" });
      return;
    }

    await serveStoredFile(req, res, key);
  });

  // Commission voucher Excel template — must be registered before SPA/Vite fallthrough
  // so fetch() receives a real .xlsm, not HTML.
  app.get("/templates/commission-voucher-template.xlsm", (_req, res) => {
    const templatePath = resolveCommissionVoucherTemplatePath();
    if (!templatePath) {
      res.status(404).json({ success: false, error: "Voucher template not found" });
      return;
    }
    res.setHeader("Content-Type", "application/vnd.ms-excel.sheet.macroEnabled.12");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(templatePath);
  });

  // Legacy beta URLs now enter the shared React workspace.
  app.get(["/beta", "/beta/*", "/404"], (req, res) => {
    const ua = req.headers["user-agent"] || "";
    if (ua.toLowerCase().includes("elb-healthchecker")) {
      res.status(200).send("OK");
      return;
    }
    res.redirect(302, "/portal/workspace");
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // REST API for Power Automate Custom Connector
  app.use("/api/v1", restApiRouter);
  // Google Maps asset proxy (Street View, Static Maps)
  app.use("/api", mapsApiRouter);
  // Auth + submissions REST API for the SPA portal
  app.use("/api/auth", authApiRouter);
  app.use("/api/submissions", submissionsApiRouter);
  app.use("/api/dealius", dealiusAdminApiRouter);
  app.use("/api/broker-admin", brokerAdminApiRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
  app.use("/api/admin/ingest/brokerAdmin", brokerAdminIngestRouter);
  app.use("/api/admin/dealius", dealiusApiAdminRouter);
  app.use("/api/admin/audit-log", adminAuditLogRouter);
  app.use("/api/settings", publicSettingsRouter);
  app.use("/api/marketing-request", marketingRequestApiRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Serve locally-stored uploads when AWS S3 is not configured (dev / no-S3 mode).
  // The directory is created on first upload; this is a no-op when S3 is in use.
  app.use("/local-uploads", requireAuth, requireFileContentRateLimit, async (req, res) => {
    await serveStoredFile(req, res, `/local-uploads/${req.path.replace(/^\/+/, "")}`);
  });
  // development mode uses Vite, production mode uses static files
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

  await new Promise<void>(resolve => server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    resolve();
  }));

  // Run migrations after the server is already listening so ECS health checks pass during startup.
  await runMigrations();

  // BrokerAdmin email ingest poller — only schedules if Graph credentials are configured.
  startBrokerAdminIngestScheduler().catch(err =>
    console.error("[brokerAdminIngest] scheduler init failed:", err)
  );
}

startServer().catch(console.error);
