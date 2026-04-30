import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { Link } from "wouter";
import { Button, Card, Input } from "../design/index.jsx";

export default function PortalDashboard() {
  const { user, logout } = useAuth();
  const [formType, setFormType] = useState("note");
  const [reference, setReference] = useState("");
  const [payloadJson, setPayloadJson] = useState('{"message":"Hello"}');
  const [status, setStatus] = useState<string | null>(null);

  const createSubmission = async () => {
    setStatus(null);
    const payload = (() => {
      try {
        return JSON.parse(payloadJson || "{}");
      } catch {
        throw new Error("Payload must be valid JSON");
      }
    })();

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ formType, reference: reference || undefined, payload }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error ?? "Failed to create submission");
    }
    setStatus(`Created submission #${body?.data?.id ?? "?"}`);
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>Dashboard</div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>
            Signed in as <b>{user?.name}</b> ({user?.email}) — {user?.role === "admin" ? "Admin" : "Agent"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </div>

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

      <div style={{ marginTop: 18 }}>
        <Card padding="lg">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-900)" }}>Create a submission</div>
          <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>
            Minimal “submission” record stored server-side and scoped to your user.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                Form type
              </label>
              <Input value={formType} onChange={(e: any) => setFormType(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                Reference (optional)
              </label>
              <Input value={reference} onChange={(e: any) => setReference(e.target.value)} placeholder="123 Main St" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
              Payload (JSON)
            </label>
            <textarea
              value={payloadJson}
              onChange={e => setPayloadJson(e.target.value)}
              rows={7}
              style={{
                width: "100%",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--ink-200)",
                background: "white",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <Button variant="primary" onClick={() => createSubmission().catch(e => setStatus(e.message))}>
              Create
            </Button>
            {status && <div style={{ fontSize: 13, color: status.startsWith("Created") ? "var(--ok-700)" : "var(--err-700)" }}>{status}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

