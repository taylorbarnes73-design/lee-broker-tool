import axios, { type AxiosInstance } from "axios";
import { ENV } from "../_core/env";
import { directoryHintsForBrokerName, type DealiusDirectoryUser } from "./dealiusUserDirectory";

type DealiusAuthResponse = {
  Token?: string;
  token?: string;
};

type DealiusUploadResult = {
  status: number;
  text: string;
};

export type DealiusClientOptions = {
  baseUrl?: string;
  email?: string;
  password?: string;
};

export class DealiusClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(params?: { baseUrl?: string }) {
    this.baseUrl = (params?.baseUrl ?? ENV.dealiusBaseUrl).replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: { Accept: "application/json" },
      // Dealius sits behind HTTPS; if your environment MITMs or requires custom certs,
      // handle that at the Node runtime/agent level rather than disabling TLS here.
    });
  }

  async authenticate(params?: { email?: string; password?: string }) {
    const email = (params?.email ?? ENV.dealiusEmail).trim();
    const password = (params?.password ?? ENV.dealiusPassword).trim();

    if (!email || !password) {
      // In dev/test environments we still allow a dummy token so unit tests can
      // exercise the push pipeline without real credentials. In production we
      // refuse to silently mock – it has caused admins to think a push
      // succeeded when nothing actually reached Dealius.
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Dealius credentials are not configured. Open Admin → Settings → Integrations and save a Dealius username and password before pushing."
        );
      }
      console.warn("[DealiusClient] Credentials not configured. Using dummy mode.");
      return "dummy-token";
    }

    try {
      const res = await this.http.post<DealiusAuthResponse>("/api/account/authenticate", {
        Email: email,
        Password: password,
      });

      const token = res.data?.Token ?? res.data?.token;
      if (!token) {
        throw new Error("Dealius authentication succeeded but the server returned no token. Verify the credentials are correct.");
      }
      return token;
    } catch (err: unknown) {
      // Re-throw with a friendlier message that surfaces in the admin push UI.
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 403) {
        throw new Error("Dealius rejected the configured credentials (HTTP 401). Re-enter the Dealius username and password in Admin → Settings.");
      }
      if (err instanceof Error && err.message.includes("Dealius authentication")) throw err;
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not authenticate to Dealius: ${detail}`);
    }
  }

  private apiUrl(path: string, token: string) {
    const clean = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
    const sep = clean.includes("?") ? "&" : "?";
    return `${clean}${sep}token=${encodeURIComponent(token)}`;
  }

  async request<T>(params: {
    token: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    data?: unknown;
  }): Promise<{ status: number; data: T }> {
    if (params.token === "dummy-token") {
      console.warn(`[DealiusClient] Mocking request: ${params.method} ${params.path}`);
      return { status: 200, data: (params.path.includes("SearchTerm") ? [] : {}) as any };
    }
    const url = this.apiUrl(params.path, params.token);
    const res = await this.http.request<T>({
      url,
      method: params.method,
      headers: { "Content-Type": "application/json" },
      data: params.data,
      validateStatus: () => true,
    });
    return { status: res.status, data: res.data };
  }

  /**
   * Upload a document to a deal or listing.
   *
   * Dealius endpoints (confirmed in your existing tool):
   * - POST /api/deals/{id}/documents
   * - POST /api/listings/{id}/documents
   *
   * Uses token query param auth for consistency with other API calls.
   */
  async uploadDocument(params: {
    token: string;
    entityType: "deal" | "listing";
    entityId: number | string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    documentType?: string | null;
  }): Promise<DealiusUploadResult> {
    const id = String(params.entityId).trim();
    if (!id) throw new Error("uploadDocument: entityId is required");

    if (params.token === "dummy-token") {
      console.warn(`[DealiusClient] Mocking upload to ${params.entityType} ${id}`);
      return { status: 200, text: "Mock upload success" };
    }

    const path =
      params.entityType === "listing" ? `/listings/${encodeURIComponent(id)}/documents` : `/deals/${encodeURIComponent(id)}/documents`;

    const urlPath = this.apiUrl(path, params.token);
    const url = `${this.baseUrl}${urlPath}`;

    const fd = new FormData();
    // Create a fresh Uint8Array so its backing buffer is a plain ArrayBuffer (not SharedArrayBuffer).
    const bytes = new Uint8Array(params.buffer);
    fd.append("file", new Blob([bytes], { type: params.mimeType || "application/octet-stream" }), params.filename);
    fd.append("Name", params.filename);
    if (params.documentType) fd.append("DocumentType", params.documentType);

    const res = await fetch(url, { method: "POST", body: fd });
    const text = await res.text();
    return { status: res.status, text };
  }
}

export function normName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolveBrokerContactId(params: {
  client: DealiusClient;
  token: string;
  name: string;
  /** Optional Dealius Users export / roster — adds canonical names + emails as search terms and scoring hints. */
  directory?: DealiusDirectoryUser[];
}) {
  const clean = params.name.trim();
  if (!clean) return null;
  const needle = normName(clean);
  const first = needle.split(" ")[0] || needle;

  // Handle "LAST, FIRST" and other punctuation variants.
  const commaParts = clean.split(",").map(s => s.trim()).filter(Boolean);
  const flipped =
    commaParts.length >= 2 ? `${commaParts.slice(1).join(" ")} ${commaParts[0]}`.trim() : "";

  const dirHints = directoryHintsForBrokerName(clean, params.directory ?? []);

  const searchTerms = Array.from(
    new Set(
      [
        clean,
        clean.replace(/,/g, " "),
        flipped,
        flipped.replace(/,/g, " "),
        ...dirHints.searchTerms,
      ]
        .map(s => s.trim())
        .filter(Boolean)
    )
  );

  const all: any[] = [];
  for (const term of searchTerms) {
    const { status, data } = await params.client.request<any>({
      token: params.token,
      method: "GET",
      path: `/brokers?SearchTerm=${encodeURIComponent(term)}&PageSize=50`,
    });
    if (status < 200 || status >= 300) continue;
    const list = Array.isArray(data) ? data : Array.isArray(data?.Data) ? data.Data : [];
    all.push(...list);
    if (all.length >= 50) break;
  }

  const byBrokerId = new Map<number, any>();
  for (const br of all) {
    const rawId = br.ContactID || br.BrokerID || br.ID || br.id;
    const id = typeof rawId === "number" ? rawId : Number.parseInt(String(rawId), 10);
    if (!Number.isFinite(id)) continue;
    if (!byBrokerId.has(id)) byBrokerId.set(id, br);
  }
  const list = Array.from(byBrokerId.values());
  const scored = list
    .map((br: any) => {
      const id = br.ContactID || br.BrokerID || br.ID || br.id || null;
      const full = normName(br.ContactName || br.FullName || br.Name || br.DisplayName || "");
      const brokerEmail = String(br.Email || br.email || "").trim().toLowerCase();
      let score = 0;
      if (full === needle) score += 100;
      if (full.includes(needle)) score += 60;
      if (first && full.includes(first)) score += 20;
      if (brokerEmail && dirHints.boostEmails.has(brokerEmail)) score += 45;
      return { id, score };
    })
    .filter((x: any) => x.id)
    .sort((a: any, b: any) => b.score - a.score);

  return scored[0]?.id ?? null;
}

