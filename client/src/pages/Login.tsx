import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, isAuthRedirectEnabled } from "@/const";
import { parseLeeLoginIdentifier } from "@shared/leeLogin";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { usePublicBranding } from "@/hooks/usePublicBranding";

// We import design primitives to build a nice looking login
import { Button, Input, Card, Icons } from "../design/index.jsx";

function normalizeLoginIdentifier(raw: string) {
  return raw.trim().toLowerCase();
}

export function buildLoginRequestBody(identifier: string, password: string) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const trimmedPassword = password.trim();

  if (trimmedPassword) {
    return {
      normalizedIdentifier,
      requestBody: {
        username_or_email: normalizedIdentifier,
        password: trimmedPassword,
      },
    };
  }

  return {
    normalizedIdentifier,
    requestBody: {
      email: normalizedIdentifier,
    },
  };
}

function getSafeNextPath() {
  if (typeof window === "undefined") return "/portal/new";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/portal/new";
  return next;
}

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const branding = usePublicBranding();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
    const { normalizedIdentifier, requestBody } = buildLoginRequestBody(identifier, password);
    const loginId = parseLeeLoginIdentifier(normalizedIdentifier);
    if (!loginId.ok) {
      setError(loginId.error);
      return;
    }
    if (normalizedIdentifier !== identifier) setIdentifier(normalizedIdentifier);
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) {
        const message = j?.error?.message ?? j?.error ?? "Sign in failed.";
        setError(message === "Local auth is disabled." && !password.trim() ? "Enter your password to sign in." : message);
        return;
      }
      await refresh();
      setLocation(getSafeNextPath());
    } catch {
      setError("Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (user) setLocation(getSafeNextPath());
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
                Redirecting to sign in...
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
    <div className="lee-page-flow" style={{ display: 'flex', width: '100vw', minHeight: '100vh', background: 'var(--ink-50)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 440, maxWidth: '100%' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <img
            src="/lee-newport-beach-fullcolor.png"
            alt={branding.company_name}
            style={{ height: 64, width: 'auto', display: 'inline-block' }}
          />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', marginTop: 14, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Broker portal
          </div>
        </div>

        <Card padding="lg">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.025em' }}>Sign In</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 8 }}>Use your Lee Broker Tool account. Brokers use the portal and submission queue; administrators have additional tools after sign-in.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="login-identifier"
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}
              >
                Lee username or email
              </label>
              <Input
                id="login-identifier"
                type="text"
                inputMode="email"
                prefix={<Icons.User size={15} />}
                value={identifier}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)}
                onBlur={() => setIdentifier(normalizeLoginIdentifier(identifier))}
                required
                autoComplete="username"
                placeholder="tbarnes or tbarnes@lee-associates.com"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password if your account uses one"
              />
            </div>

            <Button type="submit" variant="primary" size="lg" disabled={submitting || loading} style={{ marginTop: 8 }}>
              {submitting ? "Signing in..." : "Continue to Portal"}
            </Button>

            {error && (
              <div style={{ padding: 12, background: 'var(--err-50)', color: 'var(--err-700)', borderRadius: 8, fontSize: 13, border: '1px solid var(--err-200)' }}>
                {error}
              </div>
            )}
          </form>
        </Card>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--ink-600)" }}>
          <a href="/tool" style={{ color: "var(--ink-800)", fontWeight: 600 }}>
            Open broker forms &amp; comp workspace
          </a>{" "}
          <span style={{ color: "var(--ink-400)" }}>(HTML tool)</span>
        </p>
      </div>
    </div>
  );
}
