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

// Back-compat alias: some clients built `/api/maps/maps/api/streetview` (double `maps`).
mapsApiRouter.get("/maps/maps/api/streetview", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/streetview");
});

// Static map image proxy (optional).
mapsApiRouter.get("/maps/api/staticmap", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/staticmap");
});

// Back-compat alias for static maps too.
mapsApiRouter.get("/maps/maps/api/staticmap", async (req, res) => {
  await proxyGoogleMapsAsset(req, res, "/maps/api/staticmap");
});

// ── Address Autocomplete ──────────────────────────────────────────────────────
//
// Unified endpoint that returns address suggestions for the broker tool.
// Prefers Google Places Autocomplete when GOOGLE_MAPS_API_KEY is set;
// falls back to the free Photon/Nominatim geocoder otherwise.
//
// Response shape:
//   { results: Array<{ address: string; city: string; state: string; zip: string }> }

type AddressSuggestion = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

async function fetchPhotonSuggestions(query: string): Promise<AddressSuggestion[]> {
  const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const res = await fetch(photonUrl, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{
        properties: {
          housenumber?: string;
          street?: string;
          name?: string;
          city?: string;
          county?: string;
          state?: string;
          postcode?: string;
        };
      }>;
    };
    return (data.features ?? []).map(f => {
      const p = f.properties;
      const house = p.housenumber ?? "";
      const street = p.street ?? p.name ?? "";
      return {
        address: [house, street].filter(Boolean).join(" ").trim() || (p.name ?? ""),
        city: p.city ?? p.county ?? "",
        state: p.state ?? "",
        zip: p.postcode ?? "",
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGooglePlacesSuggestions(
  query: string,
  key: string
): Promise<AddressSuggestion[]> {
  const acUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  acUrl.searchParams.set("input", query);
  acUrl.searchParams.set("types", "address");
  acUrl.searchParams.set("components", "country:us");
  acUrl.searchParams.set("language", "en");
  acUrl.searchParams.set("key", key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const res = await fetch(acUrl.toString(), { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      predictions?: Array<{ place_id: string }>;
    };
    if (data.status !== "OK" || !data.predictions) return [];

    // Resolve each prediction into address components via Place Details
    const results: AddressSuggestion[] = [];
    for (const pred of data.predictions.slice(0, 5)) {
      const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailUrl.searchParams.set("place_id", pred.place_id);
      detailUrl.searchParams.set("fields", "address_components");
      detailUrl.searchParams.set("key", key);

      try {
        const detailRes = await fetch(detailUrl.toString(), {
          signal: AbortSignal.timeout(5_000),
        });
        if (!detailRes.ok) continue;
        const detail = (await detailRes.json()) as {
          result?: {
            address_components?: Array<{
              long_name: string;
              short_name: string;
              types: string[];
            }>;
          };
        };
        const comps = detail.result?.address_components ?? [];
        const get = (type: string, useShort = false) => {
          const c = comps.find(ac => ac.types.includes(type));
          return c ? (useShort ? c.short_name : c.long_name) : "";
        };
        const streetNumber = get("street_number");
        const route = get("route");
        results.push({
          address: [streetNumber, route].filter(Boolean).join(" ").trim(),
          city: get("locality") || get("sublocality") || get("administrative_area_level_2"),
          state: get("administrative_area_level_1", true),
          zip: get("postal_code"),
        });
      } catch {
        // Skip this prediction if details fail
      }
    }
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

mapsApiRouter.get("/places/autocomplete", async (req, res) => {
  const query = String(req.query.input ?? "").trim();
  if (!query || query.length < 3) {
    res.json({ results: [] });
    return;
  }

  const key = ENV.googleMapsApiKey?.trim();
  try {
    const suggestions = key
      ? await fetchGooglePlacesSuggestions(query, key)
      : await fetchPhotonSuggestions(query);

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ results: suggestions });
  } catch {
    // Fall back to Photon when Google fails mid-flight
    try {
      const fallback = await fetchPhotonSuggestions(query);
      res.json({ results: fallback });
    } catch {
      res.json({ results: [] });
    }
  }
});

