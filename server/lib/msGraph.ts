import { ensureSettingsCache } from "../settings/settingsStore";

export type GraphAddress = { name?: string | null; address?: string | null };

export type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  subject?: string | null;
  from?: { emailAddress?: GraphAddress } | null;
  toRecipients?: Array<{ emailAddress?: GraphAddress }> | null;
  ccRecipients?: Array<{ emailAddress?: GraphAddress }> | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string } | null;
  webLink?: string | null;
  hasAttachments?: boolean | null;
  conversationId?: string | null;
};

export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

export class GraphAuthError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "GraphAuthError";
    this.status = status;
  }
}

export class GraphRequestError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "GraphRequestError";
    this.status = status;
    this.body = body;
  }
}

type CachedToken = { token: string; expiresAt: number; key: string };
let tokenCache: CachedToken | null = null;

function envOverride(key: string): string | undefined {
  const v = process.env[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/**
 * Load Graph credentials, with settings-table values taking precedence over env vars.
 * Returns null if any required field is missing.
 */
export async function loadGraphConfig(): Promise<GraphConfig | null> {
  const merged = await ensureSettingsCache();
  const tenant =
    (merged.get("integrations.broker_admin_ingest.tenant_id") as string)?.trim() ||
    envOverride("MS_GRAPH_TENANT_ID") ||
    "";
  const client =
    (merged.get("integrations.broker_admin_ingest.client_id") as string)?.trim() ||
    envOverride("MS_GRAPH_CLIENT_ID") ||
    "";
  const secret =
    (merged.get("integrations.broker_admin_ingest.client_secret") as string) ||
    envOverride("MS_GRAPH_CLIENT_SECRET") ||
    "";
  if (!tenant || !client || !secret) return null;
  return { tenantId: tenant, clientId: client, clientSecret: secret };
}

export async function loadMailboxAddress(): Promise<string> {
  const merged = await ensureSettingsCache();
  const v = (merged.get("integrations.broker_admin_ingest.mailbox") as string)?.trim();
  return v || "_NewportBeach-BrokerAdmin@lee-associates.com";
}

export async function loadIngestEnabled(): Promise<boolean> {
  const merged = await ensureSettingsCache();
  return Boolean(merged.get("integrations.broker_admin_ingest.enabled"));
}

export function clearGraphTokenCache(): void {
  tokenCache = null;
}

async function fetchAccessToken(cfg: GraphConfig): Promise<string> {
  const key = `${cfg.tenantId}:${cfg.clientId}:${cfg.clientSecret.length}`;
  const now = Date.now();
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt - 5 * 60 * 1000 > now) {
    return tokenCache.token;
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GraphAuthError(
      `Graph token request failed: ${res.status} ${res.statusText}. ${text.slice(0, 400)}`,
      res.status
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new GraphAuthError("Graph token response missing access_token.");
  }
  const ttlMs = (json.expires_in ?? 3600) * 1000;
  tokenCache = { token: json.access_token, expiresAt: now + ttlMs, key };
  return json.access_token;
}

async function graphRequest(
  cfg: GraphConfig,
  url: string,
  init?: { method?: string; body?: string }
): Promise<Response> {
  const token = await fetchAccessToken(cfg);
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body,
  });
  if (res.status === 401 || res.status === 403) {
    clearGraphTokenCache();
    const text = await res.text().catch(() => "");
    throw new GraphAuthError(
      `Graph ${res.status}: ${res.statusText}. Likely missing Graph application permission or admin consent. ${text.slice(0, 400)}`,
      res.status
    );
  }
  return res;
}

async function graphGet(cfg: GraphConfig, url: string): Promise<any> {
  const res = await graphRequest(cfg, url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GraphRequestError(
      `Graph request failed: ${res.status} ${res.statusText}`,
      res.status,
      text.slice(0, 1000)
    );
  }
  return res.json();
}

export type GraphMailAttachment = {
  filename: string;
  mimeType: string;
  base64Data: string;
};

