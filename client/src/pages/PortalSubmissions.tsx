import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Card } from "../design/index.jsx";
import {
  formatFormType,
  formatSubmissionStatus,
  submissionStatusTone,
} from "@/lib/format";

type SubmissionSummary = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  createdAt: string;
  queuePosition: number | null;
};

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          aria-hidden
          style={{
            height: 72,
            borderRadius: 10,
            background: "var(--ink-100)",
            border: "1px solid var(--ink-200)",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 28,
        borderRadius: 12,
        border: "1px dashed var(--ink-300)",
        background: "var(--ink-50)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)" }}>No submissions yet</div>
      <div style={{ fontSize: 13, color: "var(--ink-600)", marginTop: 6, marginBottom: 14 }}>
        Build a voucher, listing, or sign request in the broker tool, then send it to admin to populate this queue.
      </div>
      <LinkButton href="/" variant="primary">
        Open broker tool
      </LinkButton>
    </div>
  );
}

export default function PortalSubmissions() {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/submissions?limit=100&includeQueue=1", { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load submissions");
        setItems(b?.data ?? []);
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
  }, []);

  return (
    <AdminPortalShell
      section="my-submissions"
      title="My submissions"
      description="Track broker submissions, queue position, and submitted deal packages."
      actions={
        <LinkButton href="/portal" variant="secondary">
          Back to dashboard
        </LinkButton>
      }
    >
      <div className="admin-portal-card">
        <Card padding="lg">
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(s => (
                <Link
                  key={s.id}
                  href={`/portal/submissions/${s.id}`}
                  style={{
                    textDecoration: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--ink-200)",
                    background: "white",
                    color: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>
                      #{s.id} · {s.reference || "(untitled)"}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <StatusBadge tone={submissionStatusTone(s.status)} size="sm">
                        {formatSubmissionStatus(s.status)}
                      </StatusBadge>
                      <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{formatFormType(s.formType)}</span>
                      {s.queuePosition !== null && (
                        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                          Queue position #{s.queuePosition}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
