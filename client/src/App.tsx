import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { Lock } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import PortalBrokerAdminRequestDetail from "./pages/PortalBrokerAdminRequestDetail";
import PortalAdminUsers from "./pages/PortalAdminUsers";
import PortalAdminSettings from "./pages/PortalAdminSettings";
import PortalAdminDealiusTools from "./pages/PortalAdminDealiusTools";
import PortalAdminListingImport from "./pages/PortalAdminListingImport";
import PortalVoucherFullForm from "./pages/PortalVoucherFullForm";
import PortalSignForm from "./pages/PortalSignForm";
import PortalListingForm from "./pages/PortalListingForm";
import PortalCompForm from "./pages/PortalCompForm";
import PortalMarketingForm from "./pages/PortalMarketingForm";
import PortalDocuments from "./pages/PortalDocuments";
import PortalQuickConvert from "./pages/PortalQuickConvert";
import PortalAccount from "./pages/PortalAccount";
import PortalAdminAuditLog from "./pages/PortalAdminAuditLog";
import PortalSubmissionDetail from "./pages/PortalSubmissionDetail";
import PortalSubmissions from "./pages/PortalSubmissions";
import PortalAdminRequest from "./pages/PortalAdminRequest";
import PortalWorkspace from "./pages/PortalWorkspace";

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

/** Public landing for the shared broker/admin product. */
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
      }}
    >
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <img
          src="/lee-newport-beach-fullcolor.png"
          alt="Lee & Associates Newport Beach"
          style={{ height: 56, width: "auto", display: "inline-block" }}
        />
        <h1 style={{
          fontFamily: "var(--font-sans)",
          fontSize: 28,
          fontWeight: 800,
          color: "var(--ink-900)",
          marginTop: 20,
          marginBottom: 10,
          letterSpacing: "-0.025em",
          lineHeight: 1.15,
        }}>
          Broker Portal
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-500)", lineHeight: 1.6, marginBottom: 28 }}>
          Sign in to open your guided broker workspace and submission tools.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href="/login?next=/portal/workspace"
            style={{
              display: "block",
              padding: "13px 20px",
              borderRadius: 8,
              background: "var(--lee-red, #98002E)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              letterSpacing: "0.01em",
              boxShadow: "0 1px 2px rgba(152,0,46,.18)",
            }}
          >
            Sign in to portal
          </a>
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: "var(--ink-400)" }}>
          <Link href="/portal/admin/login" style={{ color: "var(--ink-600)", fontWeight: 600 }}>
            Administrator sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Shown for unknown /portal/* paths so typos don't silently bounce users into the broker tool. */
function PortalNotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", minHeight: "60vh", alignItems: "center", justifyContent: "center", color: "var(--ink-600)", fontSize: 14, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔎</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink-900)" }}>Page not found</div>
      <div>That portal page doesn&apos;t exist. Check the address or head back to your home page.</div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Link href="/portal/workspace" style={{ color: "#98002E", fontWeight: 600 }}>Broker home</Link>
        <Link href="/portal/submissions" style={{ color: "#98002E", fontWeight: 600 }}>My submissions</Link>
      </div>
    </div>
  );
}

