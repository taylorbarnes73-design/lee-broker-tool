import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

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

function Router() {
  return (
    <Switch>
      {/* Single-purpose app: everything navigates to /tool */}
      <Route path="/" component={BrokerToolRedirect} />
      <Route component={BrokerToolRedirect} />
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