export type GraphSendMailParams = {
  mailbox: string;
  to: string[];
  cc?: string[];
  subject: string;
  content: string;
  attachments?: GraphMailAttachment[];
};

/**
 * Send outbound mail via Microsoft Graph from a shared mailbox.
 * Requires Mail.Send application permission on the Azure AD app.
 */
export async function sendGraphMail(
  cfg: GraphConfig,
  params: GraphSendMailParams
): Promise<void> {
  const toRecipients = params.to.map(address => ({
    emailAddress: { address },
  }));
  const ccRecipients = (params.cc ?? []).map(address => ({
    emailAddress: { address },
  }));
  const attachments = (params.attachments ?? []).map(file => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: file.filename,
    contentType: file.mimeType,
    contentBytes: file.base64Data,
  }));

  const body = JSON.stringify({
    message: {
      subject: params.subject,
      body: {
        contentType: "Text",
        content: params.content,
      },
      toRecipients,
      ...(ccRecipients.length ? { ccRecipients } : {}),
      ...(attachments.length ? { attachments } : {}),
    },
    saveToSentItems: true,
  });

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(params.mailbox)}/sendMail`;
  const res = await graphRequest(cfg, url, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GraphRequestError(
      `Graph sendMail failed: ${res.status} ${res.statusText}`,
      res.status,
      text.slice(0, 1000)
    );
  }
}

const MESSAGE_SELECT =
  "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,webLink,hasAttachments,conversationId";

export type ListMessagesOptions = {
  mailbox: string;
  since?: Date | string | null;
  top?: number;
  /** Hard cap across pagination. Defaults to 200. */
  maxResults?: number;
};

export async function listSharedMailboxMessages(
  cfg: GraphConfig,
  opts: ListMessagesOptions
): Promise<GraphMessage[]> {
  const top = Math.min(Math.max(opts.top ?? 50, 1), 100);
  const cap = Math.max(opts.maxResults ?? 200, 1);
  const sinceIso =
    opts.since instanceof Date
      ? opts.since.toISOString()
      : typeof opts.since === "string" && opts.since
        ? new Date(opts.since).toISOString()
        : null;

  const params = new URLSearchParams();
  if (sinceIso) params.set("$filter", `receivedDateTime ge ${sinceIso}`);
  params.set("$top", String(top));
  params.set("$orderby", "receivedDateTime desc");
  params.set("$select", MESSAGE_SELECT);
  let url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(opts.mailbox)}/messages?${params.toString()}`;

  const collected: GraphMessage[] = [];
  while (url && collected.length < cap) {
    const page = await graphGet(cfg, url);
    const values: GraphMessage[] = Array.isArray(page?.value) ? page.value : [];
    for (const v of values) {
      collected.push(v);
      if (collected.length >= cap) break;
    }
    url = typeof page?.["@odata.nextLink"] === "string" ? page["@odata.nextLink"] : "";
  }
  return collected;
}

export type GraphAttachment = {
  id: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
  isInline?: boolean | null;
  contentBytes?: string | null;
};

export async function listMessageAttachments(
  cfg: GraphConfig,
  opts: { mailbox: string; messageId: string }
): Promise<GraphAttachment[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(opts.mailbox)}/messages/${encodeURIComponent(opts.messageId)}/attachments`;
  const page = await graphGet(cfg, url);
  return Array.isArray(page?.value) ? (page.value as GraphAttachment[]) : [];
}

/** Quick connectivity check used by the admin "Test connection" button. */
export async function testGraphConnection(): Promise<{ success: boolean; message: string; sample?: { count: number; firstSubject: string | null } }> {
  const cfg = await loadGraphConfig();
  if (!cfg) {
    return { success: false, message: "Tenant ID, Client ID, and Client Secret must all be set." };
  }
  const mailbox = await loadMailboxAddress();
  try {
    const messages = await listSharedMailboxMessages(cfg, { mailbox, top: 1, maxResults: 1 });
    return {
      success: true,
      message: `Connected. Found ${messages.length} recent message(s) in ${mailbox}.`,
      sample: { count: messages.length, firstSubject: messages[0]?.subject ?? null },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}
