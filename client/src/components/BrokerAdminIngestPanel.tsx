import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Toggle } from "../design/index.jsx";

const MASKED_SECRET = "•••••••• (set)";

type GroupedSettings = Record<string, Record<string, unknown>>;

type IngestStatus = {
  enabled: boolean;
  configured: boolean;
  mailbox: string;
  lastPoll: string | null;
  counts: { imported24h: number; duplicates24h: number; errors24h: number };
  recentErrors: Array<{ id: number; createdAt: string; subject: string | null; error: string | null }>;
  recent: Array<{ id: number; createdAt: string; subject: string | null; ingestStatus: string; submissionId: number | null }>;
};

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

export default function BrokerAdminIngestPanel({ grouped, onSavedRefresh }: Props) {
  const ingestSettings = useMemo(() => {
    const int = grouped?.integrations ?? {};
    return {
      enabled: Boolean(getDeep(int, ["broker_admin_ingest", "enabled"])),
      mailbox: String(getDeep(int, ["broker_admin_ingest", "mailbox"]) ?? ""),
      tenantId: String(getDeep(int, ["broker_admin_ingest", "tenant_id"]) ?? ""),
      clientId: String(getDeep(int, ["broker_admin_ingest", "client_id"]) ?? ""),
      clientSecretSet: getDeep(int, ["broker_admin_ingest", "client_secret"]) === MASKED_SECRET,
      lastTestAt: getDeep(int, ["broker_admin_ingest", "last_test_at"]) as string | null | undefined,
      lastTestResult: getDeep(int, ["broker_admin_ingest", "last_test_result"]) as string | null | undefined,
    };
  }, [grouped]);

  const [mailbox, setMailbox] = useState(ingestSettings.mailbox);
  const [tenantId, setTenantId] = useState(ingestSettings.tenantId);
  const [clientId, setClientId] = useState(ingestSettings.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(ingestSettings.enabled);
  const [busy, setBusy] = useState<"idle" | "saving" | "testing" | "running">("idle");
  const [status, setStatus] = useState<IngestStatus | null>(null);

  useEffect(() => {
    setMailbox(ingestSettings.mailbox);
    setTenantId(ingestSettings.tenantId);
    setClientId(ingestSettings.clientId);
    setEnabled(ingestSettings.enabled);
  }, [ingestSettings.mailbox, ingestSettings.tenantId, ingestSettings.clientId, ingestSettings.enabled]);

  const loadStatus = useCallback(async () => {
    const r = await adminJson<IngestStatus>("/api/admin/ingest/brokerAdmin/status");
    if (r.ok) setStatus(r.data);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function save() {
    setBusy("saving");
    const body: Record<string, unknown> = {
      "integrations.broker_admin_ingest.mailbox": mailbox.trim(),
      "integrations.broker_admin_ingest.tenant_id": tenantId.trim(),
      "integrations.broker_admin_ingest.client_id": clientId.trim(),
      "integrations.broker_admin_ingest.enabled": enabled,
    };
    if (clientSecret.trim().length > 0) {
      body["integrations.broker_admin_ingest.client_secret"] = clientSecret;
    }
    const r = await adminJson("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
    setBusy("idle");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setClientSecret("");
    toast.success("BrokerAdmin ingest settings saved.");
    await onSavedRefresh();
  }

  async function testConnection() {
    setBusy("testing");
    const r = await adminJson<{ success: boolean; message: string }>(
      "/api/admin/ingest/brokerAdmin/test",
      { method: "POST", body: JSON.stringify({}) }
    );
    setBusy("idle");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (r.data.success) toast.success(r.data.message);
    else toast.error(r.data.message);
    await onSavedRefresh();
    await loadStatus();
  }

  async function runNow() {
    setBusy("running");
    const r = await adminJson<{ imported: number; skipped: number; errors: number; lastPoll: string | null; errorMessages: string[] }>(
      "/api/admin/ingest/brokerAdmin/run",
      { method: "POST", body: JSON.stringify({}) }
    );
    setBusy("idle");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const msg = `Imported ${r.data.imported}, skipped ${r.data.skipped}, errors ${r.data.errors}.`;
    if (r.data.errors > 0) toast.error(msg + (r.data.errorMessages[0] ? " " + r.data.errorMessages[0] : ""));
    else toast.success(msg);
    await loadStatus();
  }

  const lastTestLabel = ingestSettings.lastTestAt
    ? new Date(String(ingestSettings.lastTestAt)).toLocaleString()
    : "—";

  return (
    <Card padding="lg" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Email Ingest — BrokerAdmin shared mailbox</div>
          <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4, maxWidth: 640 }}>
            Polls the BrokerAdmin shared mailbox every 5 minutes via Microsoft Graph and creates submissions in the
            admin queue. Auth uses an Azure AD app registration with the Mail.Read application permission.
            See{" "}
            <a href="/docs/azure-graph-setup.md" target="_blank" rel="noreferrer" style={{ color: "var(--lee-crimson)", fontWeight: 600 }}>
              setup guide
            </a>
            .
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-600)" }}>
            Last test: {lastTestLabel}{" "}
            {ingestSettings.lastTestResult ? `(${ingestSettings.lastTestResult})` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <Toggle on={enabled} onClick={() => setEnabled(v => !v)} />
          <span style={{ fontSize: 11, color: "var(--ink-500)" }}>{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Field label="Mailbox address">
          <Input
            value={mailbox}
            onChange={(e: any) => setMailbox(e.target.value)}
            placeholder="_NewportBeach-BrokerAdmin@lee-associates.com"
          />
        </Field>
        <Field label="Tenant ID (Directory)">
          <Input value={tenantId} onChange={(e: any) => setTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        </Field>
        <Field label="Client ID (Application)">
          <Input value={clientId} onChange={(e: any) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
        </Field>
        <Field
          label={
            ingestSettings.clientSecretSet
              ? "Client Secret (••••••• saved — leave blank to keep)"
              : "Client Secret"
          }
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e: any) => setClientSecret(e.target.value)}
              placeholder={ingestSettings.clientSecretSet ? MASKED_SECRET : "Paste secret VALUE"}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecret(v => !v)}>
              {showSecret ? "Hide" : "Show"}
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
        <Button type="button" variant="secondary" disabled={busy !== "idle"} onClick={() => void runNow()}>
          {busy === "running" ? "Running…" : "Run now"}
        </Button>
      </div>

      {status && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid var(--ink-200)", background: "var(--ink-50)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
            <span><strong>Configured:</strong> {status.configured ? "yes" : "no"}</span>
            <span><strong>Enabled:</strong> {status.enabled ? "yes" : "no"}</span>
            <span><strong>Mailbox:</strong> {status.mailbox}</span>
            <span><strong>Last poll:</strong> {status.lastPoll ? new Date(status.lastPoll).toLocaleString() : "—"}</span>
          </div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
            <span><strong>Imported (24h):</strong> {status.counts.imported24h}</span>
            <span><strong>Duplicates (24h):</strong> {status.counts.duplicates24h}</span>
            <span><strong>Errors (24h):</strong> {status.counts.errors24h}</span>
          </div>
          {status.recentErrors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)", marginBottom: 6 }}>Recent errors</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-700)" }}>
                {status.recentErrors.map(e => (
                  <li key={e.id} style={{ marginBottom: 4 }}>
                    <span style={{ color: "var(--ink-500)" }}>{new Date(e.createdAt).toLocaleString()}</span>{" "}
                    {e.subject ? <strong>{e.subject}</strong> : <em>(no subject)</em>}
                    {e.error ? ` — ${e.error}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
