import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useState } from "react";

// Import the new design components
import { 
  AppShell, 
  ListingEntryScreen, 
  SignRequestScreen, 
  VoucherScreen, 
  CompScreen, 
  AdminScreen, 
  ContractScreen, 
  DocsScreen, 
  AiPanel, 
  ProfileModal 
} from "./design/index.jsx";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [aiOpen, setAiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Map route to activeTab
  const activeTab = location === "/" ? "listing" : location.substring(1);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <AppShell
        activeTab={activeTab}
        onTab={(tab: string) => setLocation(tab === 'listing' ? '/' : `/${tab}`)}
        onAiClick={() => setAiOpen(true)}
        onProfileClick={() => setProfileOpen(true)}
        viewportW="100%"
        viewportH="100%"
      >
        {children}
      </AppShell>
      {aiOpen && <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />}
      {profileOpen && <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path={"/"} component={ListingEntryScreen} />
        <Route path={"/sign"} component={SignRequestScreen} />
        <Route path={"/voucher"} component={VoucherScreen} />
        <Route path={"/comp"} component={CompScreen} />
        <Route path={"/admin"} component={AdminScreen} />
        <Route path={"/contract"} component={ContractScreen} />
        <Route path={"/docs"} component={DocsScreen} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
