import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
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
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  queuePosition: number | null;
  source?: string | null;
  sourceEmailWebLink?: string | null;
};

const INPUT_STYLE = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--ink-200)",
  background: "white",
  fontSize: 13,
  color: "var(--ink-900)",
} as const;

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
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

export default function PortalAdminSubmissions() {
  const { user } = useAuth();
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [formTypeFilter, setFormTypeFilter] = useState<string>("");
  const [sortByQueue, setSortByQueue] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: "200", includeQueue: "1" });
    if (statusFilter) params.set("status", statusFilter);
    if (formTypeFilter) params.set("formType", formTypeFilter);
    fetch(`/api/submissions?${params.toString()}`, { credentials: "include" })
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
  }, [user?.role, statusFilter, formTypeFilter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter(s =>
          `${s.submittedBy ?? ""} ${s.submittedByEmail ?? ""} ${s.reference ?? ""}`
            .toLowerCase()
            .includes(q)
        );
    if (!sortByQueue) return filtered;
    return [...filtered].sort((a, b) => {
      const ap = a.queuePosition ?? Number.POSITIVE_INFINITY;
      const bp = b.queuePosition ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });
  }, [items, query, sortByQueue]);

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="admin-submissions"
        title="Admin Queue"
        description="Admin access is required to review all broker submissions."
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
      section="admin-submissions"
      title="Admin queue"
      description="Review broker submissions, filter the queue, and open a detail workspace for deal submission."
      actions={
        <LinkButton href="/portal" variant="secondary">
          Back to dashboard
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by name, email, or reference…"
              style={{
                ...INPUT_STYLE,
                width: 340,
                maxWidth: "100%",
              }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={INPUT_STYLE}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_review">In review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={formTypeFilter} onChange={e => setFormTypeFilter(e.target.value)} style={INPUT_STYLE}>
              <option value="">All types</option>
              <option value="voucher">Commission voucher</option>
              <option value="listing">Listing</option>
              <option value="sign">Sign request</option>
              <option value="lease">Lease</option>
              <option value="sale">Sale</option>
            </select>
            <Button
              variant={sortByQueue ? "primary" : "secondary"}
              onClick={() => setSortByQueue(v => !v)}
            >
              Sort by queue
            </Button>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>
              Showing {visible.length} of {items.length}
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed var(--ink-300)",
                background: "var(--ink-50)",
                textAlign: "center",
                color: "var(--ink-600)",
                fontSize: 13,
              }}
            >
              No submissions match the current filters.
            </div>
          ) : visible.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed var(--ink-300)",
                background: "var(--ink-50)",
                textAlign: "center",
                color: "var(--ink-600)",
                fontSize: 13,
              }}
            >
              No submissions match the current search.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map(s => (
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
                      <StatusBadge
                        tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }}
                        size="sm"
                      >
                        {formatFormType(s.formType)}
                      </StatusBadge>
                      {(s.source === "email_ingest" || s.source === "email_ingest_backfill") && (
                        <span
                          title={s.source === "email_ingest_backfill" ? "Imported from backfill" : "Imported from BrokerAdmin email"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid #BCD6EF",
                            background: "#E6F0FA",
                            color: "#1F4F8B",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                          onClick={e => {
                            if (s.sourceEmailWebLink) {
                              e.preventDefault();
                              window.open(s.sourceEmailWebLink, "_blank", "noopener");
                            }
                          }}
                        >
                          ✉ Email
                        </span>
                      )}
                      {s.queuePosition !== null && (
                        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                          Queue position #{s.queuePosition}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 6 }}>
                      {s.submittedBy || "(unknown)"} {s.submittedByEmail ? `· ${s.submittedByEmail}` : ""}
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
