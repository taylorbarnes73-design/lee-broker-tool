import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card } from "../design/index.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

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

export default function PortalBrokerAdminRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState<BrokerAdminRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stats, setStats] = useState<{ counts: Array<{ status: string; count: number }>; staleCount: number; staleDays: number } | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let alive = true;
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
      })
      .catch(e => {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
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

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="broker-admin"
        title="Broker Admin"
        description="Admin access is required to view broker admin inbox requests."
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
      title="Broker Admin"
      description="Shared inbox requests captured from email. Triage, track, and open detail to view attachments."
      actions={
        <Link href="/portal">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      }
    >
      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          {stats && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              {stats.counts
                .slice()
                .sort((a, b) => (a.status > b.status ? 1 : -1))
                .map(c => (
                  <div
                    key={c.status}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--ink-200)",
                      background: "white",
                      fontSize: 12,
                      color: "var(--ink-700)",
                    }}
                  >
                    <b>{c.status}</b>: {c.count}
                  </div>
                ))}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--ink-200)",
                  background: "white",
                  fontSize: 12,
                  color: "var(--ink-700)",
                }}
              >
                <b>stale</b> ({stats.staleDays}d): {stats.staleCount}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search title, from, reference…"
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
              <option value="new">new</option>
              <option value="triaged">triaged</option>
              <option value="in_progress">in_progress</option>
              <option value="waiting_on_broker">waiting_on_broker</option>
              <option value="waiting_on_vendor">waiting_on_vendor</option>
              <option value="done">done</option>
              <option value="cancelled">cancelled</option>
            </select>
            <select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ink-200)",
                background: "white",
                fontSize: 13,
              }}
            >
              <option value="">All owners</option>
              <option value="Taylor">Taylor</option>
              <option value="Errissa">Errissa</option>
              <option value="Unassigned">Unassigned</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Showing {visible.length} of {items.length}
            </div>
          </div>

          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : visible.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No broker admin requests found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map(r => (
                <Link key={r.id} href={`/portal/admin/broker-admin/${r.id}`}>
                  <a style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--ink-200)",
                        background: "white",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>
                          #{r.id} · {r.title || r.reference || "(untitled)"}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                          status: {r.status} {r.owner ? `· owner: ${r.owner}` : ""}
                          {r.confidential ? " · confidential" : ""}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                          {r.fromEmail || "(unknown sender)"}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminPortalShell>
  );
}