/** Bookmark-friendly alias: same login as `/login`, default return to submissions after sign-in. */
function AdminLoginEntry() {
  useEffect(() => {
    window.location.replace("/login?next=" + encodeURIComponent("/portal/workspace"));
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
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "var(--ink-0)",
          borderRadius: 12,
          border: "1px solid var(--ink-200)",
          padding: "28px 28px 24px",
          boxShadow: "var(--shadow-md)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "var(--lee-red-wash, #F4E3E8)",
            color: "var(--lee-red, #98002E)",
            marginBottom: 16,
          }}
        >
          <Lock size={20} aria-hidden />
        </div>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 800, color: "var(--ink-900)", margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
          Administrator access required
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-500)", lineHeight: 1.6, marginTop: 10, marginBottom: 22 }}>
          This area is restricted to platform administrators. You can continue with the shared broker workspace.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/portal/workspace"
            style={{
              display: "block",
              padding: "12px 18px",
              borderRadius: 8,
              background: "var(--lee-red, #98002E)",
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Go to broker home
          </Link>
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

function SharedSubmissionsEntry() {
  const { user } = useAuth();
  return user?.role === "admin"
    ? <Redirect to="/portal/admin/submissions" />
    : <PortalSubmissions />;
}

function SharedSubmissionDetailEntry() {
  const { user } = useAuth();
  if (user?.role === "admin") {
    const adminPath = window.location.pathname.replace(
      "/portal/submissions/",
      "/portal/admin/submissions/"
    );
    return <Redirect to={`${adminPath}${window.location.search}`} />;
  }
  return <PortalSubmissionDetail />;
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
          <SharedSubmissionsEntry />
        </PortalRoute>
      </Route>
      <Route path="/portal/submissions/:id">
        <PortalRoute>
          <SharedSubmissionDetailEntry />
        </PortalRoute>
      </Route>

      {/* Legacy / alias routes → redirect to unified submissions */}
      <Route path="/portal">
        <PortalRoute>
          <Redirect to="/portal/workspace" />
        </PortalRoute>
      </Route>
      <Route path="/portal/dashboard">
        <PortalRoute>
          <Redirect to="/portal/workspace" />
        </PortalRoute>
      </Route>
      <Route path="/dashboard">
        <PortalRoute>
          <Redirect to="/portal/workspace" />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin">
        <AdminPortalRoute>
          <Redirect to="/portal/admin/submissions" />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/submissions">
        <AdminPortalRoute>
          <PortalSubmissions />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/submissions/:id">
        <AdminPortalRoute>
          <PortalSubmissionDetail />
        </AdminPortalRoute>
      </Route>

      {/* Detail view for Broker Admin inbox items (linked from unified Submissions page) */}
      <Route path="/portal/admin/broker-admin/:id">
        <AdminPortalRoute>
          <PortalBrokerAdminRequestDetail />
        </AdminPortalRoute>
      </Route>

      <Route path="/portal/new">
        <PortalRoute>
          <Redirect to="/portal/workspace" />
        </PortalRoute>
      </Route>
      <Route path="/portal/workspace">
        <PortalRoute>
          <PortalWorkspace />
        </PortalRoute>
      </Route>
      <Route path="/portal/forms/voucher">
        <PortalRoute>
          <PortalVoucherFullForm />
        </PortalRoute>
      </Route>
      <Route path="/portal/forms/sign">
        <PortalRoute>
          <PortalSignForm />
        </PortalRoute>
      </Route>
      <Route path="/portal/forms/listing">
        <PortalRoute>
          <PortalListingForm />
        </PortalRoute>
      </Route>
      <Route path="/portal/forms/comp">
        <PortalRoute>
          <PortalCompForm />
        </PortalRoute>
      </Route>
      <Route path="/portal/forms/marketing-request">
        <PortalRoute>
          <PortalMarketingForm />
        </PortalRoute>
      </Route>
      <Route path="/portal/documents">
        <PortalRoute>
          <PortalDocuments />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin-request">
        <PortalRoute>
          <PortalAdminRequest />
        </PortalRoute>
      </Route>
      <Route path="/portal/convert">
        <PortalRoute>
          <PortalQuickConvert />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin/quick-convert">
        <AdminPortalRoute>
          <PortalQuickConvert />
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
          <PortalAdminAuditLog />
        </AdminPortalRoute>
      </Route>
      <Route path="/admin/audit-log">
        <AdminPortalRoute>
          <PortalAdminAuditLog />
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

      <Route path="/portal/*">
        <PortalRoute>
          <PortalNotFound />
        </PortalRoute>
      </Route>

      <Route component={PublicHome} />
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
