import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card, Field, Input } from "../design/index.jsx";
import { useCallback, useEffect, useState } from "react";

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

type AuditResponse = {
  page: number;
  page_size: number;
  total: number;
  rows: AuditRow[];
};

export default function PortalAdminAuditLog() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [applied, setApplied] = useState({ user: "", action: "", target: "", from: "", to: "" });
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (applied.user) params.set("user", applied.user);
    if (applied.action) params.set("action", applied.action);
    if (applied.target) params.set("target", applied.target);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);

    try {
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? "Failed to load audit log");
      setData(body as AuditResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.role, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setApplied({
      user: userFilter.trim(),
      action: actionFilter.trim(),
      target: targetFilter.trim(),
      from: fromDate,
      to: toDate,
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  if (user?.role !== "admin") {
    return (
      <AdminPortalShell
        section="audit-log"
        title="Audit log"
        description="Admin access is required."
      >
        <Card padding="lg">
          <div style={{ color: "var(--err-700)", fontSize: 13 }}>Admin access required.</div>
        </Card>
      </AdminPortalShell>
    );
  }

  return (
    <AdminPortalShell
      section="audit-log"
      eyebrow="Administration"
      title="Audit log"
      description="Sign-in events, password changes, and admin actions recorded by the platform."
    >
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <Card padding="lg">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              alignItems: "end",
            }}
          >
            <Field label="User">
              <Input
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                placeholder="Email or name"
              />
            </Field>
            <Field label="Action">
              <Input
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                placeholder="e.g. login.success"
              />
            </Field>
            <Field label="Target">
              <Input
                value={targetFilter}
                onChange={e => setTargetFilter(e.target.value)}
                placeholder="Type or ID"
              />
            </Field>
            <Field label="From">
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </Field>
            <div>
              <Button onClick={applyFilters}>Apply filters</Button>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          {loading ? (
            <div
              aria-hidden
              style={{
                height: 120,
                borderRadius: 10,
                background: "var(--ink-100)",
                border: "1px solid var(--ink-200)",
              }}
            />
          ) : error ? (
            <div role="alert" style={{ color: "var(--err-700)", fontSize: 13 }}>
              {error}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No audit events match these filters.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--ink-500)" }}>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--ink-200)" }}>When</th>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--ink-200)" }}>User</th>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--ink-200)" }}>Action</th>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--ink-200)" }}>Target</th>
                    <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--ink-200)" }}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid var(--ink-100)", whiteSpace: "nowrap" }}>
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid var(--ink-100)" }}>
                        {row.userFullName || row.userEmail || row.userId || "—"}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid var(--ink-100)", fontFamily: "monospace" }}>
                        {row.action}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid var(--ink-100)" }}>
                        {row.targetType ? `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ""}` : "—"}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid var(--ink-100)" }}>
                        {row.ipAddress || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.total > 0 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 14,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--ink-600)" }}>
                Page {data.page} of {totalPages} · {data.total} events
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
