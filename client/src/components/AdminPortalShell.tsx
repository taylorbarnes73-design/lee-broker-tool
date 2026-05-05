import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import type { CSSProperties, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type AdminPortalSection =
  | "dashboard"
  | "my-submissions"
  | "admin-submissions"
  | "broker-admin"
  | "users"
  | "settings"
  | "audit-log"
  | "account"
  | "detail";

type AdminPortalShellProps = {
  section: AdminPortalSection;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

type NavItem = {
  section: AdminPortalSection;
  label: string;
  subhead: string;
  href: string;
  adminOnly?: boolean;
};

const mainNav: ReadonlyArray<NavItem> = [
  { section: "dashboard", label: "Dashboard", subhead: "Overview", href: "/portal" },
  { section: "my-submissions", label: "My submissions", subhead: "Broker queue", href: "/portal/submissions" },
  { section: "admin-submissions", label: "Admin queue", subhead: "Review work", href: "/portal/admin/submissions", adminOnly: true },
  { section: "broker-admin", label: "Broker Admin", subhead: "Inbox requests", href: "/portal/admin/broker-admin", adminOnly: true },
];

const peopleNav: ReadonlyArray<NavItem> = [
  { section: "users", label: "Users", subhead: "Brokers & admins", href: "/portal/admin/users", adminOnly: true },
];

const settingsNav: ReadonlyArray<NavItem> = [
  { section: "settings", label: "Settings", subhead: "Branding & workflow", href: "/portal/admin/settings", adminOnly: true },
  { section: "audit-log", label: "Audit log", subhead: "Security events", href: "/portal/admin/audit-log", adminOnly: true },
];

function NavBlock({
  items,
  active,
  accent,
}: {
  items: ReadonlyArray<NavItem>;
  active: AdminPortalSection;
  accent: string;
}) {
  return (
    <>
      {items.map(item => (
        <Link key={item.section} href={item.href}>
          <a
            className={`admin-portal-nav-item ${active === item.section ? "active" : ""}`}
            style={
              active === item.section
                ? ({
                    borderColor: `${accent}33`,
                    color: accent,
                  } as CSSProperties)
                : undefined
            }
          >
            <span>{item.label}</span>
            <small>{item.subhead}</small>
          </a>
        </Link>
      ))}
    </>
  );
}

export default function AdminPortalShell({
  section,
  eyebrow = "Admin Portal",
  title,
  description,
  actions,
  children,
}: AdminPortalShellProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const branding = usePublicBranding();
  const isAdmin = user?.role === "admin";
  const logoSrc = branding.logo_url?.trim() || "/lee-newport-beach-fullcolor.png";
  const accent = branding.primary_color || "#A6192E";

  const portalStyle = {
    ["--admin-accent" as string]: accent,
  } as CSSProperties;

  const roleLabel = user?.role === "admin" ? "Admin" : "Agent";

  return (
    <div className="admin-portal" style={portalStyle}>
      <aside className="admin-portal-sidebar" aria-label="Portal navigation">
        <div className="admin-portal-sidebar-brand">
          <img src={logoSrc} alt={branding.company_name} />
          <div>
            <div className="admin-portal-kicker">{branding.company_name}</div>
            <div className="admin-portal-brand-title">Broker Operations</div>
          </div>
        </div>

        <nav className="admin-portal-sidebar-nav" aria-label="Primary">
          <NavBlock items={mainNav.filter(i => !i.adminOnly || isAdmin)} active={section} accent={accent} />
        </nav>

        <div className="admin-portal-nav-section-label">FORMS</div>
        <nav className="admin-portal-sidebar-nav" aria-label="Broker HTML tool">
          <a href="/tool" className="admin-portal-nav-item">
            <span>Broker submission tool</span>
            <small>Listings, comps, PDFs</small>
          </a>
        </nav>

        {isAdmin && (
          <>
            <div className="admin-portal-nav-section-label">PEOPLE</div>
            <nav className="admin-portal-sidebar-nav" aria-label="People">
              <NavBlock items={peopleNav} active={section} accent={accent} />
            </nav>

            <div className="admin-portal-nav-section-label">SETTINGS</div>
            <nav className="admin-portal-sidebar-nav" aria-label="Settings">
              <NavBlock items={settingsNav} active={section} accent={accent} />
            </nav>
          </>
        )}
      </aside>

      <div className="admin-portal-body">
        <header className="admin-portal-header">
          <div className="admin-portal-header-spacer" />
          <div className="admin-portal-session">
            <span className="admin-portal-session-text">
              Logged in as <strong>{user?.name ?? "User"}</strong>
              {user?.role === "admin" ? " (Admin)" : user ? " (Agent)" : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="admin-portal-session-trigger">
                  Menu
                  <ChevronDown size={14} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onSelect={() => setLocation("/portal/account")}>Profile</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    logout().finally(() => setLocation("/login"));
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="admin-portal-main">
          <section className="admin-portal-hero">
            <div>
              <div className="admin-portal-eyebrow">{eyebrow}</div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {actions && <div className="admin-portal-actions">{actions}</div>}
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
