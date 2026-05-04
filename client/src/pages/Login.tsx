import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, isAuthRedirectEnabled } from "@/const";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { usePublicBranding } from "@/hooks/usePublicBranding";

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
  const branding = usePublicBranding();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = normalizeLeeEmail(email);
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) {
        setError(j?.error ?? "Sign in failed.");
        return;
      }
      await refresh();
      setLocation("/portal");
    } catch {
      setError("Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (user) setLocation("/portal");
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
    <div className="lee-page-flow" style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--ink-50)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 440 }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <img
            src="/lee-newport-beach-fullcolor.png"
            alt={branding.company_name}
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

            <Button type="submit" variant="primary" size="lg" disabled={submitting || loading} style={{ marginTop: 8 }}>
              {submitting ? "Signing in..." : "Continue to Workspace"}
            </Button>

            {error && (
              <div style={{ padding: 12, background: 'var(--err-50)', color: 'var(--err-700)', borderRadius: 8, fontSize: 13, border: '1px solid var(--err-200)' }}>
                {error}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
