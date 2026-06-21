import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { Button, Card, Field, Input, Select, Icons } from "@/design/index.jsx";

/**
 * Native React Comp Reports — the search/browse counterpart to the comp INPUT
 * form. Queries the published comp dataset via `compData.search` / `compData.latest`
 * (legacy iframe tab-comp-reports). Lease/sale toggle, free-text + faceted
 * filters, paginated results, and an expandable detail drawer built from the
 * server's pre-formatted `reportCard.fields`. See docs/FRAMEWORK_MIGRATION.md.
 */

const PAGE_SIZE = 20;
const MARKETS = ["Orange County", "Los Angeles", "Inland Empire", "Riverside", "San Bernardino", "San Diego"] as const;
const PROPERTY_TYPES = ["Industrial", "Office", "Retail", "Land", "Flex", "R&D/Flex"] as const;

// Display column order per comp type (keys into reportCard.fields).
const TABLE_COLUMNS: Record<"lease" | "sale", Array<{ key: string; label: string; num?: boolean }>> = {
  lease: [
    { key: "Space Leased", label: "SF Leased", num: true },
    { key: "Rent/SqFt", label: "Rent / SF", num: true },
    { key: "Trans. Date", label: "Trans. Date" },
    { key: "Prop. Type", label: "Prop. Type" },
    { key: "Lessee", label: "Lessee" },
  ],
  sale: [
    { key: "Bldg. SqFt", label: "Bldg. SF", num: true },
    { key: "Sale Price", label: "Sale Price", num: true },
    { key: "Sale $/SF", label: "$ / SF", num: true },
    { key: "Trans. Date", label: "Trans. Date" },
    { key: "Buyer", label: "Buyer" },
  ],
};

// Field display order in the expanded detail drawer.
const DRAWER_FIELDS: Record<"lease" | "sale", string[]> = {
  lease: ["Space Leased", "Rent/SqFt", "Eff. Rent", "Bldg SqFt", "Office", "TI Allow", "Free Rent", "NNN Chgs", "Trans. Date", "Expir. Date", "Term", "Occ Date", "Prop. Type", "Subtype", "Bldg. Class", "Parking", "On Mrkt", "Amps", "Mul-Ten", "Yr Built", "DH", "GL", "POL", "HT", "Sprk", "Rail", "Yrd", "Land", "Lessee", "Lessor", "Space Type", "Options/Rent Adj"],
  sale: ["Bldg. SqFt", "Sale Price", "Sale $/SF", "Trans. Type", "Office SqFt", "Land Size", "Cap Rate", "Trans. Date", "Prop. Type", "Subtype", "Bldg. Class", "Yr Built", "On Market", "Mul-Tnt", "Amps", "Clr", "DH", "GL", "Sprk", "RR", "Yard", "Buyer", "Seller", "Buyer Previous Location"],
};

type CompResult = {
  id: number;
  compType: "lease" | "sale";
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  source: string;
  reportCard: {
    heading: string;
    addressLine: string;
    cityLine: string;
    submarketLine: string;
    listingBrokerLine: string;
    procuringBrokerLine: string;
    updatedLine: string;
    comments: string;
    photo: string;
    fields: Record<string, string>;
  };
};

