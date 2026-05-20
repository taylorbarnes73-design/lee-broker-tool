import "dotenv/config";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}
import express from "express";
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
import { startBrokerAdminIngestScheduler } from "../jobs/ingestBrokerAdminEmails";

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
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).send("OK");
  });

  // TEMPORARY: Seed the database for AWS
  app.get("/api/seed-prod", async (req, res) => {
    try {
      const db = (await import("../db")).getDb;
      const connection = await db();
      if (!connection) {
        res.status(503).json({ error: "DB offline" });
        return;
      }
      const { sql } = await import("drizzle-orm");
      const sqlContent = fs.readFileSync(path.resolve(process.cwd(), "drizzle/seed_app_users_and_settings.sql"), "utf-8");
      const statements = sqlContent.split(";").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      for (const statement of statements) {
        if (statement.toUpperCase().startsWith("SET ") || statement.toUpperCase().startsWith("INSERT ")) {
          await connection.execute(sql.raw(statement));
        }
      }
      res.json({ success: true, count: statements.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
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
  // Serve locally-stored uploads when AWS S3 is not configured (dev / no-S3 mode).
  // The directory is created on first upload; this is a no-op when S3 is in use.
  app.use(
    "/local-uploads",
    (req, _res, next) => {
      // Block path-traversal attempts before they reach the static handler
      if (req.path.includes("..")) {
        next(new Error("Invalid path"));
        return;
      }
      next();
    },
    express.static(path.join(process.cwd(), "local-uploads"), { fallthrough: false })
  );
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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // BrokerAdmin email ingest poller — only schedules if Graph credentials are configured.
  startBrokerAdminIngestScheduler().catch(err =>
    console.error("[brokerAdminIngest] scheduler init failed:", err)
  );
}

startServer().catch(console.error);
