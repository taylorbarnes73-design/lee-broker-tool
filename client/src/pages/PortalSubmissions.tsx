import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button, Card } from "../design/index.jsx";

type SubmissionSummary = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  createdAt: string;
  queuePosition: number | null;
};

export default function PortalSubmissions() {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/submissions?limit=100&includeQueue=1", { credentials: "include" })
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
  }, []);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>My submissions</div>
        <Link href="/portal">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>No submissions yet.</div>
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

