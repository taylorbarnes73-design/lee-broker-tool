import { useMemo, useEffect, useRef, type CSSProperties } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Inbox,
  LogOut,
  Megaphone,
  ReceiptText,
  Shield,
  Signpost,
  TableProperties,
  User,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicBranding } from "@/hooks/usePublicBranding";

/**
 * Portal workspace: clean launchpad at /portal/workspace (no ?tab),
 * focused tool view at /portal/workspace?tab=X (full-screen iframe).
 *
 * The iframe loads broker_tool.html at /workspace-engine?embedded=1 so the
 * workspace's own duplicate header/sidebar/tab-bar are hidden by broker_ux.css
 * and this shell owns navigation and the admin entry point.
 */

const TOOLS = [
  { id: "voucher",           label: "Commission voucher",  description: "Calculate and submit a closed deal",     Icon: ReceiptText     },
  { id: "listing",           label: "Listing entry",       description: "Add a property to office records",       Icon: FileText        },
  { id: "sign",              label: "Sign request",        description: "Order a Lee & Associates sign",          Icon: Signpost        },
  { id: "comp",              label: "Comp input",          description: "Record a comparable transaction",        Icon: TableProperties },
  { id: "comp-reports",      label: "Comp reports",        description: "Search and export comp data",            Icon: FileSpreadsheet },
  { id: "marketing-request", label: "Marketing request",   description: "Request a flyer, brochure, or campaign", Icon: Megaphone       },
  { id: "drafts",            label: "My drafts",           description: "Resume work saved in this browser",      Icon: FolderOpen      },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function isValidTab(t: string | null): t is ToolId {
  return TOOLS.some(tool => tool.id === t);
}

export default function PortalWorkspace() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const branding = usePublicBranding();
  const isAdmin = user?.role === "admin";
  const logoSrc = branding.logo_url?.trim() || "/lee-newport-beach-fullcolor.png";
  const accent = branding.primary_color || "#98002E";

  const tab = useMemo<ToolId | null>(() => {
    const t = new URLSearchParams(search).get("tab");
    return isValidTab(t) ? t : null;
  }, [search]);

  // Build the iframe src once on mount from the initial URL; tab switches
  // update the hash in-place so the workspace doesn't reload.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrc = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.set("embedded", "1");
    const hash = tab && tab !== "listing" ? `#${tab}` : "";
    return `/workspace-engine?${params}${hash}`;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally built once

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.location.hash = tab && tab !== "listing" ? tab : "";
  }, [tab]);

  const pageStyle = { ["--admin-accent" as string]: accent } as CSSProperties;

  return (
    <div className="portal-workspace-page" style={pageStyle}>
      <header className="portal-workspace-header">
        {tab ? (
          <Link href="/portal/workspace" className="portal-workspace-back" aria-label="Back to workspace">
            ← Workspace
          </Link>
        ) : (
          <Link href="/portal/workspace" className="portal-workspace-brand" aria-label="Portal home">
            <img src={logoSrc} alt="Lee & Associates Newport Beach" />
            <span className="portal-workspace-brand-label">Broker Workspace</span>
          </Link>
        )}
        <div className="portal-workspace-header-spacer" />
        {!tab && (
          <Link href="/portal/submissions" className="portal-workspace-header-link">
            <Inbox size={15} aria-hidden />
            <span>My submissions</span>
          </Link>
        )}
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

      {tab ? (
        <iframe
          ref={iframeRef}
          title="Broker workflow workspace"
          src={initialSrc}
          className="portal-workspace-frame"
          data-testid="workspace-frame"
        />
      ) : (
        <main className="portal-workspace-launchpad">
          <div className="portal-workspace-grid">
            {TOOLS.map(({ id, label, description, Icon }) => (
              <Link
                key={id}
                href={`/portal/workspace?tab=${id}`}
                className="portal-workspace-tool-card"
              >
                <span className="portal-workspace-tool-icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="portal-workspace-tool-body">
                  <span className="portal-workspace-tool-label">{label}</span>
                  <span className="portal-workspace-tool-desc">{description}</span>
                </span>
              </Link>
            ))}
          </div>
          <nav className="portal-workspace-utilities" aria-label="Utilities">
            <Link href="/portal/convert" className="portal-workspace-util-link">Quick Convert</Link>
          </nav>
        </main>
      )}
    </div>
  );
}