function splitCsv(raw: string): string[] | undefined {
  const arr = raw.split(",").map(s => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

function parseSf(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function PortalCompReports() {
  const [compType, setCompType] = useState<"lease" | "sale">("lease");
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState("");
  const [subMarkets, setSubMarkets] = useState("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [sfMin, setSfMin] = useState("");
  const [sfMax, setSfMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  // The submitted filter set drives the actual query (so typing doesn't auto-search).
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);

  const latestQuery = trpc.compData.latest.useQuery(undefined, { staleTime: 60_000 });

  const searchQuery = trpc.compData.search.useQuery(
    {
      compType,
      query: query.trim() || undefined,
      cities: splitCsv(cities),
      markets: markets.length ? markets : undefined,
      subMarkets: splitCsv(subMarkets),
      propertyTypes: propertyTypes.length ? propertyTypes : undefined,
      sfMin: parseSf(sfMin),
      sfMax: parseSf(sfMax),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: submitted !== null, staleTime: 15_000 }
  );

  const results = (searchQuery.data?.results ?? []) as CompResult[];
  const pageInfo = searchQuery.data?.pageInfo;
  const latestImport = searchQuery.data?.latestImport ?? latestQuery.data;
  const hasDataset = Boolean(latestImport);

  function runSearch() {
    setOffset(0);
    setExpanded(null);
    setSubmitted({ at: Date.now() });
  }

  function toggleChip(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  }

  const columns = TABLE_COLUMNS[compType];
  const totalPages = pageInfo ? Math.max(1, Math.ceil(pageInfo.total / PAGE_SIZE)) : 1;
  const currentPage = pageInfo ? Math.floor(pageInfo.offset / PAGE_SIZE) + 1 : 1;

  const datasetLabel = useMemo(() => {
    if (!latestImport) return null;
    const count = compType === "lease" ? latestImport.leaseCount : latestImport.saleCount;
    return `${latestImport.workbookName ?? latestImport.sourceFilename ?? "Comp dataset"} · ${count?.toLocaleString() ?? 0} ${compType} comps`;
  }, [latestImport, compType]);

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Research"
      title="Comp Reports"
      description="Search the published comp dataset — lease and sale comparables with full property, terms, and broker detail."
      actions={<LinkButton href="/portal/workspace" variant="secondary">Back to workspace</LinkButton>}
    >
      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 1040 }}>
        {datasetLabel && (
          <div style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
            Active dataset: <strong style={{ color: "var(--ink-700)" }}>{datasetLabel}</strong>
          </div>
        )}

        {/* Filters */}
        <Card padding="lg">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
              <Field label="Comp type">
                <Select value={compType} onChange={e => setCompType(e.target.value as "lease" | "sale")} options={[{ value: "lease", label: "Lease" }, { value: "sale", label: "Sale" }]} />
              </Field>
              <Field label="Search">
                <Input value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="Address, project, tenant…" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") runSearch(); }} prefix={<Icons.Search size={15} />} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Field label="Cities (comma-separated)"><Input value={cities} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCities(e.target.value)} placeholder="Irvine, Tustin" /></Field>
              <Field label="Submarkets (comma-separated)"><Input value={subMarkets} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubMarkets(e.target.value)} placeholder="IBC, Airport Area" /></Field>
              <Field label="SF min"><Input value={sfMin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSfMin(e.target.value)} placeholder="5,000" inputMode="numeric" /></Field>
              <Field label="SF max"><Input value={sfMax} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSfMax(e.target.value)} placeholder="50,000" inputMode="numeric" /></Field>
              <Field label="Date from"><Input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} /></Field>
              <Field label="Date to"><Input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} /></Field>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <ChipRow label="Markets" options={[...MARKETS]} selected={markets} onToggle={v => toggleChip(markets, setMarkets, v)} />
              <ChipRow label="Property types" options={[...PROPERTY_TYPES]} selected={propertyTypes} onToggle={v => toggleChip(propertyTypes, setPropertyTypes, v)} />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button onClick={runSearch} disabled={searchQuery.isFetching}>
                {searchQuery.isFetching ? "Searching…" : "Search"}
              </Button>
              {pageInfo && <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>{pageInfo.total.toLocaleString()} result{pageInfo.total === 1 ? "" : "s"}</span>}
            </div>
          </div>
        </Card>

        {/* Results */}
        {submitted === null ? (
          <EmptyState
            icon={<Icons.Search size={28} />}
            title={hasDataset ? "Search the comp dataset" : "Awaiting dataset"}
            body={hasDataset ? "Set your filters and run a search to preview report-ready comps." : "Once the office publishes the current comps, this page becomes the full search workspace."}
          />
        ) : searchQuery.isError ? (
          <EmptyState icon={<Icons.Help size={28} />} title="Search failed" body={searchQuery.error?.message ?? "Please try again."} />
        ) : results.length === 0 && !searchQuery.isFetching ? (
          <EmptyState
            icon={<Icons.Search size={28} />}
            title="No comps match"
            body={hasDataset ? "Try widening the city, market, or date range." : "Run a search after the active comp dataset is published."}
          />
        ) : (
          <Card padding="none">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ink-200)" }}>
                    <th style={thStyle("left")}>#</th>
                    <th style={thStyle("left")}>Property</th>
                    {columns.map(c => <th key={c.key} style={thStyle(c.num ? "right" : "left")}>{c.label}</th>)}
                    <th style={thStyle("left")}>Source</th>
                    <th style={thStyle("right")} aria-label="Expand" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const open = expanded === r.id;
                    return (
                      <>
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--ink-100)", cursor: "pointer" }} onClick={() => setExpanded(open ? null : r.id)}>
                          <td style={tdStyle()}>{(pageInfo?.offset ?? 0) + i + 1}</td>
                          <td style={tdStyle()}>
                            <div style={{ fontWeight: 600, color: "var(--ink-900)" }}>{r.reportCard.heading || r.address}</div>
                            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{r.reportCard.cityLine}</div>
                            {r.reportCard.submarketLine && <div style={{ fontSize: 11.5, color: "var(--ink-400)" }}>{r.reportCard.submarketLine}</div>}
                          </td>
                          {columns.map(c => <td key={c.key} style={tdStyle(c.num ? "right" : "left")}>{r.reportCard.fields[c.key] || "—"}</td>)}
                          <td style={tdStyle()}>{r.source || "—"}</td>
                          <td style={tdStyle("right")}>
                            <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .12s", color: "var(--ink-400)" }}>
                              <Icons.Chevron size={15} />
                            </span>
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${r.id}-detail`}>
                            <td colSpan={columns.length + 4} style={{ padding: 0, background: "var(--ink-50)" }}>
                              <CompDetail result={r} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pageInfo && pageInfo.total > PAGE_SIZE && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--ink-200)" }}>
                <Button variant="secondary" disabled={!pageInfo.hasPrevious || searchQuery.isFetching} onClick={() => { setOffset(pageInfo.previousOffset ?? Math.max(0, offset - PAGE_SIZE)); setExpanded(null); }}>← Previous</Button>
                <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>Page {currentPage} of {totalPages} · {PAGE_SIZE} per page</span>
                <Button variant="secondary" disabled={!pageInfo.hasNext || searchQuery.isFetching} onClick={() => { setOffset(pageInfo.nextOffset ?? offset + PAGE_SIZE); setExpanded(null); }}>Next →</Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminPortalShell>
  );
}

function ChipRow({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-500)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map(opt => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              style={{
                fontSize: 12.5,
                padding: "4px 11px",
                borderRadius: 999,
                border: on ? "1px solid var(--lee-red)" : "1px solid var(--ink-300)",
                background: on ? "var(--lee-red-wash, rgba(152,0,46,.06))" : "var(--ink-0)",
                color: on ? "var(--lee-red)" : "var(--ink-700)",
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompDetail({ result }: { result: CompResult }) {
  const fields = DRAWER_FIELDS[result.compType].filter(k => (result.reportCard.fields[k] ?? "").trim());
  return (
    <div style={{ padding: "16px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px 20px" }}>
        {fields.map(k => (
          <div key={k} style={{ fontSize: 12.5 }}>
            <span style={{ color: "var(--ink-500)" }}>{k}: </span>
            <span style={{ color: "var(--ink-900)", fontWeight: 500 }}>{result.reportCard.fields[k]}</span>
          </div>
        ))}
      </div>
      {(result.reportCard.listingBrokerLine || result.reportCard.procuringBrokerLine) && (
        <div style={{ fontSize: 12.5, color: "var(--ink-700)" }}>
          {[result.reportCard.procuringBrokerLine, result.reportCard.listingBrokerLine].filter(Boolean).join(" · ")}
        </div>
      )}
      {result.reportCard.comments && (
        <div style={{ fontSize: 12.5, color: "var(--ink-600)", fontStyle: "italic" }}>{result.reportCard.comments}</div>
      )}
      {result.reportCard.updatedLine && (
        <div style={{ fontSize: 11.5, color: "var(--ink-400)" }}>{result.reportCard.updatedLine}</div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card padding="lg">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "32px 20px", gap: 8 }}>
        <span style={{ color: "var(--ink-300)" }}>{icon}</span>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-800)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--ink-500)", maxWidth: 420, lineHeight: 1.5 }}>{body}</div>
      </div>
    </Card>
  );
}

function thStyle(align: "left" | "right"): React.CSSProperties {
  return { textAlign: align, padding: "10px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" };
}

function tdStyle(align: "left" | "right" = "left"): React.CSSProperties {
  return { textAlign: align, padding: "10px 12px", color: "var(--ink-700)", verticalAlign: "top" };
}
