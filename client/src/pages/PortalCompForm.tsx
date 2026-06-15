import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { trpc } from "@/lib/trpc";
import { buildSectionedPdf, type PdfSection } from "@/lib/formPdf";
import { Button, Card, Field, Input, Select, Icons } from "../design/index.jsx";

/**
 * Native React Comp Input form — third tool migrated off the legacy iframe
 * (broker_tool.html `tab-comp`). Records a lease or sale comparable straight
 * into the office comp set via `compData.submitComp` ({ compType, record }).
 *
 * Fixes the legacy AI field-map (it pointed at 8 element ids that don't exist,
 * so AI prefill silently dropped SF/rate/parties/price). See
 * docs/FRAMEWORK_MIGRATION.md.
 */

type Vals = Record<string, string>;
type Opt = { value: string; label: string };

const opt = (...v: string[]): Opt[] => [{ value: "", label: "—" }, ...v.map(x => ({ value: x, label: x }))];

const COMP_TYPES: Opt[] = [
  { value: "lease", label: "Lease comp" },
  { value: "sale", label: "Sale comp" },
];
const PROP_TYPES = opt("Industrial", "Office", "Retail", "Multi-Family", "Land");
const SUBTYPES = opt(
  "Manufacturing", "Warehouse/Distribution", "Ware/Dist (Inst.)", "Ware/Dist (Non-Inst.)",
  "Light Industrial", "R&D", "R&D/Flex", "R&D/Corp HQ", "Truck Term", "Mid Bay", "Other"
);
const BLDG_CLASS = opt("A", "B", "C");
const RENT_TYPES = opt("G", "IG", "MG", "NNN", "FS", "FSG", "Modified Gross", "Industrial Gross", "Full Service Gross");
const MARKETS = opt("Los Angeles", "Orange", "Riverside", "San Bernardino");
const SUBMARKETS = opt("SCM", "IBC", "SAE", "WC", "NM", "SOC", "NOC", "Mid Cities");
const SPACE_TYPES = opt("Direct Lease", "Sublease", "Renewal", "Expansion", "New Lease", "Extension", "Blend and Extend", "Owner/User");
const CONST_TYPES = opt("CTU", "Block", "Metal", "Concrete", "Steel");
const YESNO = opt("Yes", "No");

const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 72,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--ink-200)",
  fontSize: 14,
  fontFamily: "inherit",
  resize: "vertical",
  boxSizing: "border-box",
  color: "var(--ink-900)",
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function humanError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
function isAuthError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  const code = (e as { data?: { code?: string } })?.data?.code;
  return code === "UNAUTHORIZED" || msg.includes("10001") || msg.includes("please login") || msg.includes("unauthorized");
}
function extractMime(file: File): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  if (t === "image/webp") return "image/webp";
  if (t === "application/pdf") return "application/pdf";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initialVals(): Vals {
  return { "c-comp-type": "lease", "c-state": "CA", "c-date": todayISO() };
}

