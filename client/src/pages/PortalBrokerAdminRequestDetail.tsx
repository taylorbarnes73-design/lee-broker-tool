import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button, Card, Field, Input, Select } from "../design/index.jsx";
import { useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { brokerAdminStatusTone, formatBrokerAdminStatus } from "@/lib/format";
import { toast } from "sonner";

type Attachment = {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
  fileKey: string;
  category: string;
  createdAt: string;
};

type RequestRecord = {
  id: number;
  title?: string | null;
  reference?: string | null;
  status?: string | null;
  owner?: string | null;
  notes?: string | null;
  fromEmail?: string | null;
  confidential?: boolean | number | null;
  docusignEnvelopeId?: string | null;
  dealiusDealId?: string | null;
  dealiusListingId?: string | null;
};

const CONFIDENTIAL_TONE = { bg: "#F6E8EE", fg: "#7C2257", border: "#E6CFDC" };

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_broker", label: "Waiting on broker" },
  { value: "waiting_on_vendor", label: "Waiting on vendor" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export default function PortalBrokerAdminRequestDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/admin/broker-admin/:id");
  const id = Number(params?.id);
  const [data, setData] = useState<{ request: RequestRecord; attachments: Attachment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("new");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (!Number.isFinite(id) || id <= 0) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetch(`/api/broker-admin/requests/${id}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load request");
        const next = b?.data ?? null;
        setData(next);
        if (next?.request) {
          setStatus(String(next.request.status ?? "new"));
          setOwner(String(next.request.owner ?? ""));
          setNotes(String(next.request.notes ?? ""));
        }
        setError(null);
      })
      .catch(e => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.role, id]);

  const title = useMemo(() => {
    if (!data?.request) return "Broker Admin Request";
    return `#${data.request.id} · ${data.request.title || data.request.reference || "Request"}`;
  }, [data]);

  async function handleSaveTriage() {
    if (!Number.isFinite(id) || id <= 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/broker-admin/requests/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          owner: owner.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save");
      setData(prev =>
        prev
          ? {
              ...prev,
              request: {
                ...prev.request,
                status,
                owner: owner.trim() || null,
                notes: notes.trim() || null,
              },
            }
          : prev
      );
      toast.success("Request updated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="submissions"
        title="Broker Admin"
        description="Admin access is required."
        actions={
          <LinkButton href="/portal/submissions" variant="secondary">
            Back to submissions
          </LinkButton>
        }
      >
        <Card padding="lg">
          <div style={{ color: "var(--err-700)", fontSize: 13 }}>Admin access required.</div>
        </Card>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell
      section="submissions"
      title={title}
      description="View the stored email metadata and attachments captured from the shared mailbox."
      actions={
        <div style={{ display: "flex", gap: 10 }}>
          <LinkButton href="/portal/submissions" variant="secondary">
            Back to submissions
          </LinkButton>
        </div>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Card padding="lg">
          {loading ? (
            <div
              aria-hidden
              style={{
                height: 96,
                borderRadius: 10,
                background: "var(--ink-100)",
                border: "1px solid var(--ink-200)",
              }}
            />
          ) : error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : !data ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Request not found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusBadge tone={brokerAdminStatusTone(data.request.status)}>
                  {formatBrokerAdminStatus(data.request.status)}
                </StatusBadge>
                {data.request.owner && (
                  <span style={{ fontSize: 13, color: "var(--ink-700)" }}>
                    Owner: <b>{data.request.owner}</b>
                  </span>
                )}
                {data.request.confidential ? (
                  <StatusBadge tone={CONFIDENTIAL_TONE}>Confidential</StatusBadge>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
                <b>From</b>: {data.request.fromEmail || "(unknown)"}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
                <b>Reference</b>: {data.request.reference || "(none)"}
              </div>
              {data.request.docusignEnvelopeId && (
                <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
                  <b>DocuSign envelope</b>: {data.request.docusignEnvelopeId}
                </div>
              )}
              {(data.request.dealiusDealId || data.request.dealiusListingId) && (
                <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
                  <b>Dealius</b>: {data.request.dealiusDealId ? `deal ${data.request.dealiusDealId}` : ""}{" "}
                  {data.request.dealiusListingId ? `listing ${data.request.dealiusListingId}` : ""}
                </div>
              )}
            </div>
          )}
        </Card>

        {!loading && data ? (
          <Card padding="lg">
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)", marginBottom: 12 }}>Triage</div>
            <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              <Field label="Status">
                <Select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </Field>
              <Field label="Owner">
                <Input
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="Assignee name or username"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Internal notes for the admin team"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--ink-300)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </Field>
              {saveError ? (
                <div role="alert" style={{ color: "var(--err-700)", fontSize: 13 }}>
                  {saveError}
                </div>
              ) : null}
              <div>
                <Button onClick={handleSaveTriage} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card padding="lg">
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)", marginBottom: 10 }}>Attachments</div>
          {loading ? (
            <div
              aria-hidden
              style={{
                height: 72,
                borderRadius: 10,
                background: "var(--ink-100)",
                border: "1px solid var(--ink-200)",
              }}
            />
          ) : !data ? null : data.attachments.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 10,
                border: "1px dashed var(--ink-300)",
                background: "var(--ink-50)",
                color: "var(--ink-600)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No attachments stored for this request.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.attachments.map(a => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid var(--ink-200)",
                      background: "white",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "var(--ink-900)", fontSize: 13 }}>{a.filename}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{a.category}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
