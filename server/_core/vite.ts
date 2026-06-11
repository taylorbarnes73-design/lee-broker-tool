import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_INDEX_TEMPLATE = fileURLToPath(new URL("../../client/index.html", import.meta.url));
const BROKER_TOOL_TEMPLATE = fileURLToPath(new URL("../../client/public/broker_tool.html", import.meta.url));
const DEV_DIST_PUBLIC_ROOT = fileURLToPath(new URL("../../dist/public/", import.meta.url));
const PROD_PUBLIC_ROOT = path.resolve(process.cwd(), "dist/public");

const HTML_ENTRY_TEMPLATES: Record<string, string> = {
  "/": CLIENT_INDEX_TEMPLATE,
  "/workspace-engine": BROKER_TOOL_TEMPLATE,
};

const resolveHtmlTemplate = (requestUrl: string) => {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  return HTML_ENTRY_TEMPLATES[pathname] ?? CLIENT_INDEX_TEMPLATE;
};

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

  app.get(["/tool", "/broker_tool.html"], (req, res) => {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    res.redirect(302, `/portal/workspace${query}`);
  });

  // Internal workflow engine. The user-facing route is /portal/workspace.
  app.get("/workspace-engine", (_req, res) => {
    // Avoid CDN/browser caching hiding updates to the tool UI.
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("broker_tool.html", { root: distPath });
  });

  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("broker_tool.html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    })
  );

  // React portal routes fall through to the SPA shell.
  app.get(
    ["/", "/portal", "/portal/*", "/dashboard", "/admin", "/admin/*", "/login", "/404"],
    (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile("index.html", { root: distPath });
    }
  );

  // Unknown routes use the React shell rather than exposing a second workspace.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile("index.html", { root: distPath });
  });
}
