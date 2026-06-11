import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Button, Card, Field, Input } from "../design/index.jsx";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PlatformMe = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  office: string | null;
};

function isPlatformMe(value: unknown): value is PlatformMe {
  return Boolean(value && typeof value === "object" && typeof (value as PlatformMe).id === "string");
}

export default function PortalAccount() {
  const { user } = useAuth();
  const [platformMe, setPlatformMe] = useState<PlatformMe | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(body => {
        if (!alive) return;
        if (isPlatformMe(body)) setPlatformMe(body);
        else setPlatformMe(null);
      })
      .catch(() => {
        if (alive) setPlatformMe(null);
      });
    return () => {
      alive = false;
    };
  }, [user?.openId]);

  async function handlePasswordChange() {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(body?.message ?? "Password updated.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPortalShell
      section="account"
      eyebrow="Account"
      title="Profile"
      description="Your signed-in identity for the broker portal."
    >
      <div style={{ display: "grid", gap: 12 }}>
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
            {user?.office ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.08em" }}>OFFICE</div>
                <div style={{ color: "var(--ink-900)", fontWeight: 600 }}>{user.office}</div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)", marginBottom: 12 }}>Change password</div>
          {platformMe ? (
            <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
              <Field label="Current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={saving}
                />
              </Field>
              <Field label="New password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </Field>
              <div>
                <Button onClick={handlePasswordChange} disabled={saving || !currentPassword || !newPassword}>
                  {saving ? "Saving…" : "Update password"}
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink-600)", maxWidth: 520 }}>
              Password change is available when you sign in with your platform username and password. If you use
              email-only broker sign-in, ask an admin to set or reset your password from the Users page.
            </div>
          )}
        </Card>
      </div>
    </AdminPortalShell>
  );
}