export default function PortalCompForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [vals, setVals] = useState<Vals>(initialVals);
  const [photo, setPhoto] = useState<{ filename: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brochureRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const submitMut = trpc.compData.submitComp.useMutation();
  const uploadMut = trpc.files.upload.useMutation();
  const extractMut = trpc.aiAssist.extractDocument.useMutation();
  const rosterQ = trpc.brokers.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const analyzing = uploadMut.isPending || extractMut.isPending;
  const submitting = submitMut.isPending;

  const isSale = vals["c-comp-type"] === "sale";

  const rosterNames = useMemo(() => {
    const list = Array.isArray(rosterQ.data) ? rosterQ.data : [];
    const brokers = list.filter((b: { role?: string }) => /broker/i.test(b.role || ""));
    return (brokers.length ? brokers : list).map((b: { name?: string }) => b.name || "").filter(Boolean);
  }, [rosterQ.data]);

  function setVal(id: string, value: string) {
    setVals(prev => ({ ...prev, [id]: value }));
  }

  // Default the comp source to the signed-in broker.
  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setVals(prev => (prev["c-source"] ? prev : { ...prev, "c-source": name }));
  }, [user?.name]);

  /** Apply AI-extracted fields to the REAL comp ids (fixes the legacy map). */
  function applyExtracted(raw: Record<string, unknown>) {
    const f = raw || {};
    setVals(prev => {
      const next = { ...prev };
      const set = (id: string, v: unknown) => {
        if (v != null && String(v).trim() && !next[id]) next[id] = String(v);
      };
      if (f.compType) next["c-comp-type"] = /sale/i.test(String(f.compType)) ? "sale" : "lease";
      const sale = next["c-comp-type"] === "sale";
      set("c-address", f.address);
      set("c-city", f.city);
      set("c-state", f.state);
      set("c-zip", f.zip);
      set("c-prop-type", f.propertyType);
      set("c-comments", f.comments);
      set("c-term", f.term);
      set("c-source", f.brokerName);
      if (sale) {
        set("cs-bldg-sf", f.buildingSf ?? f.dealSf);
        set("cs-sell-price", f.salePrice);
        set("cs-txn-date", f.commencementDate);
        set("cs-buyer", f.tenantName);
        set("cs-seller", f.landlordName);
      } else {
        set("c-bldg-sf", f.buildingSf);
        set("c-leased-sf", f.dealSf);
        set("c-rent-sf", f.leaseRate);
        set("c-exec-date", f.commencementDate);
        set("c-lessee", f.tenantName);
        set("c-lessor", f.landlordName);
      }
      return next;
    });
  }

  async function onBrochure(file: File | null) {
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const up = await uploadMut.mutateAsync({
        filename: file.name,
        mimeType: extractMime(file),
        base64Data: base64,
        category: "brochure",
        reference: "comp",
      });
      const res = await extractMut.mutateAsync({ fileUrl: up.url, mimeType: extractMime(file), tab: "comp" });
      if (res?.success && res.fields && Object.keys(res.fields).length) {
        applyExtracted(res.fields as Record<string, unknown>);
        toast.success("Document analyzed — we filled in what we could find.");
      } else {
        toast.message("We couldn't read details from that document. Fill the form in manually.");
      }
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const up = await uploadMut.mutateAsync({
        filename: file.name,
        mimeType: extractMime(file),
        base64Data: base64,
        category: "comp_photo",
        reference: vals["c-address"] || "comp",
      });
      setPhoto({ filename: file.name, url: up.url });
      toast.success("Photo attached.");
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  function brokerLine(prefix: string): string {
    return [vals[`${prefix}-brokerage`], vals[`${prefix}-agent1`], vals[`${prefix}-agent2`]]
      .map(v => (v || "").trim())
      .filter(Boolean)
      .join(" - ");
  }

  /** Mirror of the legacy collectCompReportPayload — keys the server normalizes. */
  function buildRecord(): Record<string, unknown> {
    const v = (id: string) => (vals[id] || "").trim();
    const common: Record<string, unknown> = {
      office: "Lee & Associates Newport Beach",
      address: v("c-address"),
      city: v("c-city"),
      state: "CA",
      market: v("c-market"),
      subMarket: v("c-submarket"),
      projectName: v("c-project"),
      propertyType: v("c-prop-type") || "Industrial",
      propertySubType: v("c-subtype"),
      buildingClass: v("c-bldg-class"),
      constructionType: v("c-const-type"),
      dhDoors: v("c-dh"),
      glDoors: v("c-gl"),
      clearHeight: v("c-clearance"),
      amperage: v("c-amps"),
      sprinklers: v("c-sprinklers"),
      rail: v("c-rail"),
      yard: v("c-yard"),
      source: v("c-source") || user?.name || "Broker Submission",
      verifiedBy: v("c-source") || user?.name || "Broker Submission",
      lastUpdated: v("c-date") || todayISO(),
      comments: v("c-comments"),
      ...(photo?.url ? { photo: photo.url } : {}),
    };
    if (isSale) {
      return {
        ...common,
        sourceSheet: "Broker-Comp-Input-Sale",
        yearBuilt: v("cs-year-built"),
        parkingRatio: v("cs-parking"),
        multiTenant: v("cs-multi-ten"),
        listBroker: brokerLine("cs-list"),
        procBroker: brokerLine("cs-proc"),
        monthsOnMarket: v("cs-mkt-months"),
        transactionDate: v("cs-txn-date") || v("c-date"),
        buildingSqFt: v("cs-bldg-sf"),
        landSqFt: v("cs-land-sf"),
        officeSqFt: v("cs-office-sf"),
        salePrice: v("cs-sell-price"),
        salePricePerSqFt: salePsf(),
        capRate: v("cs-cap-rate"),
        transactionType: v("cs-txn-type"),
        buyer: v("cs-buyer"),
        seller: v("cs-seller"),
        askingPrice: v("cs-sell-price"),
      };
    }
    return {
      ...common,
      sourceSheet: "Broker-Comp-Input-Lease",
      yearBuilt: v("c-year-built"),
      parkingRatio: v("c-parking"),
      spaceType: v("c-space-type"),
      multiTenant: v("c-multi-tenant"),
      pol: v("c-pol"),
      listBroker: brokerLine("c-list"),
      procBroker: brokerLine("c-proc"),
      monthsOnMarket: v("c-mkt-months"),
      transactionDate: v("c-exec-date") || v("c-date"),
      occupancyDate: v("c-occ-date"),
      expirationDate: v("c-expire-date"),
      leasedSqFt: v("c-leased-sf"),
      rentPerSqFt: v("c-rent-sf"),
      rentType: v("c-rent-type"),
      termInMonths: v("c-term"),
      effectiveRent: v("c-eff-rent"),
      freeRentMonths: v("c-free-rent"),
      rentAdjustments: v("c-escalations"),
      options: v("c-options"),
      tia: v("c-ti"),
      lessee: v("c-lessee"),
      lessor: v("c-lessor"),
      buildingSqFt: v("c-bldg-sf"),
      officeSqFt: v("c-office-sf"),
      nnnCharges: v("c-nnn"),
      landSqFt: v("c-land-sf"),
    };
  }

  function salePsf(): string {
    const price = parseFloat((vals["cs-sell-price"] || "").replace(/[^0-9.]/g, ""));
    const sf = parseFloat((vals["cs-bldg-sf"] || "").replace(/[^0-9.]/g, ""));
    if (!price || !sf) return "";
    return (price / sf).toFixed(2);
  }

  function buildSections(): PdfSection[] {
    const record = buildRecord();
    const entries = Object.entries(record).filter(([, val]) => String(val ?? "").trim() && val !== "");
    return [
      {
        title: `${isSale ? "Sale" : "Lease"} Comp`,
        fields: entries.map(([k, val]) => ({ label: prettyKey(k), value: String(val) })),
      },
    ];
  }

  async function onDownloadPdf() {
    try {
      const pdf = await buildSectionedPdf({
        title: `${isSale ? "SALE" : "LEASE"} COMP`,
        sections: buildSections(),
        propertyAddress: vals["c-address"] || "",
        filenamePrefix: isSale ? "Sale_Comp" : "Lease_Comp",
      });
      downloadBlob(pdf.blob, pdf.filename);
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  async function onSubmit() {
    setError(null);
    if (!vals["c-address"]?.trim()) {
      setError("Property address is required to save the comp.");
      return;
    }
    try {
      const result = await submitMut.mutateAsync({
        compType: isSale ? "sale" : "lease",
        record: buildRecord(),
      });
      if (result && (result as { success?: boolean }).success === false) {
        throw new Error("The comp could not be saved.");
      }
      toast.success(`${isSale ? "Sale" : "Lease"} comp saved to the office comp set.`);
      // Reset for the next entry, keeping branch + source for fast repeated entry.
      setVals({ ...initialVals(), "c-comp-type": vals["c-comp-type"], "c-source": vals["c-source"] || "" });
      setPhoto(null);
    } catch (e) {
      setError(isAuthError(e) ? "You're signed out — sign in again to save this comp." : humanError(e));
    }
  }

  function onClear() {
    if (!window.confirm("Clear the comp form?")) return;
    setVals({ ...initialVals(), "c-comp-type": vals["c-comp-type"], "c-source": user?.name?.trim() || "" });
    setPhoto(null);
    setError(null);
  }

  // Field render helpers (kept local so they close over vals/setVal).
  const T = (id: string, label: string, extra: { req?: boolean; ph?: string; mode?: "numeric" | "decimal"; list?: boolean } = {}) => (
    <Field label={label} required={extra.req}>
      <Input
        value={vals[id] || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(id, e.target.value)}
        placeholder={extra.ph}
        inputMode={extra.mode}
        {...(extra.list ? { list: "comp-roster" } : {})}
      />
    </Field>
  );
  const D = (id: string, label: string, req?: boolean) => (
    <Field label={label} required={req}>
      <Input type="date" value={vals[id] || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(id, e.target.value)} />
    </Field>
  );
  const S = (id: string, label: string, options: Opt[], req?: boolean) => (
    <Field label={label} required={req}>
      <Select value={vals[id] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal(id, e.target.value)} options={options} />
    </Field>
  );
  const grid = (children: ReactNode) => (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>{children}</div>
  );

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="New comparable?"
      title="Comp input"
      description="Record a closed lease or sale comparable into the office comp set. Upload a brochure and Deal Assist will prefill what it can."
      actions={
        <LinkButton href="/portal/workspace" variant="secondary">
          Back to workspace
        </LinkButton>
      }
    >
      <datalist id="comp-roster">
        {rosterNames.map((n: string) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 920 }}>
        {/* AI + branch */}
        <Card padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: "1px dashed var(--ink-200)", borderRadius: 10, padding: "14px 16px", background: "var(--ink-50)", marginBottom: 18 }}>
            <span style={{ color: "var(--ai-500)", display: "flex" }}><Icons.Sparkles size={18} /></span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>Have a brochure or flyer?</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)" }}>Upload it and Deal Assist will prefill the comp.</div>
            </div>
            <input ref={brochureRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={e => onBrochure(e.target.files?.[0] ?? null)} />
            <Button variant="ai" loading={analyzing} onClick={() => brochureRef.current?.click()} icon={<Icons.Upload size={15} />}>
              {analyzing ? "Analyzing…" : "Upload & analyze"}
            </Button>
          </div>

          <Field label="Comp type" required>
            <div style={{ display: "flex", gap: 8 }}>
              {COMP_TYPES.map(o => {
                const on = vals["c-comp-type"] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setVal("c-comp-type", o.value)}
                    style={{ padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, border: `1px solid ${on ? "var(--lee-red)" : "var(--ink-200)"}`, background: on ? "var(--lee-red-wash)" : "var(--ink-0)", color: on ? "var(--lee-red)" : "var(--ink-700)" }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ marginTop: 14 }}>
            {grid(
              <>
                {T("c-source", "Broker source", { req: true, ph: "Broker name", list: true })}
                {D("c-date", "Date")}
              </>
            )}
          </div>
        </Card>

        {/* Location */}
        <Card padding="lg">
          <SectionTitle>Location</SectionTitle>
          <Field label="Address" required>
            <AddressAutocompleteInput
              value={vals["c-address"] || ""}
              onChange={v => setVal("c-address", v)}
              onSelect={s => {
                setVal("c-address", s.address);
                if (s.city) setVal("c-city", s.city);
                if (s.state) setVal("c-state", s.state);
                if (s.zip) setVal("c-zip", s.zip);
              }}
              placeholder="1450 Von Karman Ave"
            />
          </Field>
          <div style={{ marginTop: 14 }}>
            {grid(
              <>
                {T("c-city", "City", { req: true, ph: "Irvine" })}
                {T("c-state", "State", { ph: "CA" })}
                {T("c-zip", "Zip", { ph: "92618" })}
                {S("c-market", "Market", MARKETS)}
                {S("c-submarket", "Submarket", SUBMARKETS)}
                {T("c-project", "Project / park", {})}
              </>
            )}
          </div>
        </Card>

        {/* Property */}
        <Card padding="lg">
          <SectionTitle>Property</SectionTitle>
          {grid(
            <>
              {S("c-prop-type", "Property type", PROP_TYPES, true)}
              {S("c-subtype", "Subtype", SUBTYPES)}
              {S("c-bldg-class", "Building class", BLDG_CLASS)}
              {T(isSale ? "cs-year-built" : "c-year-built", "Year built", { mode: "numeric" })}
              {isSale ? S("c-const-type", "Construction type", CONST_TYPES) : null}
            </>
          )}
        </Card>

        {/* Branch terms */}
        {isSale ? (
          <Card padding="lg">
            <SectionTitle>Key sale terms</SectionTitle>
            {grid(
              <>
                {T("cs-bldg-sf", "Building SF", { req: true, mode: "numeric", ph: "52,000" })}
                {T("cs-sell-price", "Selling price", { req: true, mode: "decimal", ph: "8,200,000" })}
                <Field label="Sale $/SF"><Input value={salePsf()} auto readOnly placeholder="—" /></Field>
                {D("cs-txn-date", "Transaction date", true)}
                {T("cs-seller", "Seller", {})}
                {T("cs-buyer", "Buyer", {})}
                {T("cs-land-sf", "Land SF", { mode: "numeric" })}
                {T("cs-office-sf", "Office SF", { mode: "numeric" })}
                {T("cs-txn-type", "Transaction type", { ph: "User / Investment / Developer" })}
                {T("cs-parking", "Parking ratio", {})}
                {T("cs-mkt-months", "Months on market", { mode: "numeric" })}
                {S("cs-multi-ten", "Multi-tenant", YESNO)}
                {T("cs-cap-rate", "CAP rate", { ph: "5.5%" })}
              </>
            )}
          </Card>
        ) : (
          <Card padding="lg">
            <SectionTitle>Key lease terms</SectionTitle>
            {grid(
              <>
                {T("c-leased-sf", "Leased SF", { req: true, mode: "numeric", ph: "12,500" })}
                {T("c-rent-sf", "Start rate $/SF", { req: true, mode: "decimal", ph: "1.15" })}
                {S("c-rent-type", "Rent type", RENT_TYPES)}
                {D("c-exec-date", "Transaction / exec date", true)}
                {D("c-occ-date", "Occupancy date")}
                {D("c-expire-date", "Expiration date")}
                {T("c-term", "Term (months)", { mode: "numeric" })}
                {T("c-lessee", "Lessee / tenant", {})}
                {T("c-lessor", "Lessor / landlord", {})}
                {S("c-space-type", "Space type", SPACE_TYPES)}
                {T("c-eff-rent", "Effective rent $/SF", { mode: "decimal" })}
                {T("c-free-rent", "Free rent (months)", { mode: "numeric" })}
                {T("c-nnn", "NNN charges $/SF", { mode: "decimal" })}
                {T("c-escalations", "Rent escalations", {})}
                {T("c-options", "Options", {})}
                {T("c-ti", "TI allowance", {})}
                {T("c-bldg-sf", "Building SF", { mode: "numeric" })}
                {T("c-office-sf", "Office SF", { mode: "numeric" })}
                {T("c-land-sf", "Land SF", { mode: "numeric" })}
                {T("c-parking", "Parking ratio", {})}
                {S("c-multi-tenant", "Multi-tenant", YESNO)}
                {S("c-pol", "POL", YESNO)}
              </>
            )}
          </Card>
        )}

        {/* Features */}
        <Card padding="lg">
          <SectionTitle>Property features</SectionTitle>
          {grid(
            <>
              {T("c-dh", "Dock-high doors", { mode: "numeric" })}
              {T("c-gl", "Grade-level doors", { mode: "numeric" })}
              {T("c-clearance", "Clear height", {})}
              {T("c-amps", "Power (amps)", {})}
              {S("c-sprinklers", "Sprinklers", YESNO)}
              {S("c-rail", "Rail", YESNO)}
              {S("c-yard", "Yard", YESNO)}
            </>
          )}
        </Card>

        {/* Brokerage */}
        <Card padding="lg">
          <SectionTitle>Brokerage</SectionTitle>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 8 }}>Listing side</div>
          {grid(
            <>
              {T(isSale ? "cs-list-brokerage" : "c-list-brokerage", "Brokerage", {})}
              {T(isSale ? "cs-list-agent1" : "c-list-agent1", "Agent 1", { list: true })}
              {T(isSale ? "cs-list-agent2" : "c-list-agent2", "Agent 2", { list: true })}
            </>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", margin: "16px 0 8px" }}>Procuring side</div>
          {grid(
            <>
              {T(isSale ? "cs-proc-brokerage" : "c-proc-brokerage", "Brokerage", {})}
              {T(isSale ? "cs-proc-agent1" : "c-proc-agent1", "Agent 1", { list: true })}
              {T(isSale ? "cs-proc-agent2" : "c-proc-agent2", "Agent 2", { list: true })}
            </>
          )}
        </Card>

        {/* Photo + comments */}
        <Card padding="lg">
          <SectionTitle>Photo &amp; comments</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} style={{ display: "none" }} onChange={e => onPhoto(e.target.files?.[0] ?? null)} />
            <Button variant="secondary" size="sm" onClick={() => photoRef.current?.click()} icon={<Icons.Upload size={14} />}>
              {photo ? "Replace photo" : "Add property photo"}
            </Button>
            {photo ? <span style={{ fontSize: 12.5, color: "var(--ink-600)" }}>{photo.filename}</span> : null}
          </div>
          <Field label="Comments">
            <textarea value={vals["c-comments"] || ""} onChange={e => setVal("c-comments", e.target.value)} placeholder="Concessions, deal context, or notes" style={textareaStyle} />
          </Field>
        </Card>

        {error ? (
          <div role="alert" style={{ color: "var(--err-700)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Warn size={14} /> {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={onSubmit} loading={submitting} iconRight={<Icons.Arrow size={16} />}>
            {submitting ? "Saving…" : "Save comp"}
          </Button>
          <Button variant="secondary" onClick={onDownloadPdf} icon={<Icons.Download size={15} />}>
            Download PDF
          </Button>
          <Button variant="ghost" onClick={onClear}>
            Clear form
          </Button>
          <LinkButton href="/portal/comp-reports" variant="ghost">
            Search comp reports
          </LinkButton>
          {user?.name ? <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Signed in as {user.name}</span> : null}
        </div>
      </div>
    </AdminPortalShell>
  );
}

function prettyKey(k: string): string {
  return k
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .replace(/Sq Ft/g, "SF")
    .trim();
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--ink-150)" }}>
      {children}
    </div>
  );
}
