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
import PortalAdminUsers from "./pages/PortalAdminUsers";
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
      <Route path="/portal/admin/submissions">
        <PortalRoute>
          <PortalAdminSubmissions />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin/broker-admin">
        <PortalRoute>
          <PortalBrokerAdminRequests />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin/users">
        <PortalRoute>
          <PortalAdminUsers />
        </PortalRoute>
      </Route>
      <Route path="/admin/users">
        <PortalRoute>
          <PortalAdminUsers />
        </PortalRoute>
      </Route>
      <Route path="/portal/admin/broker-admin/:id">
        <PortalRoute>
          <PortalBrokerAdminRequestDetail />
        </PortalRoute>
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
