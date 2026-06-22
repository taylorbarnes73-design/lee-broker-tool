import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_INDEX_TEMPLATE = fileURLToPath(new URL("../../client/index.html", import.meta.url));
const DEV_DIST_PUBLIC_ROOT = fileURLToPath(new URL("../../dist/public/", import.meta.url));
const PROD_PUBLIC_ROOT = path.resolve(process.cwd(), "dist/public");

// Every workspace tool is now a native React route; the legacy broker_tool.html
// engine has been retired, so all HTML entry points resolve to the SPA shell.
const resolveHtmlTemplate = (_requestUrl: string) => CLIENT_INDEX_TEMPLATE;

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    configFile: path.resolve(__dirname, "../..", "vite.config.ts"),
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    if (url.startsWith("/api/")) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }

    try {
      // always reload the html file from disk in case it changes
      let template = await fs.promises.readFile(
        resolveHtmlTemplate(url),
        "utf-8"
      );
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? DEV_DIST_PUBLIC_ROOT
      : PROD_PUBLIC_ROOT;
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the public assets first`
    );
  }

  // Keep old bookmarks working: legacy tool/engine URLs now land on the React home.
  app.get(["/tool", "/broker_tool.html", "/workspace-engine"], (req, res) => {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    res.redirect(302, `/portal/workspace${query}`);
  });

  app.use(express.static(distPath));

  // React portal routes fall through to the SPA shell.
  app.get(
    ["/", "/portal", "/portal/*", "/dashboard", "/admin", "/admin/*", "/login", "/404"],
    (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile("index.html", { root: distPath });
    }
  );

  // Unmatched API routes get a real 404 instead of the SPA shell.
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  // Unknown routes use the React shell rather than exposing a second workspace.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("index.html", { root: distPath });
  });
}
