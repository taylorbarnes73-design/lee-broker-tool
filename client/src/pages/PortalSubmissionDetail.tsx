import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";

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
  queuePosition?: number | null;
};

export default function PortalSubmissionDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/submissions/:id");
  const id = Number(params?.id);
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [queueMeta, setQueueMeta] = useState<{ position: number | null; totalActive: number; aheadOfYou: number | null } | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setItem(null);
    setQueueMeta(null);
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

    fetch(`/api/submissions/${id}/queue`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) return;
        setQueueMeta(b?.data ?? null);
      })
      .catch(() => {
        // ignore queue failures; detail still renders
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function pushToDealius() {
    if (!item) return;
    setPushing(true);
    setPushError(null);
    try {
      const r = await fetch(`/api/submissions/${item.id}/push-dealius`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b?.error ?? "Push failed");
      // Refresh the submission so the admin can see dealiusPush result stored in payload.
      const r2 = await fetch(`/api/submissions/${item.id}`, { credentials: "include" });
      const b2 = await r2.json().catch(() => ({}));
      if (r2.ok) setItem(b2?.data ?? null);
    } catch (e: any) {
      setPushError(e?.message ?? "Push failed");
    } finally {
      setPushing(false);
    }
  }

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
                  <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>{item.reference || "(untitled)"}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                    status: {item.status}
                  </div>
                  {queueMeta?.position !== null && queueMeta?.position !== undefined && (
                    <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                      queue: #{queueMeta.position} of {queueMeta.totalActive}
                      {typeof queueMeta.aheadOfYou === "number" ? ` (ahead: ${queueMeta.aheadOfYou})` : ""}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                  Created: {new Date(item.createdAt).toLocaleString()}
                  <br />
                  Updated: {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>

              {user?.role === "admin" && (
                <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Button variant="primary" disabled={pushing} onClick={pushToDealius}>
                    {pushing ? "Pushing to Dealius…" : "Review & push to Dealius"}
                  </Button>
                  {pushError && <span style={{ color: "var(--err-700)", fontSize: 12 }}>{pushError}</span>}
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    (voucher submissions only for now)
                  </span>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                  Body
                </div>
                <div
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--ink-200)",
                    background: "white",
                    overflow: "auto",
                    fontSize: 13,
                    color: "var(--ink-900)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {(() => {
                    const p: any = item.payload as any;
                    return typeof p?.body === "string" ? p.body : JSON.stringify(item.payload, null, 2);
                  })()}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

