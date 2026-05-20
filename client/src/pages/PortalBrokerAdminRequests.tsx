import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Card } from "../design/index.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { brokerAdminStatusTone, formatBrokerAdminStatus } from "@/lib/format";

type BrokerAdminRequestRow = {
  id: number;
  title: string;
  status: string;
  owner: string | null;
  category: string | null;
  confidential: number;
  fromEmail: string | null;
  receivedAt: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentsSummary: string | null;
};

const INPUT_STYLE = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--ink-200)",
  background: "white",
  fontSize: 13,
  color: "var(--ink-900)",
} as const;

const CONFIDENTIAL_TONE = { bg: "#F6E8EE", fg: "#7C2257", border: "#E6CFDC" };

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

export default function PortalBrokerAdminRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState<BrokerAdminRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stats, setStats] = useState<{
    counts: Array<{ status: string; count: number }>;
    staleCount: number;
    staleDays: number;
  } | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (statusFilter) params.set("status", statusFilter);
    if (ownerFilter) params.set("owner", ownerFilter);
    if (q.trim()) params.set("q", q.trim());

    fetch(`/api/broker-admin/requests?${params.toString()}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load Broker Admin requests");
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

    fetch(`/api/broker-admin/stats?staleDays=3`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) return;
        setStats({
          counts: b?.data?.counts ?? [],
          staleCount: Number(b?.data?.staleCount ?? 0) || 0,
          staleDays: Number(b?.data?.staleDays ?? 3) || 3,
        });
      })
      .catch(() => {
        // ignore
      });

    return () => {
      alive = false;
    };
  }, [user?.role, statusFilter, ownerFilter, q]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(r => `${r.title ?? ""} ${r.fromEmail ?? ""} ${r.reference ?? ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      if (row.owner && row.owner.trim()) set.add(row.owner.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="submissions"
        title="Broker Admin"
        description="Admin access is required to view broker admin inbox requests."
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
      section="submissions"
      title="Broker Admin"
      description="Shared inbox requests captured from email. Triage, track, and open detail to view attachments."
      actions={
        <LinkButton href="/portal" variant="secondary">
          Back to dashboard
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          {stats && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {stats.counts
                .slice()
                .sort((a, b) => (a.status > b.status ? 1 : -1))
                .map(c => (
                  <StatusBadge key={c.status} tone={brokerAdminStatusTone(c.status)}>
                    {formatBrokerAdminStatus(c.status)}: {c.count}
                  </StatusBadge>
                ))}
              <StatusBadge tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }}>
                Stale ({stats.staleDays}d): {stats.staleCount}
              </StatusBadge>
            </div>
          )}

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
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search title, from, reference…"
              style={{
                ...INPUT_STYLE,
                width: 340,
                maxWidth: "100%",
              }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={INPUT_STYLE}>
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="triaged">Triaged</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_on_broker">Waiting on broker</option>
              <option value="waiting_on_vendor">Waiting on vendor</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={INPUT_STYLE}>
              <option value="">All owners</option>
              {ownerOptions.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value="Unassigned">Unassigned</option>
            </select>
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
              No broker admin requests captured yet.
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
              No requests match the current filters.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map(r => (
                <Link
                  key={r.id}
                  href={`/portal/admin/broker-admin/${r.id}`}
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
                      #{r.id} · {r.title || r.reference || "(untitled)"}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <StatusBadge tone={brokerAdminStatusTone(r.status)} size="sm">
                        {formatBrokerAdminStatus(r.status)}
                      </StatusBadge>
                      {r.owner && (
                        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Owner: {r.owner}</span>
                      )}
                      {r.confidential ? (
                        <StatusBadge tone={CONFIDENTIAL_TONE} size="sm">
                          Confidential
                        </StatusBadge>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 6 }}>
                      {r.fromEmail || "(unknown sender)"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>
                    {new Date(r.createdAt).toLocaleString()}
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
