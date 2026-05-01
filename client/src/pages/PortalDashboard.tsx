import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card, Input } from "../design/index.jsx";

export default function PortalDashboard() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [queueSummary, setQueueSummary] = useState<{ position: number; totalActive: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setQueueSummary(null);
    fetch("/api/submissions?limit=100&includeQueue=1", { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(async ({ ok, b }) => {
        if (!alive) return;
        if (!ok) return;
        const items = (b?.data ?? []) as Array<{ id: number; queuePosition: number | null }>;
        const active = items.filter(i => typeof i.queuePosition === "number") as Array<{ id: number; queuePosition: number }>;
        if (active.length === 0) return;
        active.sort((a, b) => a.queuePosition - b.queuePosition);
        const top = active[0];
        const r2 = await fetch(`/api/submissions/${top.id}/queue`, { credentials: "include" });
        const b2 = await r2.json().catch(() => ({}));
        if (!alive) return;
        const pos = Number(b2?.data?.position);
        const total = Number(b2?.data?.totalActive);
        if (Number.isFinite(pos) && Number.isFinite(total)) setQueueSummary({ position: pos, totalActive: total });
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, []);

  const createSubmission = async () => {
    setStatus(null);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, body }),
    });
    const respBody = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(respBody?.error ?? "Failed to create submission");
    }
    setStatus(`Created submission #${respBody?.data?.id ?? "?"}`);
  };

  return (
    <AdminPortalShell
      section="dashboard"
      eyebrow="Admin Portal"
      title="Submission Operations"
      description={`Signed in as ${user?.name ?? "Lee user"}${user?.email ? ` (${user.email})` : ""} - ${user?.role === "admin" ? "Admin" : "Agent"}`}
    >

      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <Link href="/portal/submissions">
          <Button variant="primary">My submissions</Button>
        </Link>
        {user?.role === "admin" && (
          <Link href="/portal/admin/submissions">
            <Button variant="secondary">Admin: all submissions</Button>
          </Link>
        )}
      </div>

      {user?.role !== "admin" && queueSummary && (
        <div style={{ marginTop: 14 }}>
          <Card padding="lg">
            <div style={{ fontSize: 14, color: "var(--ink-700)" }}>
              You are <b>#{queueSummary.position}</b> of <b>{queueSummary.totalActive}</b> in the active queue.
            </div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <Card padding="lg">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-900)" }}>Create a submission</div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>
            Create a title + body submission stored server-side and scoped to your user.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                Title
              </label>
              <Input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="Short title" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                Body
              </label>
              <Input value={body} onChange={(e: any) => setBody(e.target.value)} placeholder="Write something…" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <Button variant="primary" onClick={() => createSubmission().catch(e => setStatus(e.message))}>
              Create
            </Button>
            {status && <div style={{ fontSize: 13, color: status.startsWith("Created") ? "var(--ok-700)" : "var(--err-700)" }}>{status}</div>}
          </div>
        </Card>
      </div>
    </AdminPortalShell>
  );
}

