import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { Card } from "../design/index.jsx";

const NEEDS_ACTION_STATUSES = new Set(["pending", "in_review"]);

type FormCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const PRIMARY_FORMS: FormCard[] = [
  {
    title: "Listing entry",
    description: "Property and pricing basics in the portal, then notifications and submit in the workspace.",
    href: "/portal/forms/listing",
    badge: "Portal pilot",
  },
  {
    title: "Sign request",
    description: "Property details in the portal, then sign types and placement in the workspace.",
    href: "/portal/forms/sign",
    badge: "Portal pilot",
  },
  {
    title: "Commission voucher",
    description: "Deal basics in the portal, then commission splits and submit in the workspace.",
    href: "/portal/forms/voucher",
    badge: "Portal pilot",
  },
];

const MORE_FORMS: FormCard[] = [
  {
    title: "Comp input",
    description: "Add lease or sale comps to the office dataset.",
    href: "/tool?tab=comp",
  },
  {
    title: "Comp reports",
    description: "Run saved comp report templates.",
    href: "/tool?tab=comp-reports",
  },
  {
    title: "My drafts",
    description: "Resume work you saved in the broker tool.",
    href: "/tool?tab=drafts",
    badge: "Tool",
  },
];

function FormActionCard({ card, accent }: { card: FormCard; accent: string }) {
  return (
    <a
      href={card.href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid var(--ink-200)",
        background: "var(--ink-0)",
        textDecoration: "none",
        color: "inherit",
        boxShadow: "var(--shadow-sm)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${accent}55`;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--ink-200)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-900)" }}>{card.title}</span>
        {card.badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--ink-100)",
              color: "var(--ink-600)",
            }}
          >
            {card.badge}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-600)", lineHeight: 1.45 }}>{card.description}</p>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent, marginTop: 4 }}>
        {card.href.startsWith("/portal/forms/") ? "Start in portal →" : "Open in broker tool →"}
      </span>
    </a>
  );
}

export default function PortalNewSubmission() {
  const { user } = useAuth();
  const branding = usePublicBranding();
  const accent = branding.primary_color || "var(--lee-red, #98002E)";
  const isAdmin = user?.role === "admin";
  const [inProgressCount, setInProgressCount] = useState<number | null>(null);
  const firstName = user?.name?.split(/\s+/)[0];

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

  return (
    <AdminPortalShell
      section="new-submission"
      eyebrow={isAdmin ? "Admin Portal" : "Broker Portal"}
      title={isAdmin ? "New submission" : firstName ? `Welcome, ${firstName}` : "Broker home"}
      description={
        isAdmin
          ? "Open a broker-tool workflow on behalf of testing, or send brokers here to start requests."
          : "Start a voucher, listing, or sign request in the broker tool. After you submit, track status under Submissions."
      }
      actions={
        <LinkButton href="/portal/submissions" variant={isAdmin ? "secondary" : "primary"}>
          {isAdmin ? "Submission queue" : "My submissions"}
        </LinkButton>
      }
    >
      {!isAdmin && (
        <div className="admin-portal-card">
          <Card padding="lg">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-900)" }}>In progress</div>
                <div style={{ fontSize: 13, color: "var(--ink-600)", marginTop: 4, lineHeight: 1.5 }}>
                  {inProgressCount === null
                    ? "Loading active submissions…"
                    : inProgressCount === 0
                      ? "Nothing pending or in progress — start a request below when you are ready."
                      : `${inProgressCount} submission${inProgressCount === 1 ? "" : "s"} still pending or in progress.`}
                </div>
              </div>
              {inProgressCount !== null && inProgressCount > 0 && (
                <Link
                  href="/portal/submissions"
                  style={{ fontSize: 13, fontWeight: 700, color: accent, textDecoration: "none" }}
                >
                  View in progress →
                </Link>
              )}
            </div>
          </Card>
        </div>
      )}
      <div className="admin-portal-card">
        <Card padding="lg">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${accent}33`,
              background: `${accent}08`,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>Quick convert</div>
              <div style={{ fontSize: 13, color: "var(--ink-600)", marginTop: 4, lineHeight: 1.45 }}>
                Lease → voucher, exclusive → sign or listing entry, Word → PDF, or LANB letterhead — upload once and go.
              </div>
            </div>
            <Link
              href="/portal/convert"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: accent,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Open quick convert →
            </Link>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 16, lineHeight: 1.5 }}>
            Forms still live in the broker tool workspace while we migrate them into the portal. Each card opens the
            right tab with your signed-in session.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {PRIMARY_FORMS.map(card => (
              <FormActionCard key={card.href} card={card} accent={accent} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.08em", marginBottom: 10 }}>
            MORE WORKFLOWS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {MORE_FORMS.map(card => (
              <FormActionCard key={card.href} card={card} accent={accent} />
            ))}
          </div>
        </Card>
      </div>
    </AdminPortalShell>
  );
}
