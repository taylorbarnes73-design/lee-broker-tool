import "dotenv/config";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}
import express from "express";
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
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Redirect legacy URL to canonical clean URL
  app.get("/broker_tool.html", (_req, res) => {
    res.redirect(301, "/tool");
  });

  // Make the product feel like a single-purpose tool.
  // Old/beta/portal routes hard-redirect to the broker tool.
  app.get(["/", "/portal", "/portal/*", "/beta", "/beta/*", "/login", "/404"], (_req, res) => {
    res.redirect(302, "/tool");
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // REST API for Power Automate Custom Connector
  app.use("/api/v1", restApiRouter);
  // Auth + submissions REST API for the SPA portal
  app.use("/api/auth", authApiRouter);
  app.use("/api/submissions", submissionsApiRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
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
}

startServer().catch(console.error);
