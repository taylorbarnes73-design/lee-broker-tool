import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card } from "../design/index.jsx";
import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";

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

export default function PortalBrokerAdminRequestDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/admin/broker-admin/:id");
  const id = Number(params?.id);
  const [data, setData] = useState<{ request: RequestRecord; attachments: Attachment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (!Number.isFinite(id) || id <= 0) return;

    let alive = true;
    fetch(`/api/broker-admin/requests/${id}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load request");
        setData(b?.data ?? null);
      })
      .catch(e => {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
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
          <Link href="/portal">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
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
          <Link href="/portal/admin/broker-admin">
            <Button variant="secondary">Back</Button>
          </Link>
        </div>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Card padding="lg">
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : !data ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, color: "var(--ink-700)" }}>
                <b>Status</b>: {data.request.status} {data.request.owner ? `· owner: ${data.request.owner}` : ""}
                {data.request.confidential ? " · confidential" : ""}
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
          {!data ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading…</div>
          ) : data.attachments.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No attachments stored for this request.</div>
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

