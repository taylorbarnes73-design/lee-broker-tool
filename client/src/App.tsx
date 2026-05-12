import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { Route, Switch } from "wouter";
import { useEffect, type ReactNode } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import PortalAdminSubmissions from "./pages/PortalAdminSubmissions";
import PortalBrokerAdminRequestDetail from "./pages/PortalBrokerAdminRequestDetail";
import PortalBrokerAdminRequests from "./pages/PortalBrokerAdminRequests";
import PortalAdminAuditLog from "./pages/PortalAdminAuditLog";
import PortalAdminUsers from "./pages/PortalAdminUsers";
import PortalAdminSettings from "./pages/PortalAdminSettings";
import PortalAdminDealiusTools from "./pages/PortalAdminDealiusTools";
import PortalAdminListingImport from "./pages/PortalAdminListingImport";
import PortalAccount from "./pages/PortalAccount";
import PortalDashboard from "./pages/PortalDashboard";
import PortalSubmissionDetail from "./pages/PortalSubmissionDetail";
import PortalSubmissions from "./pages/PortalSubmissions";

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
      Opening Broker Tool…
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
        <div className="portal-loading-card">Opening admin portal...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminPortalRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, user } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });

  if (loading || !isAuthenticated) {
    return (
      <div className="portal-loading">
        <div className="portal-loading-card">Opening admin portal...</div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="portal-loading">
        <div className="portal-loading-card">Administrator access required.</div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={BrokerToolRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/portal">
        <PortalRoute>
          <PortalDashboard />
        </PortalRoute>
      </Route>
      <Route path="/dashboard">
        <PortalRoute>
          <PortalDashboard />
        </PortalRoute>
      </Route>
      <Route path="/portal/submissions">
        <PortalRoute>
          <PortalSubmissions />
        </PortalRoute>
      </Route>
      <Route path="/portal/account">
        <PortalRoute>
          <PortalAccount />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin/submissions">
        <AdminPortalRoute>
          <PortalAdminSubmissions />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/admin/broker-admin">
        <AdminPortalRoute>
          <PortalBrokerAdminRequests />
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
      <Route path="/portal/admin/settings">
        <AdminPortalRoute>
          <PortalAdminSettings />
        </AdminPortalRoute>
      </Route>
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
      <Route path="/admin/settings">
        <AdminPortalRoute>
          <PortalAdminSettings />
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
      <Route path="/portal/admin/broker-admin/:id">
        <AdminPortalRoute>
          <PortalBrokerAdminRequestDetail />
        </AdminPortalRoute>
      </Route>
      <Route path="/portal/submissions/:id">
        <PortalRoute>
          <PortalSubmissionDetail />
        </PortalRoute>
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
