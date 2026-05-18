import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Toggle } from "../design/index.jsx";

const MASKED_SECRET = "•••••••• (set)";

type GroupedSettings = Record<string, Record<string, unknown>>;

type Props = {
  grouped: GroupedSettings | null;
  onSavedRefresh: () => Promise<void> | void;
};

function getDeep(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

async function adminJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers: HeadersInit = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers as Record<string, string>),
  };
  const r = await fetch(path, { credentials: "include", ...init, headers });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: b?.error?.message ?? r.statusText ?? "Request failed" };
  return { ok: true, data: b as T };
}

export default function DealiusApiPanel({ grouped, onSavedRefresh }: Props) {
  const settings = useMemo(() => {
    const int = grouped?.integrations ?? {};
    return {
      enabled: Boolean(getDeep(int, ["dealius_api", "enabled"])),
      baseUrl: String(getDeep(int, ["dealius_api", "base_url"]) ?? "https://leenewportbeach.dealius.com"),
      apiKeySet: getDeep(int, ["dealius_api", "api_key"]) === MASKED_SECRET,
      lastTestAt: getDeep(int, ["dealius_api", "last_test_at"]) as string | null | undefined,
      lastTestResult: getDeep(int, ["dealius_api", "last_test_result"]) as string | null | undefined,
    };
  }, [grouped]);

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing">("idle");
  const [lastTestDetail, setLastTestDetail] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setEnabled(settings.enabled);
  }, [settings.baseUrl, settings.enabled]);

  async function save() {
    setBusy("saving");
    const body: Record<string, unknown> = {
      "integrations.dealius_api.base_url": baseUrl.trim(),
      "integrations.dealius_api.enabled": enabled,
    };
    if (apiKey.trim().length > 0) {
      body["integrations.dealius_api.api_key"] = apiKey;
    }
    const r = await adminJson("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
    setBusy("idle");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setApiKey("");
    toast.success("Dealius API settings saved.");
    await onSavedRefresh();
  }

  async function testConnection() {
    setBusy("testing");
    const r = await adminJson<{ ok: boolean; status: number; error?: string; listingTypes?: unknown }>(
      "/api/admin/dealius/test",
      { method: "POST", body: JSON.stringify({}) }
    );
    setBusy("idle");
    if (!r.ok) {
      toast.error(r.error);
      setLastTestDetail(r.error);
      return;
    }
    if (r.data.ok) {
      const count = Array.isArray(r.data.listingTypes) ? r.data.listingTypes.length : 0;
      const msg = `Connected to Dealius — received ${count} listing type${count === 1 ? "" : "s"}.`;
      toast.success(msg);
      setLastTestDetail(msg);
    } else {
      const msg = `Dealius test failed (HTTP ${r.data.status}): ${r.data.error ?? "unknown error"}`;
      toast.error(msg);
      setLastTestDetail(msg);
    }
    await onSavedRefresh();
  }

  const lastTestLabel = settings.lastTestAt
    ? new Date(String(settings.lastTestAt)).toLocaleString()
    : "—";

  return (
    <Card padding="lg" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Dealius API</div>
          <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4, maxWidth: 640 }}>
            REST API integration used for bulk import, lookup tables, and direct pushes to Dealius. The key is
            stored encrypted at rest and sent as the <code>X-API-KEY</code> header on each request.
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-600)" }}>
            Last test: {lastTestLabel}{" "}
            {settings.lastTestResult ? `(${settings.lastTestResult})` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <Toggle on={enabled} onClick={() => setEnabled(v => !v)} />
          <span style={{ fontSize: 11, color: "var(--ink-500)" }}>{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Field label="Base URL">
          <Input
            value={baseUrl}
            onChange={(e: any) => setBaseUrl(e.target.value)}
            placeholder="https://leenewportbeach.dealius.com"
          />
        </Field>
        <Field
          label={
            settings.apiKeySet
              ? "API Key (••••••• saved — leave blank to keep)"
              : "API Key"
          }
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e: any) => setApiKey(e.target.value)}
              placeholder={settings.apiKeySet ? MASKED_SECRET : "Paste Dealius API key"}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowKey(v => !v)}>
              {showKey ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button type="button" variant="primary" disabled={busy !== "idle"} onClick={() => void save()}>
          {busy === "saving" ? "Saving…" : "Save settings"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== "idle"} onClick={() => void testConnection()}>
          {busy === "testing" ? "Testing…" : "Test connection"}
        </Button>
      </div>

      {lastTestDetail && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--ink-200)",
            background: "var(--ink-50)",
            fontSize: 12,
            color: "var(--ink-700)",
          }}
        >
          {lastTestDetail}
        </div>
      )}
    </Card>
  );
}
