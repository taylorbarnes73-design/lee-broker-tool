import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button, Card } from "../design/index.jsx";

type SubmissionDetail = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  payload: unknown;
};

export default function PortalSubmissionDetail() {
  const [, params] = useRoute("/portal/submissions/:id");
  const id = Number(params?.id);
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setItem(null);
    fetch(`/api/submissions/${id}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load submission");
        setItem(b?.data ?? null);
      })
      .catch(e => {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>Submission #{id}</div>
        <Link href="/portal/submissions">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <Card padding="lg">
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : !item ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>{item.formType}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                    {item.reference || "(no reference)"} · status: {item.status}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                  Created: {new Date(item.createdAt).toLocaleString()}
                  <br />
                  Updated: {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                  Payload
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--ink-200)",
                    background: "var(--ink-50)",
                    overflow: "auto",
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

