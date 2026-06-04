import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button, Card } from "../design/index.jsx";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import {
  brokerAdminStatusTone,
  brokerQueueStatusText,
  brokerSubmissionNextSteps,
  brokerToolTabUrl,
  formatBrokerAdminStatus,
  formatFormType,
  formatSubmissionStatus,
  submissionStatusTone,
} from "@/lib/format";
import { isSubmissionNeedsActionStatus } from "@shared/needsAction";

const STALE_PENDING_MS = 48 * 60 * 60 * 1000;

function isStalePendingSubmission(row: SubmissionRow): boolean {
  if (row.status !== "pending") return false;
  const created = new Date(row.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created > STALE_PENDING_MS;
}

/* ── shared input style ───────────────────────────────────────────── */
const INPUT_STYLE = {
  padding: "10px 12px",
  borderRadius: "var(--r-8)",
  border: "1px solid var(--ink-200)",
  background: "var(--ink-0)",
  fontSize: "var(--fs-13, 13px)",
  fontFamily: "inherit",
  color: "var(--ink-900)",
} as const;

const ASSIGNEE_CHIP_STYLE = {
  marginLeft: 8,
  padding: "1px 7px",
  borderRadius: 999,
  background: "var(--lee-red-wash, #F4E3E8)",
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
        <div key={i} aria-hidden style={{ height: 72, borderRadius: "var(--r-8)", background: "var(--ink-100)", border: "1px solid var(--ink-200)" }} />
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

/* ── progress pipeline (broker-facing) ────────────────────────────── */
const PIPELINE_STEPS = ["Submitted", "In progress", "Complete"] as const;

function stepIndexForStatus(status: string): number {
  switch (status) {
    case "pending": return 0;
    case "in_review": return 1;
    case "approved":
    case "closed": return 2;
    default: return 0;
  }
}

function ProgressPipeline({
  status,
  queuePosition,
  accent = "var(--lee-red, #98002E)",
}: {
  status: string;
  queuePosition: number | null;
  accent?: string;
}) {
  const isRejected = status === "rejected" || status === "cancelled";
  const activeStep = stepIndexForStatus(status);
  const dotGreen = "var(--lee-green, #8A941E)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 8, marginBottom: 6 }}>
        {PIPELINE_STEPS.map((label, idx) => {
          const done = activeStep > idx;
          const active = activeStep === idx && !isRejected;
          const dotColor = done ? dotGreen : active ? accent : "var(--ink-200)";
          const textColor = done || active ? "var(--ink-900)" : "var(--ink-400)";
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flexShrink: idx === 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 64 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: dotColor, flexShrink: 0, boxShadow: active ? `0 0 0 3px ${accent}22` : "none" }} />
                <span style={{ fontSize: 11, fontWeight: done || active ? 700 : 400, color: textColor, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, minWidth: 24, maxWidth: 48, background: done ? dotGreen : "var(--ink-150)", margin: "0 2px", marginBottom: 14 }} />
              )}
            </div>
          );
        })}
        {isRejected && (
          <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "var(--err-700)", marginBottom: 12 }}>
            Not accepted
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
        {brokerQueueStatusText(status, queuePosition)}
      </div>
    </div>
  );
}

/* ── broker quick actions ─────────────────────────────────────────── */
const BROKER_ACTIONS = [
  {
    tab: "voucher" as const,
    title: "Commission voucher",
    description: "Submit a closed deal for commission processing.",
  },
  {
    tab: "listing" as const,
    title: "Listing",
    description: "New listing or modification request.",
  },
  {
    tab: "sign" as const,
    title: "Sign request",
    description: "Order or update a property sign.",
  },
];

function BrokerActionCards({ accent }: { accent: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {BROKER_ACTIONS.map(action => (
        <a
          key={action.tab}
          href={brokerToolTabUrl(action.tab)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid var(--ink-200)",
            background: "var(--ink-0)",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{action.title}</span>
          <span style={{ fontSize: 12, color: "var(--ink-600)", lineHeight: 1.45 }}>{action.description}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-800)", marginTop: 4 }}>Open in broker tool →</span>
        </a>
      ))}
    </div>
    <div style={{ marginTop: 10 }}>
      <LinkButton href="/portal/new" variant="secondary">All workflows (comps, drafts, reports)</LinkButton>
    </div>
    </div>
  );
}

