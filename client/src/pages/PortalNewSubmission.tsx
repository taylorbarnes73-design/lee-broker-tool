import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { Card } from "../design/index.jsx";

const NEEDS_ACTION_STATUSES = new Set(["pending", "in_review"]);

type OutcomeCard = {
  prompt: string;
  title: string;
  description: string;
  href: string;
  time: string;
  youGet: string;
};

const OUTCOME_CARDS: OutcomeCard[] = [
  {
    prompt: "Deal closed?",
    title: "Submit a closed deal",
    description: "Enter your commission details and send them to the admin team for processing.",
    href: "/portal/forms/voucher",
    time: "~5 min",
    youGet: "Commission voucher filed + admin notified",
  },
  {
    prompt: "New listing?",
    title: "Add a listing",
    description: "Get a new property into the office records and notify the admin team.",
    href: "/portal/forms/listing",
    time: "~3 min",
    youGet: "Listing filed + admin notified",
  },
  {
    prompt: "Need a sign?",
    title: "Order a sign",
    description: "Request a Lee & Associates sign installation at a property.",
    href: "/portal/forms/sign",
    time: "~2 min",
    youGet: "Order queued — typically installed in 2–3 business days",
  },
  {
    prompt: "Question for admin?",
    title: "Message the admin team",
    description: "Send a request or question straight to the admin inbox — no email app needed.",
    href: "/portal/admin-request",
    time: "~1 min",
    youGet: "Response by email within 1–2 business days",
  },
];

type FormCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

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
    description: "Resume work you saved in the broker workspace.",
    href: "/tool?tab=drafts",
    badge: "Workspace",
  },
];

function OutcomeActionCard({ card, accent }: { card: OutcomeCard; accent: string }) {
  return (
    <a
      href={card.href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "18px 20px",
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {card.prompt}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--ink-100)",
            color: "var(--ink-600)",
            whiteSpace: "nowrap",
          }}
        >
          {card.time}
        </span>
      </div>
      <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink-900)" }}>{card.title}</span>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-600)", lineHeight: 1.45 }}>{card.description}</p>
      <div style={{ fontSize: 12, color: "var(--ink-500)", lineHeight: 1.4 }}>
        <span style={{ fontWeight: 700, color: "var(--ink-600)" }}>You get:</span> {card.youGet}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent, marginTop: 2 }}>Start →</span>
    </a>
  );
}

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
        Open in workspace →
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
          : "What do you need to do today? Pick a task below — each one tells you what it takes and what you get back."
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
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {OUTCOME_CARDS.map(card => (
              <OutcomeActionCard key={card.href} card={card} accent={accent} />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${accent}33`,
              background: `${accent}08`,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>
                Have the paperwork already? Skip the typing.
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-600)", marginTop: 4, lineHeight: 1.45 }}>
                Upload a lease, exclusive, or agreement PDF and we'll read it and prefill the form for you.
                Works for vouchers, listings, and sign requests.
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
              Upload a document →
            </Link>
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
