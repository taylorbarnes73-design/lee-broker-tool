import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import PortalBrokerAdminRequestDetail from "./pages/PortalBrokerAdminRequestDetail";
import PortalAdminUsers from "./pages/PortalAdminUsers";
import PortalAdminSettings from "./pages/PortalAdminSettings";
import PortalAdminDealiusTools from "./pages/PortalAdminDealiusTools";
import PortalAdminListingImport from "./pages/PortalAdminListingImport";
import PortalAccount from "./pages/PortalAccount";
import PortalSubmissionDetail from "./pages/PortalSubmissionDetail";
import PortalSubmissions from "./pages/PortalSubmissions";

/** Redirect component for renamed/merged routes */
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return (
    <div className="portal-loading">
      <div className="portal-loading-card">Redirecting…</div>
    </div>
  );
}

/**
 * Public landing for `/` - avoids sending everyone through `/tool` -> `/login`,
 * which felt like an admin-only entry. Broker HTML tool stays at `/tool`.
 */
function PublicHome() {
  return (
    <div
      className="lee-page-flow"
      style={{
        display: "flex",
        width: "100vw",
        minHeight: "100vh",
        background: "var(--ink-50)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Nunito Sans', 'Avenir Next', Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <img
          src="/lee-newport-beach-fullcolor.png"
          alt="Lee & Associates Newport Beach"
          style={{ height: 64, width: "auto", display: "inline-block" }}
        />
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink-900)", marginTop: 24, marginBottom: 8, letterSpacing: "-0.01em" }}>
          Broker Tool
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-600)", lineHeight: 1.5, marginBottom: 28 }}>
          Sign in for the broker portal and submission queue, or open the listing and forms workspace.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="/login?next=/tool"
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 10,
              background: "var(--lee-red, #98002E)",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            Sign in
          </a>
          <a
            href="/tool"
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 10,
              border: "1px solid var(--ink-200)",
              background: "#fff",
              color: "var(--ink-800)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open broker forms workspace
          </a>
        </div>
        <p style={{ marginTop: 28, fontSize: 13, color: "var(--ink-500)" }}>
          <Link href="/portal/admin/login" style={{ color: "var(--ink-700)", fontWeight: 600 }}>
            Administrator sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Full-screen redirect to the legacy broker workflow HTML app.
 *
 * Broker-facing workflows still live in broker_tool.html while the admin portal
 * is integrated into the React app under /portal.
 */
function BrokerToolRedirect() {
  useEffect(() => {
    window.location.replace("/tool");
  }, []);
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", alignItems: "center", justifyContent: "center", color: "#6b7280", fontFamily: "Inter, system-ui, sans-serif" }}>
      Opening Broker Tool...
    </div>
  );
}

/** Bookmark-friendly alias: same login as `/login`, default return to submissions after sign-in. */
function AdminLoginEntry() {
  useEffect(() => {
    window.location.replace("/login?next=" + encodeURIComponent("/portal/submissions"));
  }, []);
  return (
    <div className="portal-loading">
      <div className="portal-loading-card">Opening sign-in…</div>
    </div>
  );
}

function PortalRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });

  if (loading || !isAuthenticated) {
    return (
      <div className="portal-loading">
        <div className="portal-loading-card">Opening portal…</div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminAccessRequired() {
  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        minHeight: "100vh",
        background: "var(--ink-50)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "white",
          borderRadius: 16,
          border: "1px solid var(--ink-200)",
          padding: 28,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 999,
            background: "var(--ink-100)",
            color: "var(--ink-700)",
            marginBottom: 14,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          ·
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink-900)", margin: 0 }}>
          Administrator access required
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-600)", lineHeight: 1.55, marginTop: 8, marginBottom: 22 }}>
          This area is restricted to platform administrators. You can still continue with the broker dashboard
          or open the broker tool to build a new submission.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/portal/submissions"
            style={{
              display: "block",
              padding: "12px 18px",
              borderRadius: 10,
              background: "var(--brand-600, #A9223B)",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Broker dashboard
          </Link>
          <a
            href="/tool"
            style={{
              display: "block",
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid var(--ink-200)",
              background: "#fff",
              color: "var(--ink-800)",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Open broker tool
          </a>
        </div>
      </div>
    </div>
  );
}

function AdminPortalRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, user } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });

  if (loading || !isAuthenticated) {
    return (
      <div className="portal-loading">
        <div className="portal-loading-card">Opening admin portal…</div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return <AdminAccessRequired />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={PublicHome} />
      <Route path="/login" component={Login} />
      <Route path="/portal/admin/login" component={AdminLoginEntry} />

      {/* Primary submissions view (all users, replaces dashboard + separate queues) */}
      <Route path="/portal/submissions">
        <PortalRoute>
          <PortalSubmissions />
        </PortalRoute>
      </Route>
      <Route path="/portal/submissions/:id">
        <PortalRoute>
          <PortalSubmissionDetail />
        </PortalRoute>
      </Route>

      {/* Legacy / alias routes → redirect to unified submissions */}
      <Route path="/portal">
        <PortalRoute>
          <Redirect to="/portal/submissions" />
        </PortalRoute>
      </Route>
      <Route path="/portal/dashboard">
        <PortalRoute>
          <Redirect to="/portal/submissions" />
        </PortalRoute>
      </Route>
      <Route path="/dashboard">
        <PortalRoute>
          <Redirect to="/portal/submissions" />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin">
        <AdminPortalRoute>
          <Redirect to="/portal/submissions" />
        </AdminPortalRoute>
      </Route>

      {/* Detail view for Broker Admin inbox items (linked from unified Submissions page) */}
      <Route path="/portal/admin/broker-admin/:id">
        <AdminPortalRoute>
          <PortalBrokerAdminRequestDetail />
        </AdminPortalRoute>
      </Route>

      {/* Account */}
      <Route path="/portal/account">
        <PortalRoute>
          <PortalAccount />
        </PortalRoute>
      </Route>

      {/* Settings group */}
      <Route path="/portal/admin/settings">
        <AdminPortalRoute>
          <PortalAdminSettings />
        </AdminPortalRoute>
      </Route>
      <Route path="/admin/settings">
        <AdminPortalRoute>
          <PortalAdminSettings />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/users">
        <AdminPortalRoute>
          <PortalAdminUsers />
        </AdminPortalRoute>
      </Route>
      <Route path="/admin/users">
        <AdminPortalRoute>
          <PortalAdminUsers />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/audit-log">
        <AdminPortalRoute>
          <Redirect to="/portal/admin/users" />
        </AdminPortalRoute>
      </Route>
      <Route path="/admin/audit-log">
        <AdminPortalRoute>
          <Redirect to="/portal/admin/users" />
        </AdminPortalRoute>
      </Route>

      {/* Tools group */}
      <Route path="/portal/admin/dealius-tools">
        <AdminPortalRoute>
          <PortalAdminDealiusTools />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/listing-import">
        <AdminPortalRoute>
          <PortalAdminListingImport />
        </AdminPortalRoute>
      </Route>
      <Route path="/admin/listing-import">
        <AdminPortalRoute>
          <PortalAdminListingImport />
        </AdminPortalRoute>
      </Route>

      <Route component={BrokerToolRedirect} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" duration={4000} />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
