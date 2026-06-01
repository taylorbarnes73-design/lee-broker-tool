import "dotenv/config";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}
import express from "express";
import type { Request, RequestHandler, Response } from "express";
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
import { startBrokerAdminIngestScheduler } from "../jobs/ingestBrokerAdminEmails";
import { storageGetBytes } from "../storage";
import { getDb } from "../db";
import { FileAccessError, requireStoredFileAccess } from "../fileAccess";
import { resolvePortalRequestUser } from "../auth/resolvePortalRequestUser";
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

async function serveAuthorizedStoredFile(req: Request, res: Response, keyOrUrl: string) {
  const key = String(keyOrUrl ?? "").trim();
  if (!key) {
    res.status(400).json({ success: false, error: "key query parameter is required" });
    return;
  }

  const user = await resolvePortalRequestUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: "Not authenticated" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable" });
    return;
  }

  try {
    const access = await requireStoredFileAccess(db, user, key);
    const { bytes } = await storageGetBytes(access.key);
    const filename = access.upload.filename || access.key.split("/").pop() || "file";
    const mimeType = access.upload.mimeType || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    const safeFilename = filename.replace(/[\r\n\x00-\x1F\x7F"]/g, "").trim() || "file";
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.send(bytes);
  } catch (error) {
    if (error instanceof FileAccessError) {
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
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

  // Redirect legacy URL to canonical clean URL
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });

  // Health check endpoint for AWS Application Load Balancer
  // Must be registered before migrations run so ECS health checks pass during startup
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/files/content", requireFileContentRateLimit, async (req, res) => {
    await serveAuthorizedStoredFile(req, res, String(req.query.key ?? ""));
  });

  // Legacy broker HTML entry points (not the marketing / SPA root).
  // `/` is served by the React shell (Vite dev or `serveStatic`); `/tool` stays the HTML workspace.
  app.get(["/beta", "/beta/*", "/404"], (req, res) => {
    const ua = req.headers["user-agent"] || "";
    if (ua.toLowerCase().includes("elb-healthchecker")) {
      res.status(200).send("OK");
      return;
    }
    res.redirect(302, "/tool");
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Legacy local-upload URLs are served through the same authenticated ACL path
  // as /api/files/content so no-S3 deployments do not expose uploads publicly.
  app.get("/local-uploads/*", requireFileContentRateLimit, async (req, res) => {
    await serveAuthorizedStoredFile(req, res, `/local-uploads/${String(req.params[0] ?? "")}`);
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
