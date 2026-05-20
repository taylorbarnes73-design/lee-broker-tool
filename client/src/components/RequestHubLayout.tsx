import { Link, useLocation } from "wouter";
import { Home, FileText, List, GitBranch, LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ReactNode } from "react";

interface RequestHubLayoutProps {
  children: ReactNode;
}

export function RequestHubLayout({ children }: RequestHubLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === "/portal/request-hub") {
      return location === "/portal/request-hub";
    }
    return location.startsWith(path);
  };

  const handleLogout = () => {
    logout().finally(() => setLocation("/login"));
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "LA";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0">
        {/* Logo Section */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img
              src="/lee-newport-beach-fullcolor.png"
              alt="Lee & Associates Newport Beach"
              className="h-8 w-auto"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium tracking-wide uppercase">
            Request Hub
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2">
          <div className="space-y-1">
            <Link
              href="/portal/request-hub"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive("/portal/request-hub") && location === "/portal/request-hub"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">Home</span>
            </Link>
            <Link
              href="/portal/request-hub/submit"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive("/portal/request-hub/submit")
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <FileText className="h-5 w-5" />
              <span className="font-medium">Submit Request</span>
            </Link>
            <Link
              href="/portal/request-hub/my-requests"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive("/portal/request-hub/my-requests")
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <List className="h-5 w-5" />
              <span className="font-medium">My Requests</span>
            </Link>
            <Link
              href="/portal/request-hub/workflow"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive("/portal/request-hub/workflow")
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <GitBranch className="h-5 w-5" />
              <span className="font-medium">Workflow</span>
            </Link>
          </div>

          {/* Back to portal */}
          <div className="mt-6 pt-6 border-t border-sidebar-border">
            <Link
              href="/portal"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
            >
              ← Back to Portal
            </Link>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#7A0024] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name ?? "User"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email ?? ""}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
