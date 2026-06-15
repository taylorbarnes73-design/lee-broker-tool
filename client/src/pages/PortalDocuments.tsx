import { useMemo, useState } from "react";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { BROKER_DOC_CATEGORIES } from "@/lib/brokerDocuments";
import { Card, Input, Icons } from "../design/index.jsx";

/**
 * Native React Documents library — fifth tool migrated off the legacy iframe
 * (broker_tool.html `tab-docs`). A searchable, categorized list of blank
 * forms, agreements, and reference PDFs (static external CDN links, no
 * backend). Data in client/src/lib/brokerDocuments.ts. See
 * docs/FRAMEWORK_MIGRATION.md.
 */

export default function PortalDocuments() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return BROKER_DOC_CATEGORIES;
    return BROKER_DOC_CATEGORIES
      .map(cat => ({
        ...cat,
        items: cat.items.filter(i => (i.title + " " + i.meta).toLowerCase().includes(q)),
      }))
      .filter(cat => cat.items.length > 0);
  }, [q]);

  const total = useMemo(() => filtered.reduce((n, c) => n + c.items.length, 0), [filtered]);

  function isOpen(cat: { name: string; collapsible: boolean }) {
    if (q) return true; // expand everything while searching
    if (!cat.collapsible) return true;
    return Boolean(expanded[cat.name]);
  }

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Reference library"
      title="Documents"
      description="Blank forms, agreements, and reference PDFs. Click any document to open or download it."
      actions={
        <LinkButton href="/portal/workspace" variant="secondary">
          Back to workspace
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 980 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, maxWidth: 460 }}>
            <Input
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search documents…"
              prefix={<Icons.Search size={15} />}
            />
          </div>
          <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
            {q ? `${total} result${total === 1 ? "" : "s"}` : `${total} documents`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <Card padding="lg">
            <div style={{ fontSize: 14, color: "var(--ink-500)", textAlign: "center" }}>
              No documents match “{query}”.
            </div>
          </Card>
        ) : (
          filtered.map(cat => {
            const open = isOpen(cat);
            return (
              <div key={cat.name}>
                <button
                  type="button"
                  onClick={() => !q && cat.collapsible && setExpanded(prev => ({ ...prev, [cat.name]: !prev[cat.name] }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "4px 2px 10px",
                    cursor: cat.collapsible && !q ? "pointer" : "default",
                    color: "var(--ink-900)",
                  }}
                >
                  {cat.collapsible && !q ? (
                    <span style={{ display: "flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .12s", color: "var(--ink-400)" }}>
                      <Icons.Chevron size={15} />
                    </span>
                  ) : null}
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-700)" }}>
                    {cat.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-400)", fontWeight: 600 }}>{cat.items.length}</span>
                </button>

                {open ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                    {cat.items.map(item => (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--ink-200)",
                          background: "var(--ink-0)",
                          textDecoration: "none",
                          transition: "border-color .12s, box-shadow .12s",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "var(--lee-red)";
                          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "var(--ink-200)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <span style={{ display: "flex", color: "var(--lee-red)", flexShrink: 0 }}>
                          <Icons.Docs size={18} />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)", lineHeight: 1.3 }}>
                            {item.title}
                          </span>
                          <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>{item.meta}</span>
                        </span>
                        <span style={{ marginLeft: "auto", color: "var(--ink-300)", display: "flex", flexShrink: 0 }}>
                          <Icons.Download size={15} />
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </AdminPortalShell>
  );
}
