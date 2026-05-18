import { getSetting } from "../../settings/getSetting";

export type DealiusConfig = {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
};

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

export async function getDealiusConfig(): Promise<DealiusConfig> {
  const enabled = Boolean(await getSetting("integrations.dealius_api.enabled"));
  const baseUrlRaw = String((await getSetting("integrations.dealius_api.base_url")) ?? "");
  const apiKey = String((await getSetting("integrations.dealius_api.api_key")) ?? "");
  return {
    enabled,
    baseUrl: normalizeBaseUrl(baseUrlRaw),
    apiKey,
  };
}

export function buildDealiusUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

export type DealiusFetchOptions = RequestInit & {
  /** Override the config (used for test endpoints that need to validate unsaved credentials). */
  configOverride?: DealiusConfig;
};

export async function dealiusFetch(path: string, init: DealiusFetchOptions = {}): Promise<Response> {
  const { configOverride, headers: incomingHeaders, ...rest } = init;
  const cfg = configOverride ?? (await getDealiusConfig());

  if (!cfg.enabled) {
    throw new Error("Dealius API integration is disabled in admin Settings.");
  }
  if (!cfg.apiKey) {
    throw new Error("Dealius API key is not configured in admin Settings.");
  }
  if (!cfg.baseUrl) {
    throw new Error("Dealius base URL is not configured in admin Settings.");
  }

  const headers = new Headers(incomingHeaders ?? {});
  headers.set("X-API-KEY", cfg.apiKey);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(buildDealiusUrl(cfg.baseUrl, path), {
    ...rest,
    headers,
  });
}
