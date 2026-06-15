import { type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import {
  Inbox,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { Icons } from "@/design/index.jsx";

/**
 * Portal home at /portal/workspace — the branded broker landing/launchpad.
 *
 * Every tool is now a native React page; the legacy vanilla-JS iframe
 * (broker_tool.html) has been retired, so this is a pure home view with cards
 * that link straight to the native form routes. See docs/FRAMEWORK_MIGRATION.md.
 */

const HOME_TOOLS = [
  {
    Icon: Icons.Listing,
    title: "Listings",
    desc: "Enter industrial, office, retail or land listings with a guided step flow and push them straight to the office record.",
    meta: "Open listing entry",
    href: "/portal/forms/listing",
  },
  {
    Icon: Icons.Sign,
    title: "Sign Orders",
    desc: "Configure mount type and panel sizes, add a name rider, and send the order to the vendor with an auto PO #.",
    meta: "Order signage",
    href: "/portal/forms/sign",
  },
  {
    Icon: Icons.Voucher,
    title: "Commission Vouchers",
    desc: "Split commissions across agents, build the rent schedule, and submit to Dealius for processing.",
    meta: "Start a voucher",
    href: "/portal/forms/voucher",
  },
  {
    Icon: Icons.Comp,
    title: "Comparables",
    desc: "Record a lease or sale comp — property, terms, brokers and pricing — straight into the office comp set.",
    meta: "Add a comp",
    href: "/portal/forms/comp",
  },
  {
    Icon: Icons.Comp,
    title: "Comp Reports",
    desc: "Search the published lease and sale comp dataset by city, market, size and date — with full property and broker detail.",
    meta: "Search comps",
    href: "/portal/comp-reports",
  },
  {
    Icon: Icons.Wand,
    title: "Convert",
    desc: "Drop a lease, LOI or exclusive and turn it into a voucher, sign order, listing or branded PDF.",
    meta: "Convert a document",
    href: "/portal/convert",
  },
  {
    Icon: Icons.Send,
    title: "Marketing",
    desc: "Request a flyer, brochure, social post or campaign — with pre-filled property and agent details.",
    meta: "Submit a request",
    href: "/portal/forms/marketing-request",
  },
  {
    Icon: Icons.Docs,
    title: "Documents",
    desc: "Blank forms, listing agreements, lease and purchase docs, and reference PDFs — all searchable.",
    meta: "Browse documents",
    href: "/portal/documents",
  },
] as const;

export default function PortalWorkspace() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const branding = usePublicBranding();
  const isAdmin = user?.role === "admin";
  const logoSrc = branding.logo_url?.trim() || "/lee-newport-beach-fullcolor.png";
  const accent = branding.primary_color || "#98002E";

  const pageStyle = { ["--admin-accent" as string]: accent } as CSSProperties;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="portal-workspace-page" style={pageStyle}>
      <header className="portal-workspace-header">
        <Link href="/portal/workspace" className="portal-workspace-brand" aria-label="Portal home">
          <img src={logoSrc} alt="Lee & Associates Newport Beach" />
          <span className="portal-workspace-brand-label">Broker Workspace</span>
        </Link>
        <div className="portal-workspace-header-spacer" />
        <Link href="/portal/submissions" className="portal-workspace-header-link">
          <Inbox size={15} aria-hidden />
          <span>My submissions</span>
        </Link>
        <Link href="/portal/account" className="portal-workspace-header-link" aria-label="Account">
          <User size={15} aria-hidden />
          <span>{user?.name ?? "Account"}</span>
        </Link>
        {isAdmin && (
          <Link href="/portal/admin" className="portal-workspace-admin-btn" data-testid="workspace-admin-button">
            <Shield size={15} aria-hidden />
            <span>Admin</span>
          </Link>
        )}
        <button
          type="button"
          className="portal-workspace-header-link portal-workspace-signout"
          onClick={() => logout().finally(() => setLocation("/login"))}
          aria-label="Sign out"
        >
          <LogOut size={15} aria-hidden />
          <span>Sign out</span>
        </button>
      </header>

      <div className="pwh-root">
        {/* Hero */}
        <section className="pwh-hero">
          <h1 className="pwh-hero-title">
            {greeting},{" "}
            <span className="pwh-hero-name">{firstName ?? "there"}</span>
          </h1>
          <p className="pwh-hero-subtitle">
            Listing entry, sign orders and commission vouchers — consolidated into a single tool, with Deal Assist to fill the forms for you and a portal to track everything you submit.
          </p>
          <Link href="/portal/forms/voucher" className="pwh-hero-cta">
            Open Broker Desk <Icons.Arrow size={16} />
          </Link>
        </section>

        {/* Tools */}
        <section className="pwh-tools">
          <div className="pwh-section-inner">
            <div className="lee-eyebrow pwh-eyebrow">The toolkit</div>
            <h2 className="pwh-section-heading">Every tool, one login</h2>
            <div className="pwh-tool-grid">
              {HOME_TOOLS.map(({ Icon, title, desc, meta, href }) => (
                <Link key={title} href={href} className="pwh-tool-card">
                  <div className="pwh-tool-icon-wrap"><Icon size={22} /></div>
                  <div className="pwh-tool-title">{title}</div>
                  <div className="pwh-tool-desc">{desc}</div>
                  <div className="pwh-tool-meta">{meta} <Icons.Arrow size={13} /></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* DealAssist */}
        <section className="pwh-da-section">
          <div className="pwh-section-inner">
            <div className="pwh-da-gradient-border">
              <div className="pwh-da-inner">
                <div className="pwh-da-left">
                  <span className="pwh-da-badge">
                    <Icons.Sparkles size={12} /> Deal Assist
                  </span>
                  <h2 className="pwh-da-title">Skip the typing.</h2>
                  <p className="pwh-da-body">
                    The AI assistant reads your documents and fills the forms — so you spend time on deals, not data entry.
                  </p>
                </div>
                <div className="pwh-da-checklist">
                  {[
                    "Drop a brochure to pre-fill a listing in ~8 seconds",
                    "Describe a deal in plain English and populate the voucher",
                    "Pull comparable leases and check commission math",
                  ].map((p) => (
                    <div key={p} className="pwh-da-check-item">
                      <span className="pwh-da-check-icon"><Icons.Check size={16} strokeWidth={2.4} /></span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Portal */}
        <section className="pwh-portal-section">
          <div className="pwh-section-inner">
            <div className="lee-eyebrow pwh-eyebrow">Track everything</div>
            <h2 className="pwh-section-heading">The Broker Portal</h2>
            <div className={`pwh-portal-grid${isAdmin ? " pwh-portal-grid--two" : ""}`}>
              <Link href="/portal/submissions" className="pwh-portal-card">
                <div className="pwh-portal-card-header">
                  <div className="pwh-portal-card-icon pwh-portal-card-icon--ink">
                    <Icons.List size={19} />
                  </div>
                  <div className="pwh-portal-card-title">My submissions</div>
                </div>
                <div className="pwh-portal-card-desc">
                  See the status and queue position of every voucher, listing and sign order you've sent to the office — with email updates as they move.
                </div>
              </Link>
              {isAdmin && (
                <Link href="/portal/admin" className="pwh-portal-card">
                  <div className="pwh-portal-card-header">
                    <div className="pwh-portal-card-icon pwh-portal-card-icon--red">
                      <Icons.Admin size={19} />
                    </div>
                    <div className="pwh-portal-card-title">Admin queue</div>
                  </div>
                  <div className="pwh-portal-card-desc">
                    Office admins claim and process submissions, push approved vouchers to Dealius, and manage settings, users and the audit log.
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pwh-footer">
          <img src="/lee-newport-beach-white.png" alt="Lee & Associates Newport Beach" className="pwh-footer-logo" />
          <div style={{ flex: 1 }} />
          <span>© 2026 Lee &amp; Associates Newport Beach, Inc. · Internal broker tools</span>
        </footer>
      </div>
    </div>
  );
}
