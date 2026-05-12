/**
 * Buildout REST API v1 — API key is passed in the URL path (see https://buildout.com/api/v1).
 * Full sync with Company → Broker → Property → Lease space is not implemented here; this module supports credential checks and a small properties sample read.
 */

const DEFAULT_API_BASE = "https://buildout.com/api/v1";

export type BuildoutPropertiesSample = {
  total_count: number;
  returned: number;
  first_property_id: number | null;
  first_property_name: string | null;
};

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Accepts empty (default), or a URL ending at /api/v1. */
export function normalizeBuildoutApiBaseUrl(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return DEFAULT_API_BASE;
  const noSlash = trimTrailingSlashes(t);
  return noSlash;
}

function buildPropertiesUrl(apiBase: string, apiKey: string, companyId: number | null, limit: number): string {
  const base = trimTrailingSlashes(normalizeBuildoutApiBaseUrl(apiBase));
  const encKey = encodeURIComponent(apiKey.trim());
  const qs = new URLSearchParams();
  qs.set("limit", String(Math.min(Math.max(limit, 1), 25)));
  if (companyId != null && Number.isFinite(companyId)) qs.set("company_id", String(companyId));
  return `${base}/${encKey}/properties.json?${qs.toString()}`;
}

export function parseBuildoutPropertiesResponse(data: unknown): BuildoutPropertiesSample {
  if (!data || typeof data !== "object") {
    return { total_count: 0, returned: 0, first_property_id: null, first_property_name: null };
  }
  const o = data as Record<string, unknown>;
  const total = typeof o.count === "number" ? o.count : 0;
  const list = Array.isArray(o.properties) ? o.properties : [];
  const first = list[0];
  if (!first || typeof first !== "object") {
    return { total_count: total, returned: list.length, first_property_id: null, first_property_name: null };
  }
  const p = first as Record<string, unknown>;
  let firstId: number | null = null;
  if (typeof p.id === "number" && Number.isFinite(p.id)) firstId = p.id;
  else if (typeof p.id === "string" && /^\d+$/.test(p.id)) firstId = Number(p.id);
  const name =
    typeof p.name === "string"
      ? p.name
      : typeof p.property_name === "string"
        ? p.property_name
        : typeof p.address === "string"
          ? p.address
          : null;
  return {
    total_count: total,
    returned: list.length,
    first_property_id: firstId,
    first_property_name: name,
  };
}

export function formatBuildoutHttpError(status: number, bodyText: string): string {
  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 240);
  if (status === 401 || status === 403) {
    return "Buildout rejected the API key (unauthorized). Check the key in Buildout admin and try again.";
  }
  if (status === 404) {
    return "Buildout returned 404 — verify the API base URL and that your account uses API v1.";
  }
  if (snippet) return `Buildout request failed (${status}): ${snippet}`;
  return `Buildout request failed with HTTP ${status}.`;
}

export async function fetchBuildoutPropertiesSample(params: {
  apiKey: string;
  apiBaseUrl?: string | null;
  defaultCompanyId?: number | null;
  limit?: number;
}): Promise<{ raw: unknown; sample: BuildoutPropertiesSample }> {
  const url = buildPropertiesUrl(
    params.apiBaseUrl ?? "",
    params.apiKey,
    params.defaultCompanyId ?? null,
    params.limit ?? 5
  );
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(formatBuildoutHttpError(res.status, text || "Invalid JSON"));
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error ?? text)
        : text;
    throw new Error(formatBuildoutHttpError(res.status, msg));
  }
  return { raw: data, sample: parseBuildoutPropertiesResponse(data) };
}

function buildKeyedUrl(apiBase: string | null | undefined, apiKey: string, resourcePath: string): string {
  const base = trimTrailingSlashes(normalizeBuildoutApiBaseUrl(apiBase));
  const encKey = encodeURIComponent(apiKey.trim());
  const path = resourcePath.replace(/^\//, "");
  return `${base}/${encKey}/${path}`;
}

export type BuildoutJsonResult = {
  status: number;
  ok: boolean;
  data: unknown;
};

/**
 * Low-level JSON request. Does not log URLs (they contain the API key path segment).
 */
export async function buildoutJsonRequest(params: {
  apiKey: string;
  apiBaseUrl?: string | null;
  method: "GET" | "POST" | "PUT";
  /** e.g. `properties.json` or `properties/42.json` */
  resourcePath: string;
  body?: unknown;
}): Promise<BuildoutJsonResult> {
  const url = buildKeyedUrl(params.apiBaseUrl, params.apiKey, params.resourcePath);
  const res = await fetch(url, {
    method: params.method,
    headers: {
      Accept: "application/json",
      ...(params.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return { status: res.status, ok: false, data: null };
  }
  return { status: res.status, ok: res.ok, data };
}

export function buildoutResultErrorMessage(result: BuildoutJsonResult, verb: string): string {
  const body =
    result.data && typeof result.data === "object" && "error" in result.data
      ? String((result.data as Record<string, unknown>).error)
      : "";
  return formatBuildoutHttpError(result.status, body || `Buildout ${verb} failed`);
}

export function parseBuildoutPropertyIdFromPayload(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const prop = root.property;
  if (!prop || typeof prop !== "object") return null;
  const id = (prop as Record<string, unknown>).id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
  return null;
}

export async function createBuildoutProperty(params: {
  apiKey: string;
  apiBaseUrl?: string | null;
  property: Record<string, unknown>;
}): Promise<{ propertyId: number; raw: unknown }> {
  const result = await buildoutJsonRequest({
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    method: "POST",
    resourcePath: "properties.json",
    body: { property: params.property },
  });
  if (!result.ok) {
    throw new Error(buildoutResultErrorMessage(result, "create property"));
  }
  const id = parseBuildoutPropertyIdFromPayload(result.data);
  if (id == null) {
    throw new Error("Buildout create succeeded but response did not include property.id.");
  }
  return { propertyId: id, raw: result.data };
}

/**
 * Updates an existing property. Buildout documents PUT for resource updates (e.g. condos); properties follow the same URL pattern.
 * If your tenant rejects PUT, the error body from Buildout will surface here.
 */
export async function updateBuildoutProperty(params: {
  apiKey: string;
  apiBaseUrl?: string | null;
  propertyId: number;
  property: Record<string, unknown>;
}): Promise<{ raw: unknown }> {
  const result = await buildoutJsonRequest({
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    method: "PUT",
    resourcePath: `properties/${params.propertyId}.json`,
    body: { property: params.property },
  });
  if (!result.ok) {
    throw new Error(buildoutResultErrorMessage(result, "update property"));
  }
  return { raw: result.data };
}

export async function addBuildoutPropertyPhoto(params: {
  apiKey: string;
  apiBaseUrl?: string | null;
  propertyId: number;
  photo: { url?: string; data?: string; type?: string; description?: string; sort_order?: number };
}): Promise<BuildoutJsonResult> {
  return buildoutJsonRequest({
    apiKey: params.apiKey,
    apiBaseUrl: params.apiBaseUrl,
    method: "POST",
    resourcePath: `properties/${params.propertyId}/photos.json`,
    body: { photo: params.photo },
  });
}
