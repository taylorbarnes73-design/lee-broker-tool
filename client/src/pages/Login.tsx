import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "wouter";

// We import design primitives to build a nice looking login
import { Button, Input, Card, Icons } from "../design/index.jsx";

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

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
    await loginMutation.mutateAsync({ firstName, lastName, email });
  };

  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--ink-50)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--lee-crimson)', color: '#fff', fontWeight: 800, fontSize: 16,
            borderRadius: 6,
          }}>L</div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink-900)' }}>LEE &amp; ASSOCIATES</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-500)', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Broker Workspace
            </div>
          </div>
        </div>

        <Card padding="lg">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)' }}>Sign In</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 8 }}>Use your Lee email to access the broker tools.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>First Name</label>
                <Input value={firstName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)} required placeholder="Taylor" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Last Name</label>
                <Input value={lastName} onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)} required placeholder="Barnes" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Lee Email</label>
              <Input type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required placeholder="tbarnes@lee-associates.com" />
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
