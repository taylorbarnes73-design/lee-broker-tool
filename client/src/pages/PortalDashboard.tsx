import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { Card } from "../design/index.jsx";

type SubmissionRow = {
  id: number;
  status: string;
  queuePosition: number | null;
};

type DashboardStats = {
  pending: number;
  inReview: number;
  active: number;
};

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: number | string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card padding="lg">
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: "var(--ink-900)", marginTop: 6, lineHeight: 1.1 }}>
        {loading ? (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 56,
              height: 28,
              background: "var(--ink-100)",
              borderRadius: 6,
            }}
          />
        ) : (
          value
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 6 }}>
          {hint}
        </div>
      )}
    </Card>
  );
}

function firstNameFrom(user: { name?: string | null; email?: string | null } | null | undefined): string {
  const name = (user?.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts[0]) return parts[0];
  }
  const email = (user?.email ?? "").trim();
  if (email) {
    const prefix = email.split("@")[0] ?? "";
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return "there";
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/submissions?limit=200&includeQueue=1", { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load");
        const rows = (b?.data ?? []) as SubmissionRow[];
        const pending = rows.filter(r => r.status === "pending").length;
        const inReview = rows.filter(r => r.status === "in_review").length;
        const active = rows.filter(r => typeof r.queuePosition === "number").length;
        setStats({ pending, inReview, active });
        setError(null);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Could not load queue summary.");
        setStats({ pending: 0, inReview: 0, active: 0 });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const welcome = isAdmin ? "Submission Operations" : `Welcome, ${firstNameFrom(user)}`;
  const description = isAdmin
    ? "Track broker submissions, triage incoming requests, and push approved deals to Dealius."
    : "Build a submission in the broker tool, then send it to admin for review. Track its status here.";

  const brokerQueueHref = "/portal/submissions";
  const adminQueueHref = "/portal/admin/submissions";

  return (
    <AdminPortalShell
      section="dashboard"
      eyebrow={isAdmin ? "Admin Portal" : "Broker Portal"}
      title={welcome}
      description={description}
    >
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard label="Pending" value={stats?.pending ?? 0} loading={loading} hint="Awaiting first review." />
        <StatCard label="In review" value={stats?.inReview ?? 0} loading={loading} hint="Being processed now." />
        <StatCard label="Active in queue" value={stats?.active ?? 0} loading={loading} hint="Pending + in review combined." />
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--err-700)" }}>{error}</div>
      )}

      <div style={{ marginTop: 18 }}>
        <Card padding="lg">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-900)" }}>
            How submissions reach admin
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-600)", lineHeight: 1.55, marginTop: 8 }}>
            Brokers complete a voucher, listing, or sign request in the broker tool and choose <b>Send to admin</b>.
            The submission is added to the queue, where admin reviews it, attaches documents, and pushes the deal to
            Dealius once it's ready. You can always come back here to check the latest status.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <LinkButton href="/" variant="primary">
              Open broker tool
            </LinkButton>
            <LinkButton href={isAdmin ? adminQueueHref : brokerQueueHref} variant="secondary">
              View submissions
            </LinkButton>
          </div>
        </Card>
      </div>
    </AdminPortalShell>
  );
}
