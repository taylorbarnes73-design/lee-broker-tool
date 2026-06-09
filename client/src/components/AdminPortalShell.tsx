import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, HelpCircle, Home, LogOut, Menu, User, X } from "lucide-react";
import HelpPanel from "@/components/HelpPanel";
import { getHelpForRoute } from "@/lib/helpContent";

type AdminPortalSection =
  | "new-submission"
  | "submissions"
  | "quick-convert"
  | "settings"
  | "users"
  | "dealius-tools"
  | "listing-import"
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

const settingsNav: ReadonlyArray<NavItem> = [
  { section: "settings", label: "Settings", subhead: "Branding & workflow", href: "/portal/admin/settings", adminOnly: true },
  { section: "users", label: "Users", subhead: "Brokers & admins", href: "/portal/admin/users", adminOnly: true },
];

const toolsNav: ReadonlyArray<NavItem> = [
  {
    section: "quick-convert",
    label: "Quick convert",
    subhead: "Upload → form",
    href: "/portal/admin/quick-convert",
    adminOnly: true,
  },
  { section: "dealius-tools", label: "Dealius", subhead: "Push & attachments", href: "/portal/admin/dealius-tools", adminOnly: true },
  {
    section: "listing-import",
    label: "Listing import",
    subhead: "Brochure → Buildout",
    href: "/portal/admin/listing-import",
    adminOnly: true,
  },
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
        <Link
          key={item.section}
          href={item.href}
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
  const [location, setLocation] = useLocation();
  const branding = usePublicBranding();
  const isAdmin = user?.role === "admin";
  const logoSrc = branding.logo_url?.trim() || "/lee-newport-beach-fullcolor.png";
  const accent = branding.primary_color || "#98002E";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);
  const helpEntry = getHelpForRoute(location);

  // Close the mobile drawer whenever the route (section prop) changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [section]);

  // Lock the page scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = mobileNavOpen ? "hidden" : previous;
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const portalStyle = {
    ["--admin-accent" as string]: accent,
  } as CSSProperties;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "LA";

  const sidebarContents = (
    <>
      <Link href="/portal/new" className="admin-portal-sidebar-brand admin-portal-sidebar-home" aria-label="Portal home">
        <img
          src={logoSrc}
          alt="Lee & Associates Newport Beach"
          className="admin-portal-sidebar-logo"
        />
        <div className="admin-portal-sidebar-rule" aria-hidden />
        <div className="admin-portal-sidebar-subtitle">BROKER PORTAL</div>
      </Link>

      <nav className="admin-portal-sidebar-nav" aria-label="Primary">
        <Link
          href="/portal/new"
          className={`admin-portal-nav-item ${section === "new-submission" ? "active" : ""}`}
          style={
            section === "new-submission"
              ? ({ borderColor: `${accent}33`, color: accent } as CSSProperties)
              : undefined
          }
        >
          <span>{isAdmin ? "New submission" : "Home"}</span>
          <small>{isAdmin ? "Listing, sign, voucher" : "Start a request"}</small>
        </Link>
        <Link
          href="/portal/submissions"
          className={`admin-portal-nav-item ${section === "submissions" ? "active" : ""}`}
          style={
            section === "submissions"
              ? ({ borderColor: `${accent}33`, color: accent } as CSSProperties)
              : undefined
          }
        >
          <span>{isAdmin ? "Submissions" : "My submissions"}</span>
          <small>{isAdmin ? "Queue & inbox" : "Track status"}</small>
        </Link>
      </nav>

      {isAdmin && (
        <>
          <div className="admin-portal-nav-section-label">SETTINGS</div>
          <nav className="admin-portal-sidebar-nav" aria-label="Settings">
            <NavBlock items={settingsNav} active={section} accent={accent} />
          </nav>

          <div className="admin-portal-nav-section-label">TOOLS</div>
          <nav className="admin-portal-sidebar-nav" aria-label="Tools">
            <NavBlock items={toolsNav} active={section} accent={accent} />
          </nav>
        </>
      )}

      {/* User profile footer */}
      <div className="admin-portal-sidebar-spacer" aria-hidden />
      <div className="admin-portal-sidebar-user">
        <div
          className="admin-portal-sidebar-user-avatar"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="admin-portal-sidebar-user-info">
          <div className="admin-portal-sidebar-user-name">{user?.name ?? "User"}</div>
          <div className="admin-portal-sidebar-user-role">
            {user?.role === "admin" ? "Administrator" : "Agent"}
          </div>
        </div>
        <div className="admin-portal-sidebar-user-actions">
          <Link
            href="/portal/account"
            className="admin-portal-sidebar-user-btn"
            aria-label="Profile"
          >
            <User size={14} aria-hidden />
          </Link>
          <button
            type="button"
            className="admin-portal-sidebar-user-btn"
            onClick={() => logout().finally(() => setLocation("/login"))}
            aria-label="Sign out"
          >
            <LogOut size={14} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-portal" style={portalStyle}>
      <aside className="admin-portal-sidebar" aria-label="Portal navigation">
        {sidebarContents}
      </aside>

      {mobileNavOpen && (
        <div
          className="admin-portal-mobile-overlay"
          role="presentation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={`admin-portal-sidebar admin-portal-sidebar-mobile ${mobileNavOpen ? "open" : ""}`}
        aria-label="Portal navigation (mobile)"
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className="admin-portal-mobile-close"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        >
          <X size={16} aria-hidden />
        </button>
        {sidebarContents}
      </aside>

      <div className="admin-portal-body">
        <header className="admin-portal-header">
          <button
            type="button"
            className="admin-portal-mobile-trigger"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} aria-hidden />
          </button>
          <Link
            href="/portal/new"
            className={`admin-portal-header-home ${section === "new-submission" ? "active" : ""}`}
            aria-label="Portal home"
            aria-current={section === "new-submission" ? "page" : undefined}
          >
            <Home size={16} aria-hidden />
            <span>Home</span>
          </Link>
          <a href="/tool" className="admin-portal-header-workspace">
            <ExternalLink size={15} aria-hidden />
            <span>Forms workspace</span>
          </a>
          <div className="admin-portal-header-spacer" />
          <button
            ref={helpTriggerRef}
            type="button"
            className="admin-portal-help-trigger"
            onClick={() => setHelpOpen(true)}
            aria-label="Help for this page"
          >
            <HelpCircle size={18} aria-hidden />
          </button>
        </header>

        <main className="admin-portal-main">
          <section className="admin-portal-hero">
            <div className="admin-portal-hero-text">
              <div className="admin-portal-eyebrow">{eyebrow}</div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {actions && <div className="admin-portal-actions">{actions}</div>}
          </section>
          {children}
        </main>
      </div>

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        entry={helpEntry}
        returnFocusTo={helpTriggerRef.current}
      />
    </div>
  );
}
