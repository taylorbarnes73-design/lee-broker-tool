import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button, Card } from "../design/index.jsx";
import {
  brokerAdminStatusTone,
  formatBrokerAdminStatus,
  formatFormType,
  formatSubmissionStatus,
  submissionStatusTone,
} from "@/lib/format";

/* ── shared input style ───────────────────────────────────────────── */
const INPUT_STYLE = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--ink-200)",
  background: "white",
  fontSize: 13,
  color: "var(--ink-900)",
} as const;

const ASSIGNEE_CHIP_STYLE = {
  marginLeft: 8,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(0,49,70,0.08)",
  color: "var(--ink-700)",
  fontSize: 11,
  fontWeight: 600,
} as const;

/* ── types ────────────────────────────────────────────────────────── */
type SubmissionRow = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy?: string | null;
  submittedByEmail?: string | null;
  createdAt: string;
  queuePosition: number | null;
  source?: string | null;
  sourceEmailWebLink?: string | null;
  // Admin-only assignment fields
  assignedTo?: string | null;
  assignedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
};

type BrokerAdminRow = {
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
  attachmentsSummary: string | null;
};

/* ── small helpers ────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} aria-hidden style={{ height: 72, borderRadius: 10, background: "var(--ink-100)", border: "1px solid var(--ink-200)" }} />
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 28, borderRadius: 12, border: "1px dashed var(--ink-300)", background: "var(--ink-50)", textAlign: "center", color: "var(--ink-600)", fontSize: 13 }}>
      {children}
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function StatCard({ label, value, hint, loading }: { label: string; value: number | string; hint?: string; loading?: boolean }) {
  return (
    <Card padding="lg">
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink-900)", marginTop: 6, lineHeight: 1.1 }}>
        {loading ? <span aria-hidden style={{ display: "inline-block", width: 52, height: 26, background: "var(--ink-100)", borderRadius: 6 }} /> : value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 5 }}>{hint}</div>}
    </Card>
  );
}

/* ── broker view: submission log ──────────────────────────────────── */
function BrokerSubmissions() {
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/submissions?limit=100", { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load");
        setItems(b?.data ?? []);
        setError(null);
      })
      .catch(e => { if (!alive) return; setError(e?.message ?? "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>;
  if (items.length === 0) {
    return (
      <Empty>
        <div style={{ fontWeight: 700, color: "var(--ink-900)", marginBottom: 6 }}>No submissions yet</div>
        Build a voucher, listing, or sign request in the broker tool, then send it to admin.
        <div style={{ marginTop: 14 }}>
          <LinkButton href="/tool" variant="primary">Open broker tool</LinkButton>
        </div>
      </Empty>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-600)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--ink-800)" }}>Pending</strong> means your request is in the queue — admin typically responds within 1 business day.
        {" "}<strong style={{ color: "var(--ink-800)" }}>In progress</strong> means someone has claimed it and is working on it.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(s => (
          <Link key={s.id} href={`/portal/submissions/${s.id}`} className="portal-list-item" style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--ink-200)", background: "white", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <StatusBadge tone={{ bg: "rgba(152, 0, 46, 0.08)", fg: "#98002E", border: "rgba(152, 0, 46, 0.22)" }} size="sm">{formatFormType(s.formType)}</StatusBadge>
              <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>{formatDateTime(s.createdAt)}</div>
            </div>
            <div style={{ fontWeight: 700, color: "var(--ink-900)", fontSize: 15 }}>{s.reference || "(untitled)"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge tone={submissionStatusTone(s.status)} size="sm">{formatSubmissionStatus(s.status)}</StatusBadge>
              <span style={{ fontSize: 12, color: "var(--ink-500)" }}>#{s.id}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── admin view: all broker submissions ───────────────────────────── */
function AdminSubmissions() {
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState("");
  const [sortByQueue, setSortByQueue] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams({ limit: "200", includeQueue: "1" });
    if (statusFilter) p.set("status", statusFilter);
    if (formTypeFilter) p.set("formType", formTypeFilter);
    fetch(`/api/submissions?${p}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load");
        setItems(b?.data ?? []); setError(null);
      })
      .catch(e => { if (!alive) return; setError(e?.message ?? "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [statusFilter, formTypeFilter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q ? items : items.filter(s => `${s.submittedBy ?? ""} ${s.submittedByEmail ?? ""} ${s.reference ?? ""}`.toLowerCase().includes(q));
    if (!sortByQueue) return filtered;
    return [...filtered].sort((a, b) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity));
  }, [items, query, sortByQueue]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by name, email, or reference…" style={{ ...INPUT_STYLE, width: 320, maxWidth: "100%" }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: "100%" }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_review">In review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={formTypeFilter} onChange={e => setFormTypeFilter(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: "100%" }}>
          <option value="">All types</option>
          <option value="voucher">Commission voucher</option>
          <option value="listing">Listing</option>
          <option value="sign">Sign request</option>
          <option value="comp">Comp input</option>
          <option value="lease">Lease</option>
          <option value="sale">Sale</option>
        </select>
        <Button variant={sortByQueue ? "primary" : "secondary"} onClick={() => setSortByQueue(v => !v)}>Sort by queue</Button>
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Showing {visible.length} of {items.length}</div>
      </div>
      {loading ? <Skeleton /> : error ? (
        <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
      ) : visible.length === 0 ? (
        <Empty>No submissions match the current filters.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(s => (
            <Link key={s.id} href={`/portal/submissions/${s.id}`} className="portal-list-item" style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--ink-200)", background: "white", color: "inherit" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>#{s.id} · {s.reference || "(untitled)"}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                  <StatusBadge tone={submissionStatusTone(s.status)} size="sm">{formatSubmissionStatus(s.status)}</StatusBadge>
                  <StatusBadge tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }} size="sm">{formatFormType(s.formType)}</StatusBadge>
                  {(s.source === "email_ingest" || s.source === "email_ingest_backfill") && (
                    <span
                      title={s.source === "email_ingest_backfill" ? "Imported from backfill" : "Imported from BrokerAdmin email"}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--ink-300)", background: "var(--ink-100)", color: "var(--ink-700)", fontSize: 11, fontWeight: 600, cursor: s.sourceEmailWebLink ? "pointer" : "default" }}
                      onClick={e => { if (s.sourceEmailWebLink) { e.preventDefault(); window.open(s.sourceEmailWebLink, "_blank", "noopener"); } }}
                    >
                      ✉ Email
                    </span>
                  )}
                  {s.queuePosition !== null && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Queue #{s.queuePosition}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 5 }}>
                  {s.submittedBy || "(unknown)"}{s.submittedByEmail ? ` · ${s.submittedByEmail}` : ""}
                  {s.assignedTo && (
                    <span style={ASSIGNEE_CHIP_STYLE}>
                      → {s.assignedTo}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>{formatDateTime(s.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ── admin view: broker admin inbox ───────────────────────────────── */
function AdminInbox() {
  const [items, setItems] = useState<BrokerAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stats, setStats] = useState<{ counts: { status: string; count: number }[]; staleCount: number; staleDays: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams({ limit: "200" });
    if (statusFilter) p.set("status", statusFilter);
    if (ownerFilter) p.set("owner", ownerFilter);
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/broker-admin/requests?${p}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!alive) return; if (!ok) throw new Error(b?.error ?? "Failed to load"); setItems(b?.data ?? []); setError(null); })
      .catch(e => { if (!alive) return; setError(e?.message ?? "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    fetch("/api/broker-admin/stats?staleDays=3", { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!alive || !ok) return; setStats({ counts: b?.data?.counts ?? [], staleCount: Number(b?.data?.staleCount ?? 0), staleDays: Number(b?.data?.staleDays ?? 3) }); })
      .catch(e => { console.warn("Broker admin stats unavailable:", e); });
    return () => { alive = false; };
  }, [statusFilter, ownerFilter, q]);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items;
    return items.filter(r => `${r.title ?? ""} ${r.fromEmail ?? ""} ${r.reference ?? ""}`.toLowerCase().includes(n));
  }, [items, q]);

  const ownerOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of items) if (r.owner?.trim()) s.add(r.owner.trim());
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <>
      {stats && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {stats.counts.slice().sort((a, b) => a.status.localeCompare(b.status)).map(c => (
            <StatusBadge key={c.status} tone={brokerAdminStatusTone(c.status)}>{formatBrokerAdminStatus(c.status)}: {c.count}</StatusBadge>
          ))}
          <StatusBadge tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }}>Stale ({stats.staleDays}d): {stats.staleCount}</StatusBadge>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, from, reference…" style={{ ...INPUT_STYLE, width: 320, maxWidth: "100%" }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: "100%" }}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="triaged">Triaged</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_on_broker">Waiting on broker</option>
          <option value="waiting_on_vendor">Waiting on vendor</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ ...INPUT_STYLE, maxWidth: "100%" }}>
          <option value="">All owners</option>
          {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="Unassigned">Unassigned</option>
        </select>
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Showing {visible.length} of {items.length}</div>
      </div>
      {loading ? <Skeleton /> : error ? (
        <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
      ) : visible.length === 0 ? (
        <Empty>{items.length === 0 ? "No broker admin requests captured yet." : "No requests match the current filters."}</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(r => (
            <Link key={r.id} href={`/portal/admin/broker-admin/${r.id}`} className="portal-list-item" style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--ink-200)", background: "white", color: "inherit" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--ink-900)" }}>#{r.id} · {r.title || "(untitled)"}</span>
                  {r.confidential === 1 && <StatusBadge tone={{ bg: "#F6E8EE", fg: "#7C2257", border: "#E6CFDC" }} size="sm">Confidential</StatusBadge>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge tone={brokerAdminStatusTone(r.status)} size="sm">{formatBrokerAdminStatus(r.status)}</StatusBadge>
                  {r.category && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{r.category}</span>}
                  {r.owner && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Owner: {r.owner}</span>}
                  {r.fromEmail && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>From: {r.fromEmail}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>{formatDateTime(r.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ── tab button style ─────────────────────────────────────────────── */
type TabId = "submissions" | "inbox";

function TabBar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "submissions", label: "Submissions" },
    { id: "inbox", label: "Broker Admin Inbox" },
  ];
  const accent = "var(--admin-accent, #98002E)";
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--ink-200)", paddingBottom: 0 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          style={{
            padding: "9px 18px",
            border: "none",
            borderBottom: active === t.id ? `2px solid ${accent}` : "2px solid transparent",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: active === t.id ? 700 : 500,
            color: active === t.id ? accent : "var(--ink-600)",
            marginBottom: -1,
            transition: "color 0.15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── main export ──────────────────────────────────────────────────── */
export default function PortalSubmissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<TabId>("submissions");

  // Stats data (loaded by the active list component above, so keep it simple here)
  const [stats, setStats] = useState<{ pending: number; inReview: number; active: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    const endpoint = "/api/submissions?limit=200&includeQueue=1";
    fetch(endpoint, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) { setStats({ pending: 0, inReview: 0, active: 0 }); return; }
        const rows = (b?.data ?? []) as { status: string; queuePosition: number | null }[];
        setStats({
          pending: rows.filter(r => r.status === "pending").length,
          inReview: rows.filter(r => r.status === "in_review").length,
          active: rows.filter(r => r.queuePosition !== null).length,
        });
      })
      .catch(() => { if (!alive) return; setStats({ pending: 0, inReview: 0, active: 0 }); })
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, [isAdmin]);

  const title = isAdmin ? "Submissions" : "My submissions";
  const description = isAdmin
    ? "Review broker work, triage inbox requests, and push approved deals to Dealius."
    : "A log of everything you've submitted, newest first. Pending items are usually reviewed within one business day.";

  return (
    <AdminPortalShell
      section="submissions"
      eyebrow={isAdmin ? "Admin Portal" : "Broker Portal"}
      title={title}
      description={description}
    >
      {isAdmin && (
        <div className="admin-portal-card">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
            <StatCard label="Pending" value={stats?.pending ?? 0} loading={statsLoading} hint="Awaiting first review." />
            <StatCard label="In progress" value={stats?.inReview ?? 0} loading={statsLoading} hint="Claimed and being processed." />
            <StatCard label="Active submissions" value={stats?.active ?? 0} loading={statsLoading} hint="Pending + in progress combined." />
          </div>
        </div>
      )}

      {/* List panel */}
      <div className="admin-portal-card">
        <Card padding="lg">
          {isAdmin && <TabBar active={tab} onSelect={setTab} />}
          {!isAdmin && <BrokerSubmissions />}
          {isAdmin && tab === "submissions" && <AdminSubmissions />}
          {isAdmin && tab === "inbox" && <AdminInbox />}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
