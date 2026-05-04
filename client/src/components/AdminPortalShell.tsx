import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

type AdminPortalSection = "dashboard" | "my-submissions" | "admin-submissions" | "broker-admin" | "detail";

type AdminPortalShellProps = {
  section: AdminPortalSection;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems: ReadonlyArray<{
  section: AdminPortalSection;
  label: string;
  subhead: string;
  href: string;
  adminOnly?: boolean;
}> = [
  { section: "dashboard", label: "Dashboard", subhead: "Overview", href: "/portal" },
  { section: "my-submissions", label: "My submissions", subhead: "Broker queue", href: "/portal/submissions" },
  { section: "admin-submissions", label: "Admin queue", subhead: "Review work", href: "/portal/admin/submissions", adminOnly: true },
  { section: "broker-admin", label: "Broker Admin", subhead: "Inbox requests", href: "/portal/admin/broker-admin", adminOnly: true },
];

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

  return (
    <div className="admin-portal">
      <header className="admin-portal-topbar">
        <div className="admin-portal-brand">
          <img src="/lee-newport-beach-fullcolor.png" alt="Lee & Associates Newport Beach" />
          <div>
            <div className="admin-portal-kicker">Lee & Associates Newport Beach</div>
            <div className="admin-portal-brand-title">Broker Operations</div>
          </div>
        </div>

        <nav className="admin-portal-nav" aria-label="Admin portal navigation">
          {navItems
            .filter(item => !item.adminOnly || user?.role === "admin")
            .map(item => (
              <Link key={item.section} href={item.href}>
                <a className={`admin-portal-nav-item ${section === item.section ? "active" : ""}`}>
                  <span>{item.label}</span>
                  <small>{item.subhead}</small>
                </a>
              </Link>
            ))}
        </nav>

        <div className="admin-portal-user">
          <div>
            <strong>{user?.name || "Signed in"}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout().finally(() => setLocation("/login"));
            }}
          >
            Log out
          </button>
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
  );
}
