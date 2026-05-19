import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Card } from "../design/index.jsx";
import { useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { brokerAdminStatusTone, formatBrokerAdminStatus } from "@/lib/format";

type Attachment = {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
  fileKey: string;
  category: string;
  createdAt: string;
};

type RequestRecord = any;

const CONFIDENTIAL_TONE = { bg: "#F6E8EE", fg: "#7C2257", border: "#E6CFDC" };

export default function PortalBrokerAdminRequestDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/admin/broker-admin/:id");
  const id = Number(params?.id);
  const [data, setData] = useState<{ request: RequestRecord; attachments: Attachment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setData(b?.data ?? null);
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

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="broker-admin"
        title="Broker Admin"
        description="Admin access is required."
        actions={
          <LinkButton href="/portal" variant="secondary">
            Back to dashboard
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
      section="broker-admin"
      title={title}
      description="View the stored email metadata and attachments captured from the shared mailbox."
      actions={
        <div style={{ display: "flex", gap: 10 }}>
          <LinkButton href="/portal/admin/broker-admin" variant="secondary">
            Back
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
