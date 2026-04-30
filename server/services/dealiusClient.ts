import axios, { type AxiosInstance } from "axios";
import { ENV } from "../_core/env";

type DealiusAuthResponse = {
  Token?: string;
  token?: string;
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
}) {
  const clean = params.name.trim();
  if (!clean) return null;
  const needle = normName(clean);
  const first = needle.split(" ")[0] || needle;

  const { status, data } = await params.client.request<any>({
    token: params.token,
    method: "GET",
    path: `/brokers?SearchTerm=${encodeURIComponent(clean)}&PageSize=10`,
  });

  if (status < 200 || status >= 300) return null;

  const list = Array.isArray(data) ? data : Array.isArray(data?.Data) ? data.Data : [];
  const scored = list
    .map((br: any) => {
      const id = br.ContactID || br.BrokerID || br.ID || br.id || null;
      const full = normName(br.ContactName || br.FullName || br.Name || br.DisplayName || "");
      let score = 0;
      if (full === needle) score += 100;
      if (full.includes(needle)) score += 60;
      if (first && full.includes(first)) score += 20;
      return { id, score };
    })
    .filter((x: any) => x.id)
    .sort((a: any, b: any) => b.score - a.score);

  return scored[0]?.id ?? null;
}