/* ── broker view: own submissions ─────────────────────────────────── */
function BrokerSubmissions({ accent }: { accent: string }) {
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", includeQueue: "1" });
    if (!showAll) params.set("needsAction", "1");
    fetch(`/api/submissions?${params}`, { credentials: "include" })
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
  }, [showAll]);

  if (loading) return <Skeleton />;
  if (error) return <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>;
  if (items.length === 0) {
    return (
      <>
        <BrokerActionCards accent={accent} />
        <Empty>
          <div style={{ fontWeight: 700, color: "var(--ink-900)", marginBottom: 6 }}>
            {showAll ? "No submissions yet" : "Nothing in progress"}
          </div>
          {showAll ? (
            <>
              Start a voucher, listing, or sign request in the broker tool. After you submit, it appears here with queue status.
              <div style={{ marginTop: 14 }}>
                <LinkButton href={brokerToolTabUrl("voucher")} variant="primary">Open broker tool</LinkButton>
              </div>
            </>
          ) : (
            <>
              You have no pending or in-progress requests. Completed items are in your full history.
              <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Button type="button" variant="secondary" onClick={() => setShowAll(true)}>
                  View all submissions
                </Button>
                <LinkButton href={brokerToolTabUrl("listing")} variant="primary">Start a new request</LinkButton>
              </div>
            </>
          )}
        </Empty>
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BrokerActionCards accent={accent} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--ink-600)" }}>
          {showAll
            ? "All submissions you've sent to the office"
            : "In progress — pending review or actively being processed"}
        </div>
        <Button
          type="button"
          variant={showAll ? "primary" : "secondary"}
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? "Show in progress only" : "View all submissions"}
        </Button>
      </div>
      {items.map(s => (
        <Link key={s.id} href={`/portal/submissions/${s.id}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", borderRadius: "var(--r-8)", border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>#{s.id} · {s.reference || "(untitled)"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                <StatusBadge tone={submissionStatusTone(s.status)} size="sm">{formatSubmissionStatus(s.status)}</StatusBadge>
                <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{formatFormType(s.formType)}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0, textAlign: "right" }}>
              {formatDateTime(s.createdAt)}
            </div>
          </div>
          <ProgressPipeline status={s.status} queuePosition={s.queuePosition} accent={accent} />
        </Link>
      ))}
    </div>
  );
}

/* ── admin view: all broker submissions ───────────────────────────── */
function AdminSubmissions() {
  const { user } = useAuth();
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState("");
  const [sortByQueue, setSortByQueue] = useState(true);
  const [needsActionOnly, setNeedsActionOnly] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "200", includeQueue: "1" });
    if (needsActionOnly && !statusFilter) {
      p.set("needsAction", "1");
    } else if (statusFilter) {
      p.set("status", statusFilter);
    }
    if (formTypeFilter) p.set("formType", formTypeFilter);
    try {
      const r = await fetch(`/api/submissions?${p}`, { credentials: "include" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b?.error ?? "Failed to load");
      setItems(b?.data ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, formTypeFilter, needsActionOnly]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function claimSubmission(submission: SubmissionRow, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (claimingId !== null) return;

    setClaimingId(submission.id);
    try {
      const response = await fetch(`/api/submissions/${submission.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_review" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Could not claim submission");

      const adminName = user?.name || user?.email || "You";
      setItems(prev =>
        prev.map(row =>
          row.id === submission.id
            ? { ...row, status: "in_review", assignedTo: adminName }
            : row
        )
      );
      toast.success(
        submission.status === "pending"
          ? `Claimed #${submission.id} — now in progress.`
          : `Assigned #${submission.id} to you.`
      );
      void loadItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not claim submission");
    } finally {
      setClaimingId(null);
    }
  }

  function canClaimFromList(status: string): boolean {
    return status === "pending" || status === "in_review";
  }

  const staleCount = useMemo(
    () => items.filter(isStalePendingSubmission).length,
    [items]
  );

  const needsActionCount = useMemo(
    () => items.filter(s => isSubmissionNeedsActionStatus(s.status)).length,
    [items]
  );

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
        <Button
          variant={needsActionOnly ? "primary" : "secondary"}
          onClick={() => {
            setNeedsActionOnly(v => {
              const next = !v;
              if (next) setStatusFilter("");
              return next;
            });
          }}
        >
          Needs action ({needsActionCount})
        </Button>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            if (e.target.value) setNeedsActionOnly(false);
          }}
          disabled={needsActionOnly}
          style={{ ...INPUT_STYLE, opacity: needsActionOnly ? 0.6 : 1 }}
        >
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
          <option value="comp">Comp input</option>
          <option value="lease">Lease</option>
          <option value="sale">Sale</option>
        </select>
        <Button variant={sortByQueue ? "primary" : "secondary"} onClick={() => setSortByQueue(v => !v)}>Sort by queue</Button>
        {staleCount > 0 && (
          <StatusBadge tone={{ bg: "var(--warn-100)", fg: "var(--warn-700)", border: "var(--warn-500)" }} size="sm">
            Stale pending (48h+): {staleCount}
          </StatusBadge>
        )}
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Showing {visible.length} of {items.length}</div>
      </div>
      {loading ? <Skeleton /> : error ? (
        <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
      ) : visible.length === 0 ? (
        <Empty>No submissions match the current filters.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(s => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 10,
                padding: 12,
                borderRadius: "var(--r-8)",
                border: "1px solid var(--ink-200)",
                background: "var(--ink-0)",
              }}
            >
              <Link
                href={`/portal/submissions/${s.id}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  color: "inherit",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>#{s.id} · {s.reference || "(untitled)"}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                  <StatusBadge tone={submissionStatusTone(s.status)} size="sm">{formatSubmissionStatus(s.status)}</StatusBadge>
                  {isStalePendingSubmission(s) && (
                    <StatusBadge tone={{ bg: "var(--warn-100)", fg: "var(--warn-700)", border: "var(--warn-500)" }} size="sm">
                      Stale
                    </StatusBadge>
                  )}
                  <StatusBadge tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }} size="sm">{formatFormType(s.formType)}</StatusBadge>
                    {(s.source === "email_ingest" || s.source === "email_ingest_backfill") && (
                      <span
                        title={s.source === "email_ingest_backfill" ? "Imported from backfill" : "Imported from BrokerAdmin email"}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: "1px solid #BCD6EF", background: "#E6F0FA", color: "#1F4F8B", fontSize: 11, fontWeight: 600, cursor: s.sourceEmailWebLink ? "pointer" : "default" }}
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
              {canClaimFromList(s.status) && (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexShrink: 0 }}>
                  <Button
                    variant={s.status === "pending" ? "primary" : "secondary"}
                    disabled={claimingId === s.id}
                    onClick={e => void claimSubmission(s, e)}
                  >
                    {claimingId === s.id
                      ? "Claiming…"
                      : s.status === "pending"
                        ? "Claim"
                        : "Assign to me"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

type UnifiedNeedsActionItem =
  | { kind: "queue"; sortAt: number; row: SubmissionRow }
  | { kind: "inbox"; sortAt: number; row: BrokerAdminRow };

/* ── admin: combined needs-action feed ────────────────────────────── */
function AdminUnifiedNeedsAction({ accent }: { accent: string }) {
  const [items, setItems] = useState<UnifiedNeedsActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch("/api/submissions?needsAction=1&limit=200&includeQueue=1", { credentials: "include" }).then(r =>
        r.json().then(b => ({ ok: r.ok, b }))
      ),
      fetch("/api/broker-admin/requests?needsAction=1&limit=200", { credentials: "include" }).then(r =>
        r.json().then(b => ({ ok: r.ok, b }))
      ),
    ])
      .then(([subRes, inboxRes]) => {
        if (!alive) return;
        if (!subRes.ok) throw new Error(subRes.b?.error ?? "Failed to load submission queue");
        if (!inboxRes.ok) throw new Error(inboxRes.b?.error ?? "Failed to load broker admin inbox");
        const merged: UnifiedNeedsActionItem[] = [];
        for (const row of (subRes.b?.data ?? []) as SubmissionRow[]) {
          merged.push({
            kind: "queue",
            sortAt: new Date(row.createdAt).getTime() || 0,
            row,
          });
        }
        for (const row of (inboxRes.b?.data ?? []) as BrokerAdminRow[]) {
          merged.push({
            kind: "inbox",
            sortAt: new Date(row.createdAt).getTime() || 0,
            row,
          });
        }
        merged.sort((a, b) => b.sortAt - a.sortAt);
        setItems(merged);
        setError(null);
      })
      .catch(e => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>;
  if (items.length === 0) {
    return (
      <Empty>
        <div style={{ fontWeight: 700, color: "var(--ink-900)", marginBottom: 6 }}>Nothing needs action</div>
        The submission queue and Broker Admin inbox are clear. Use the other tabs to browse history or change filters.
      </Empty>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 4 }}>
        Combined view: portal/tool submissions plus shared-inbox email requests, newest first.
      </div>
      {items.map(item => {
        if (item.kind === "queue") {
          const s = item.row;
          return (
            <Link
              key={`q-${s.id}`}
              href={`/portal/submissions/${s.id}`}
              style={{
                textDecoration: "none",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: 12,
                borderRadius: "var(--r-8)",
                border: "1px solid var(--ink-200)",
                background: "var(--ink-0)",
                color: "inherit",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <StatusBadge tone={{ bg: `${accent}18`, fg: accent, border: `${accent}44` }} size="sm">
                    Submission queue
                  </StatusBadge>
                  <span style={{ fontWeight: 700, color: "var(--ink-900)" }}>
                    #{s.id} · {s.reference || "(untitled)"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge tone={submissionStatusTone(s.status)} size="sm">
                    {formatSubmissionStatus(s.status)}
                  </StatusBadge>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{formatFormType(s.formType)}</span>
                  {s.submittedBy && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{s.submittedBy}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>{formatDateTime(s.createdAt)}</div>
            </Link>
          );
        }
        const r = item.row;
        return (
          <Link
            key={`i-${r.id}`}
            href={`/portal/admin/broker-admin/${r.id}`}
            style={{
              textDecoration: "none",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: 12,
              borderRadius: "var(--r-8)",
              border: "1px solid var(--ink-200)",
              background: "var(--ink-0)",
              color: "inherit",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <StatusBadge tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }} size="sm">
                  Broker Admin inbox
                </StatusBadge>
                <span style={{ fontWeight: 700, color: "var(--ink-900)" }}>#{r.id} · {r.title || "(untitled)"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusBadge tone={brokerAdminStatusTone(r.status)} size="sm">
                  {formatBrokerAdminStatus(r.status)}
                </StatusBadge>
                {r.fromEmail && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>From: {r.fromEmail}</span>}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", flexShrink: 0 }}>{formatDateTime(r.createdAt)}</div>
          </Link>
        );
      })}
    </div>
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
  const [needsActionOnly, setNeedsActionOnly] = useState(true);
  const [stats, setStats] = useState<{ counts: { status: string; count: number }[]; staleCount: number; staleDays: number; needsActionCount?: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams({ limit: "200" });
    if (needsActionOnly && !statusFilter) p.set("needsAction", "1");
    else if (statusFilter) p.set("status", statusFilter);
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
      .catch(() => {});
    return () => { alive = false; };
  }, [statusFilter, ownerFilter, q, needsActionOnly]);

  const inboxNeedsActionCount = useMemo(
    () => items.filter(r => r.status !== "done" && r.status !== "cancelled").length,
    [items]
  );

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
        <Button
          variant={needsActionOnly ? "primary" : "secondary"}
          onClick={() => {
            setNeedsActionOnly(v => {
              const next = !v;
              if (next) setStatusFilter("");
              return next;
            });
          }}
        >
          Needs action ({inboxNeedsActionCount})
        </Button>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            if (e.target.value) setNeedsActionOnly(false);
          }}
          disabled={needsActionOnly}
          style={{ ...INPUT_STYLE, opacity: needsActionOnly ? 0.6 : 1 }}
        >
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
            <Link key={r.id} href={`/portal/admin/broker-admin/${r.id}`} style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: "var(--r-8)", border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "inherit" }}>
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
type TabId = "needs_action" | "submissions" | "inbox";

function TabBar({
  active,
  onSelect,
  accent,
  counts,
}: {
  active: TabId;
  onSelect: (t: TabId) => void;
  accent: string;
  counts: { combined: number; queue: number; inbox: number };
}) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "needs_action", label: `Needs action (${counts.combined})` },
    { id: "submissions", label: `Submission queue (${counts.queue})` },
    { id: "inbox", label: `Broker Admin Inbox (${counts.inbox})` },
  ];
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
  const branding = usePublicBranding();
  const accent = branding.primary_color || "var(--lee-red, #98002E)";
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<TabId>("needs_action");

  const [adminStats, setAdminStats] = useState<{ queue: number; inbox: number; combined: number } | null>(null);
  const [brokerStats, setBrokerStats] = useState<{ pending: number; inReview: number; active: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);

    if (!isAdmin) {
      fetch("/api/submissions?limit=100&includeQueue=1", { credentials: "include" })
        .then(r => r.json().then(b => ({ ok: r.ok, b })))
        .then(({ ok, b }) => {
          if (!alive) return;
          if (!ok) {
            setBrokerStats({ pending: 0, inReview: 0, active: 0 });
            return;
          }
          const rows = (b?.data ?? []) as { status: string }[];
          setBrokerStats({
            pending: rows.filter(r => r.status === "pending").length,
            inReview: rows.filter(r => r.status === "in_review").length,
            active: rows.filter(r => isSubmissionNeedsActionStatus(r.status)).length,
          });
        })
        .catch(() => {
          if (!alive) return;
          setBrokerStats({ pending: 0, inReview: 0, active: 0 });
        })
        .finally(() => {
          if (alive) setStatsLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    Promise.all([
      fetch("/api/submissions?needsAction=1&limit=200", { credentials: "include" }).then(r =>
        r.json().then(b => ({ ok: r.ok, b }))
      ),
      fetch("/api/broker-admin/requests?needsAction=1&limit=200", { credentials: "include" }).then(r =>
        r.json().then(b => ({ ok: r.ok, b }))
      ),
    ])
      .then(([subRes, inboxRes]) => {
        if (!alive) return;
        const queue = subRes.ok ? ((subRes.b?.data ?? []) as unknown[]).length : 0;
        const inbox = inboxRes.ok ? ((inboxRes.b?.data ?? []) as unknown[]).length : 0;
        setAdminStats({ queue, inbox, combined: queue + inbox });
      })
      .catch(() => {
        if (!alive) return;
        setAdminStats({ queue: 0, inbox: 0, combined: 0 });
      })
      .finally(() => {
        if (alive) setStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const tabCounts = {
    combined: adminStats?.combined ?? 0,
    queue: adminStats?.queue ?? 0,
    inbox: adminStats?.inbox ?? 0,
  };

  const title = isAdmin ? "Submissions" : "Home";
  const description = isAdmin
    ? "Review broker work, triage inbox requests, and push approved deals to Dealius."
    : "Track your office requests, see queue status, and start new vouchers, listings, or sign orders.";

  const brokerStatHints = {
    pending: "Waiting for the office to pick up.",
    inReview: "An admin is actively processing.",
    active: "Pending + in progress combined.",
  };
  const adminStatHints = {
    pending: "Awaiting first review.",
    inReview: "Claimed and being processed.",
    active: "Pending + in progress combined.",
  };
  const statHints = isAdmin ? adminStatHints : brokerStatHints;

  return (
    <AdminPortalShell
      section="submissions"
      eyebrow={isAdmin ? "Admin Portal" : "Broker Portal"}
      title={title}
      description={description}
      actions={
        !isAdmin ? (
          <>
            <LinkButton href="/portal/new" variant="secondary">
              Broker home
            </LinkButton>
            <LinkButton href={brokerToolTabUrl("voucher")} variant="primary">
              Open broker tool
            </LinkButton>
          </>
        ) : undefined
      }
    >
      {/* Stats row */}
      <div className="admin-portal-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {isAdmin ? (
            <>
              <StatCard
                label="Needs action (all)"
                value={adminStats?.combined ?? 0}
                loading={statsLoading}
                hint="Submission queue + Broker Admin inbox."
              />
              <StatCard
                label="Submission queue"
                value={adminStats?.queue ?? 0}
                loading={statsLoading}
                hint={statHints.pending}
              />
              <StatCard
                label="Broker Admin inbox"
                value={adminStats?.inbox ?? 0}
                loading={statsLoading}
                hint="Shared mailbox items needing triage."
              />
            </>
          ) : (
            <>
              <StatCard
                label="Awaiting office"
                value={brokerStats?.pending ?? 0}
                loading={statsLoading}
                hint={statHints.pending}
              />
              <StatCard
                label="Being processed"
                value={brokerStats?.inReview ?? 0}
                loading={statsLoading}
                hint={statHints.inReview}
              />
              <StatCard
                label="In progress total"
                value={brokerStats?.active ?? 0}
                loading={statsLoading}
                hint={statHints.active}
              />
            </>
          )}
        </div>
      </div>

      {/* List panel */}
      <div className="admin-portal-card">
        <Card padding="lg">
          {isAdmin && <TabBar active={tab} onSelect={setTab} accent={accent} counts={tabCounts} />}
          {!isAdmin && <BrokerSubmissions accent={accent} />}
          {isAdmin && tab === "needs_action" && <AdminUnifiedNeedsAction accent={accent} />}
          {isAdmin && tab === "submissions" && <AdminSubmissions />}
          {isAdmin && tab === "inbox" && <AdminInbox />}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
