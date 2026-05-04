import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card, Input } from "../design/index.jsx";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
};

type ListResponse = {
  page: number;
  page_size: number;
  total: number;
  rows: AuditRow[];
};

export default function PortalAdminAuditLog() {
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({
    user: "",
    action: "",
    target: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (applied.user) params.set("user", applied.user);
    if (applied.action) params.set("action", applied.action);
    if (applied.target) params.set("target", applied.target);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);

    try {
      const r = await fetch(`/api/admin/audit-log?${params.toString()}`, { credentials: "include" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(body?.error?.message ?? "Could not load audit log.");
        setData(null);
        return;
      }
      setData(body as ListResponse);
    } catch {
      toast.error("Could not load audit log.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setApplied({
      user: userFilter.trim(),
      action: actionFilter.trim(),
      target: targetFilter.trim(),
      from: from.trim(),
      to: to.trim(),
    });
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <AdminPortalShell
      section="audit-log"
      eyebrow="Security"
      title="Audit log"
      description="Read-only history of administrative and security events (50 rows per page)."
    >
      <Card padding="lg">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "var(--s-3)",
            marginBottom: "var(--s-4)",
          }}
        >
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)" }}>User</label>
            <Input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Email or name" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)" }}>Action</label>
            <Input value={actionFilter} onChange={e => setActionFilter(e.target.value)} placeholder="e.g. login" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)" }}>Target</label>
            <Input value={targetFilter} onChange={e => setTargetFilter(e.target.value)} placeholder="Type or id" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)" }}>From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)" }}>To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Button type="button" variant="primary" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </div>

        {loading && <div style={{ color: "var(--ink-500)", fontSize: 14 }}>Loading…</div>}

        {!loading && data && (
          <>
            <div style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 12 }}>
              {data.total} event{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--ink-200)" }}>
                    <th style={{ padding: "8px 6px" }}>When (UTC)</th>
                    <th style={{ padding: "8px 6px" }}>User</th>
                    <th style={{ padding: "8px 6px" }}>Action</th>
                    <th style={{ padding: "8px 6px" }}>Target</th>
                    <th style={{ padding: "8px 6px" }}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--ink-100)" }}>
                      <td style={{ padding: "8px 6px", whiteSpace: "nowrap", color: "var(--ink-700)" }}>
                        {row.createdAt ? new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 23) : "—"}
                      </td>
                      <td style={{ padding: "8px 6px", color: "var(--ink-800)" }}>
                        {row.userFullName || row.userEmail || row.userId || "—"}
                      </td>
                      <td style={{ padding: "8px 6px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                        {row.action}
                      </td>
                      <td style={{ padding: "8px 6px", fontSize: 12, color: "var(--ink-600)" }}>
                        {[row.targetType, row.targetId].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td style={{ padding: "8px 6px", fontSize: 12, color: "var(--ink-500)" }}>{row.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </AdminPortalShell>
  );
}
