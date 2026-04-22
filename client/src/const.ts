export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const API_BASE_STORAGE_KEY = "lee_api_base_url";

const normalizeApiBase = (raw: string) => {
  let base = raw.trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4);
  return base;
};

export const resolveApiBaseUrl = () => {
  if (typeof window === "undefined") {
    const envBase = import.meta.env.VITE_API_BASE_URL;
    return envBase ? normalizeApiBase(envBase) : "";
  }

  const params = new URLSearchParams(window.location.search);
  const queryBase = params.get("apiBase") ?? "";
  const envBase = import.meta.env.VITE_API_BASE_URL ?? "";
  const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY) ?? "";

  const selected = queryBase || envBase || storedBase;
  if (!selected) return "";

  const normalized = normalizeApiBase(selected);
  if (!normalized) return "";

  if (queryBase) {
    localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
  }

  return normalized;
};

export const buildApiUrl = (path: string) => {
  const base = resolveApiBaseUrl();
  return base ? `${base}${path}` : path;
};

export const hasOAuthLoginConfig = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  return Boolean(oauthPortalUrl && appId);
};

export const isAuthRedirectEnabled = () => {
  const flag = import.meta.env.VITE_ENABLE_AUTH_REDIRECT;

  if (flag === "true") return true;
  if (flag === "false") return false;

  return hasOAuthLoginConfig();
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  if (!hasOAuthLoginConfig()) return "";

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
