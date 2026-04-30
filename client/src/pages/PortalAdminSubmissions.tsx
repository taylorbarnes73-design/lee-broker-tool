import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";

type SubmissionSummary = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
};

export default function PortalAdminSubmissions() {
  const { user } = useAuth();
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let alive = true;
    fetch("/api/submissions?limit=200", { credentials: "include" })
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
  }, [user?.role]);

  if (user?.role !== "admin") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>Admin: all submissions</div>
          <Link href="/portal">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
        <div style={{ marginTop: 14 }}>
          <Card padding="lg">
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>Admin access required.</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>Admin: all submissions</div>
        <Link href="/portal">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No submissions found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(s => (
                <Link key={s.id} href={`/portal/submissions/${s.id}`}>
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
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>
                          #{s.id} · {s.formType}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                          {s.reference || "(no reference)"} · status: {s.status}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                          {s.submittedBy || "(unknown)"} {s.submittedByEmail ? `· ${s.submittedByEmail}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

