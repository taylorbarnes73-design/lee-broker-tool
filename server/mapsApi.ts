import { Router, type Request, type Response } from "express";
import { ENV } from "./_core/env";
import { URL } from "url";
import { AXIOS_TIMEOUT_MS } from "@shared/const";

export const mapsApiRouter = Router();

function requireMapsKey(res: Response): string | null {
  const key = ENV.googleMapsApiKey?.trim();
  if (!key) {
    res.status(503).json({
      success: false,
      error: "Google Maps is not configured (set GOOGLE_MAPS_API_KEY).",
    });
    return null;
  }
  return key;
}

async function proxyGoogleMapsAsset(req: Request, res: Response, endpoint: string) {
  const key = requireMapsKey(res);
  if (!key) return;

  const url = new URL(`https://maps.googleapis.com${endpoint}`);
  url.searchParams.set("key", key);

  // Pass through query params except `key` to prevent override.
  for (const [k, v] of Object.entries(req.query)) {
    if (k.toLowerCase() === "key") continue;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach(item => url.searchParams.append(k, String(item)));
    } else {
      url.searchParams.append(k, String(v));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.status(upstream.status).json({
        success: false,
        error: `Google Maps request failed (${upstream.status})`,
        details: text.slice(0, 2000),
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

// Street View image proxy.
mapsApiRouter.get("/maps/api/streetview", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/streetview");
});

// Static map image proxy (optional).
mapsApiRouter.get("/maps/api/staticmap", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/staticmap");
});

