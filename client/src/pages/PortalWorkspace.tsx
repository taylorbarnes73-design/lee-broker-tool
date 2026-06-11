import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, FolderOpen, Megaphone, ReceiptText, Signpost, TableProperties } from "lucide-react";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";

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

function getInitialTab(search: string): WorkspaceTab {
  const requested = new URLSearchParams(search).get("tab");
  return WORKSPACE_TABS.some(tab => tab.id === requested)
    ? (requested as WorkspaceTab)
    : "voucher";
}

export default function PortalWorkspace() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialTab = useMemo(() => getInitialTab(window.location.search), []);
  const engineSrc = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.set("embedded", "1");
    return `/workspace-engine?${params.toString()}${initialTab === "listing" ? "" : `#${initialTab}`}`;
  }, [initialTab]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);

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
      eyebrow="Shared workspace"
      title="Broker workspace"
      description="Choose a tool, follow the guided steps, and send the finished work to the office."
      actions={
        <LinkButton href="/portal/convert" variant="primary">
          Quick Convert
        </LinkButton>
      }
    >
      <section className="workspace-launcher" aria-label="Workspace tools">
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
