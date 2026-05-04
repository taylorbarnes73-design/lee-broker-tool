import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Card } from "../design/index.jsx";

export default function PortalAccount() {
  const { user } = useAuth();

  return (
    <AdminPortalShell
      section="account"
      eyebrow="Account"
      title="Profile"
      description="Your signed-in identity for the broker portal."
    >
      <Card padding="lg">
        <div style={{ display: "grid", gap: "var(--s-3)", fontSize: 14, color: "var(--ink-700)" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.08em" }}>NAME</div>
            <div style={{ color: "var(--ink-900)", fontWeight: 600 }}>{user?.name ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.08em" }}>EMAIL</div>
            <div style={{ color: "var(--ink-900)", fontWeight: 600 }}>{user?.email ?? "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.08em" }}>ROLE</div>
            <div style={{ color: "var(--ink-900)", fontWeight: 600 }}>
              {user?.role === "admin" ? "Administrator" : "Agent"}
            </div>
          </div>
        </div>
      </Card>
    </AdminPortalShell>
  );
}
