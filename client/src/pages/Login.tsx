import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl, isAuthRedirectEnabled } from "@/const";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";

// We import design primitives to build a nice looking login
import { Button, Input, Card, Icons } from "../design/index.jsx";

function normalizeLeeEmail(raw: string) {
  const value = raw.trim();
  if (!value) return value;
  if (value.includes("@")) return value.toLowerCase();
  return `${value}@lee-associates.com`.toLowerCase();
}

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");

  // If OAuth redirect is enabled, do not show the local login UI at all.
  // This avoids the "double login" experience where the SPA renders a login
  // form but the app also navigates to the external OAuth portal.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) return;
    if (!isAuthRedirectEnabled()) return;

    const loginUrl = getLoginUrl();
    if (!loginUrl) return;

    window.location.href = loginUrl;
  }, [user]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (result.success) {
        await refresh();
        setLocation("/"); // Redirect to main app
      }
    },
  });

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeLeeEmail(email);
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    await loginMutation.mutateAsync({
      email: normalizedEmail,
    });
  };

  useEffect(() => {
    if (user) setLocation("/");
  }, [setLocation, user]);

  const oauthRedirectEnabled =
    typeof window !== "undefined" &&
    !user &&
    isAuthRedirectEnabled() &&
    Boolean(getLoginUrl());

  if (oauthRedirectEnabled) {
    return (
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          background: "var(--ink-50)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 440 }}>
          <Card padding="lg">
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)" }}>
                Redirecting to sign in…
              </h1>
              <p style={{ fontSize: 14, color: "var(--ink-500)", marginTop: 8 }}>
                If you are not redirected automatically, use the button below.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={loading}
                style={{ marginTop: 16, width: "100%" }}
                onClick={() => {
                  const url = getLoginUrl();
                  if (url) window.location.href = url;
                }}
              >
                Continue to Sign In
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--ink-50)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 440 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <img
            src="/lee-newport-beach-fullcolor.png"
            alt="Lee & Associates Newport Beach"
            style={{ height: 64, width: 'auto', display: 'inline-block' }}
          />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', marginTop: 14, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Broker Workspace
          </div>
        </div>

        <Card padding="lg">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)' }}>Sign In</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 8 }}>Type your Lee username or email to access the broker tools. No password required.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Lee Username or Email</label>
              <Input
                type="text"
                inputMode="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                onBlur={() => setEmail(normalizeLeeEmail(email))}
                required
                autoComplete="email"
                placeholder="tbarnes"
              />
              <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6, marginBottom: 0 }}>
                We will add @lee-associates.com automatically.
              </p>
            </div>

            <Button type="submit" variant="primary" size="lg" disabled={loginMutation.isPending || loading} style={{ marginTop: 8 }}>
              {loginMutation.isPending ? "Signing in..." : "Continue to Workspace"}
            </Button>

            {loginMutation.data && !loginMutation.data.success && (
              <div style={{ padding: 12, background: 'var(--err-50)', color: 'var(--err-700)', borderRadius: 8, fontSize: 13, border: '1px solid var(--err-200)' }}>
                {loginMutation.data.error}
              </div>
            )}
            {loginMutation.error && (
              <div style={{ padding: 12, background: 'var(--err-50)', color: 'var(--err-700)', borderRadius: 8, fontSize: 13, border: '1px solid var(--err-200)' }}>
                {loginMutation.error.message}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
