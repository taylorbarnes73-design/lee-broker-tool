import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Megaphone,
  ReceiptText,
  Signpost,
  TableProperties,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { usePublicBranding } from "@/hooks/usePublicBranding";

const NEEDS_ACTION_STATUSES = new Set(["pending", "in_review"]);

const WORKSPACE_TABS = [
  {
    id: "voucher",
    label: "Commission voucher",
    description: "Build, review, download, and send a commission voucher.",
    icon: ReceiptText,
  },
  {
    id: "listing",
    label: "Listing entry",
    description: "Create a listing or submit a listing modification.",
    icon: FileText,
  },
  {
    id: "sign",
    label: "Sign request",
    description: "Request signs, riders, quantities, and placement.",
    icon: Signpost,
  },
  {
    id: "comp",
    label: "Comp input",
    description: "Add lease or sale comps to the office dataset.",
    icon: TableProperties,
  },
  {
    id: "comp-reports",
    label: "Comp reports",
    description: "Search comps and build saved report formats.",
    icon: FileSpreadsheet,
  },
  {
    id: "marketing-request",
    label: "Marketing request",
    description: "Prepare a clear project brief for the marketing team.",
    icon: Megaphone,
  },
  {
    id: "drafts",
    label: "My drafts",
    description: "Resume work saved in this browser.",
    icon: FolderOpen,
  },
] as const;

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["id"];

const GUIDED_STARTS = [
  {
    prompt: "Deal closed?",
    title: "Submit a closed deal",
    description: "Enter commission details and send them to the admin team.",
    href: "/portal/forms/voucher",
    time: "~5 min",
  },
  {
    prompt: "New listing?",
    title: "Add a listing",
    description: "Get a new property into office records.",
    href: "/portal/forms/listing",
    time: "~3 min",
  },
  {
    prompt: "Need a sign?",
    title: "Order a sign",
    description: "Request a Lee & Associates sign installation.",
    href: "/portal/forms/sign",
    time: "~2 min",
  },
  {
    prompt: "Question for admin?",
    title: "Message the admin team",
    description: "Send a request straight to the admin inbox.",
    href: "/portal/admin-request",
    time: "~1 min",
  },
] as const;

function getInitialTab(search: string): WorkspaceTab {
  const requested = new URLSearchParams(search).get("tab");
  return WORKSPACE_TABS.some(tab => tab.id === requested)
    ? (requested as WorkspaceTab)
    : "voucher";
}

export default function PortalWorkspace() {
  const { user } = useAuth();
  const branding = usePublicBranding();
  const accent = branding.primary_color || "var(--lee-red, #98002E)";
  const isAdmin = user?.role === "admin";
  const firstName = user?.name?.split(/\s+/)[0];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialTab = useMemo(() => getInitialTab(window.location.search), []);
  const engineSrc = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.set("embedded", "1");
    return `/workspace-engine?${params.toString()}${initialTab === "listing" ? "" : `#${initialTab}`}`;
  }, [initialTab]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [inProgressCount, setInProgressCount] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    let alive = true;
    const params = new URLSearchParams({ limit: "100", needsAction: "1" });
    fetch(`/api/submissions?${params}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) {
          setInProgressCount(0);
          return;
        }
        const rows = (b?.data ?? []) as { status: string }[];
        setInProgressCount(rows.filter(r => NEEDS_ACTION_STATUSES.has(r.status)).length);
      })
      .catch(() => {
        if (alive) setInProgressCount(null);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  function selectTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const next = `/portal/workspace?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }

    const frameWindow = iframeRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.location.hash = tab === "listing" ? "" : tab;
    }
  }

  return (
    <AdminPortalShell
      section="workspace"
      eyebrow="Broker workspace"
      title={firstName ? `Welcome, ${firstName}` : "Home"}
      description="Choose a tool, follow the guided steps, and send finished work to the office. Admin tools stay behind the Admin button."
      actions={
        <>
          <LinkButton href="/portal/convert" variant="primary">
            Quick Convert
          </LinkButton>
          {!isAdmin && (
            <LinkButton href="/portal/submissions" variant="secondary">
              My submissions
            </LinkButton>
          )}
        </>
      }
    >
      {!isAdmin && (
        <section className="workspace-home-status admin-portal-card" aria-label="Submission status">
          <div className="workspace-home-status-inner">
            <div>
              <div className="workspace-home-status-title">In progress</div>
              <div className="workspace-home-status-copy">
                {inProgressCount === null
                  ? "Loading active submissions…"
                  : inProgressCount === 0
                    ? "Nothing pending or in progress — pick a tool below when you are ready."
                    : `${inProgressCount} submission${inProgressCount === 1 ? "" : "s"} still pending or in progress.`}
              </div>
            </div>
            {inProgressCount !== null && inProgressCount > 0 && (
              <Link href="/portal/submissions" className="workspace-home-status-link">
                View in progress →
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="workspace-home-quickconvert admin-portal-card" aria-label="Quick Convert">
        <div className="workspace-home-quickconvert-inner">
          <div>
            <div className="workspace-home-quickconvert-title">Have the paperwork already? Skip the typing.</div>
            <p>
              Upload a lease, exclusive, or agreement PDF and we&apos;ll read it and prefill the form for you.
              Works for vouchers, listings, and sign requests.
            </p>
          </div>
          <Link href="/portal/convert" className="workspace-home-quickconvert-link">
            Upload a document →
          </Link>
        </div>
      </section>

      <section className="workspace-home-guided admin-portal-card" aria-label="Guided workflows">
        <div className="workspace-home-section-label">Guided starts</div>
        <div className="workspace-home-guided-grid">
          {GUIDED_STARTS.map(card => (
            <a key={card.href} href={card.href} className="workspace-home-guided-card">
              <div className="workspace-home-guided-meta">
                <span className="workspace-home-guided-prompt" style={{ color: accent }}>
                  {card.prompt}
                </span>
                <span className="workspace-home-guided-time">{card.time}</span>
              </div>
              <strong>{card.title}</strong>
              <small>{card.description}</small>
              <span className="workspace-home-guided-cta" style={{ color: accent }}>
                Start →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="workspace-launcher" aria-label="Workspace tools">
        <div className="workspace-home-section-label workspace-home-section-label-inline">Workspace tools</div>
        {WORKSPACE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`workspace-launcher-card ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => selectTab(tab.id)}
              aria-pressed={activeTab === tab.id}
            >
              <span className="workspace-launcher-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.description}</small>
              </span>
            </button>
          );
        })}
      </section>

      <section className="workspace-frame-card">
        <iframe
          ref={iframeRef}
          className="workspace-frame"
          title="Broker workflow workspace"
          src={engineSrc}
          onLoad={() => {
            const frameWindow = iframeRef.current?.contentWindow;
            if (frameWindow) frameWindow.location.hash = activeTab === "listing" ? "" : activeTab;
          }}
        />
      </section>
    </AdminPortalShell>
  );
}
