import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";

// Design shell primitives (AppShell + modal components live in the design system)
import { AppShell, AiPanel, ProfileModal } from "./design/index.jsx";
// Functional pages — real data, not scratch
import Login from "./pages/Login";
import ListingEntryScreen from "./pages/ListingScreen";
import SignRequestScreen from "./pages/SignScreen";
import VoucherScreen from "./pages/VoucherScreen";
import CompScreen, { AdminScreen, ContractScreen, DocsScreen } from "./pages/CompScreen";

/**
 * Full-screen redirect to the production broker tool HTML app.
 *
 * The original broker_tool.html is the fully-functional production workspace
 * (Listing Entry, Sign Request, Commission Voucher, Comp Input, Admin Portal,
 * PDF export, email drafting, S3 uploads, etc.). The Express server in
 * `server/_core/index.ts` authenticates the request and serves the HTML directly,
 * so a hard navigation is the safest way to hand off from the React SPA.
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

/**
 * Optional "beta" layout for the redesigned React UI. This is intentionally
 * opt-in and reachable only under /beta/* so the production tool keeps
 * working uninterrupted. We'll graduate pages here back to the main routes
 * as each one reaches functional parity with broker_tool.html.
 */
function BetaLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [aiOpen, setAiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { user, loading } = useAuth();

  // Map /beta/<tab> -> activeTab
  const activeTab = location === "/beta" ? "listing" : location.replace(/^\/beta\/?/, "");

  if (loading) return null;
  if (!user) return <Login />;

  const handleTab = (tab: string) => {
    setLocation(tab === "listing" ? "/beta" : `/beta/${tab}`);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <AppShell
        activeTab={activeTab}
        onTab={handleTab}
        onAiClick={() => setAiOpen(true)}
        onProfileClick={() => setProfileOpen(true)}
        viewportW="100%"
        viewportH="100%"
        profile={{
          name: user.name,
          initials: user.name
            ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
            : "L",
          title: user.role === "admin" ? "Administrator" : "Broker",
        }}
      >
        {children}
      </AppShell>
      {aiOpen && <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />}
      {profileOpen && <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

/**
 * Root wrapper — handles auth gating for the whole SPA.
 * Authenticated users land on the production broker_tool.html;
 * unauthenticated users see the Login screen.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Primary app: land logged-in users on the fully-functional broker tool */}
      <Route path="/">
        <AuthGate>
          <BrokerToolRedirect />
        </AuthGate>
      </Route>

      {/* Beta (new React UI) — kept behind an explicit prefix while pages reach parity */}
      <Route path="/beta">
        <BetaLayout>
          <ListingEntryScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/sign">
        <BetaLayout>
          <SignRequestScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/voucher">
        <BetaLayout>
          <VoucherScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/comp">
        <BetaLayout>
          <CompScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/admin">
        <BetaLayout>
          <AdminScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/contract">
        <BetaLayout>
          <ContractScreen />
        </BetaLayout>
      </Route>
      <Route path="/beta/docs">
        <BetaLayout>
          <DocsScreen />
        </BetaLayout>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
