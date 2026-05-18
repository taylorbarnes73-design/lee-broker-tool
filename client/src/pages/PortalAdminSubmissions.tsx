import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";

type SubmissionSummary = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  queuePosition: number | null;
};

export default function PortalAdminSubmissions() {
  const { user } = useAuth();
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortByQueue, setSortByQueue] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let alive = true;
    const params = new URLSearchParams({ limit: "200", includeQueue: "1" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/submissions?${params.toString()}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load submissions");
        setItems(b?.data ?? []);
      })
      .catch(e => {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
      });
    return () => {
      alive = false;
    };
  }, [user?.role, statusFilter]);

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="admin-submissions"
        title="Admin Queue"
        description="Admin access is required to review all broker submissions."
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
      section="admin-submissions"
      title="Admin Queue"
      description="Review broker submissions, filter the queue, and open a detail workspace for deal submission."
      actions={
        <Link href="/portal">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      }
    >

      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by user name or email…"
              style={{
                width: 340,
                maxWidth: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ink-200)",
                background: "white",
                fontSize: 13,
              }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ink-200)",
                background: "white",
                fontSize: 13,
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">pending</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
            <Button variant={sortByQueue ? "primary" : "secondary"} onClick={() => setSortByQueue(v => !v)}>
              Sort by queue
            </Button>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Showing {items.filter(s => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return `${s.submittedBy ?? ""} ${s.submittedByEmail ?? ""}`.toLowerCase().includes(q);
              }).length} of {items.length}
            </div>
          </div>
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No submissions found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items
                .filter(s => {
                  const q = query.trim().toLowerCase();
                  if (!q) return true;
                  return `${s.submittedBy ?? ""} ${s.submittedByEmail ?? ""}`.toLowerCase().includes(q);
                })
                .slice()
                .sort((a, b) => {
                  if (!sortByQueue) return 0;
                  const ap = a.queuePosition ?? Number.POSITIVE_INFINITY;
                  const bp = b.queuePosition ?? Number.POSITIVE_INFINITY;
                  return ap - bp;
                })
                .map(s => (
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
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>
                        #{s.id} · {s.reference || "(untitled)"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                        status: {s.status}
                      </div>
                      {s.queuePosition !== null && (
                        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                          queue: #{s.queuePosition}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                        {s.submittedBy || "(unknown)"} {s.submittedByEmail ? `· ${s.submittedByEmail}` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
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

