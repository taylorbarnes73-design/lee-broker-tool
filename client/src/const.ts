export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

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
