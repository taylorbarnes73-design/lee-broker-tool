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
      throw new Error("Dealius credentials not configured. Set DEALIUS_EMAIL/DEALIUS_PASSWORD.");
    }

    const res = await this.http.post<DealiusAuthResponse>("/api/account/authenticate", {
      Email: email,
      Password: password,
    });

    const token = res.data?.Token ?? res.data?.token;
    if (!token) throw new Error("Dealius auth succeeded but returned no Token.");
    return token;
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
  const list = [...byBrokerId.values()];
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

