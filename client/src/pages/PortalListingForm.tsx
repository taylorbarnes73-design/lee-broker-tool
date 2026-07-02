import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { trpc } from "@/lib/trpc";
import { buildSectionedPdf, type PdfSection } from "@/lib/formPdf";
import { isListingSupportingFileUrl } from "@/lib/listingSupportingFiles";
import {
  normalizeListingExtractFields,
  normalizeListingPropertyType,
  parseQuickConvertPrefill,
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
} from "@shared/quickConvert";
import { Button, Card, Field, Input, Select, Toggle, Icons } from "../design/index.jsx";

/**
 * Native React Listing Entry form — second tool migrated off the legacy iframe
 * (broker_tool.html `tab-listing`). Submits through `email.sendToAdmin`
 * (formType:"listing") with the deal documents as supportingFiles and a
 * client PDF attachment, matching the legacy contract.
 *
 * Notably FIXES the legacy `collectListingSections` bug (it read field ids that
 * don't exist, so the admin-queue sections arrived nearly blank): here a single
 * field model feeds both the PDF and the sections payload. See
 * docs/FRAMEWORK_MIGRATION.md.
 */

type Vals = Record<string, string>;
type Groups = Record<string, string[]>;
type Agent = { name: string; phone: string; email: string; shared: string };
type Opt = { value: string; label: string };
type ListingDocument = { filename: string; url: string; fileKey: string };

const PROPERTY_TYPES: Opt[] = [
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "retail", label: "Retail" },
  { value: "medical", label: "Medical" },
  { value: "land", label: "Land" },
  { value: "multifamily", label: "Multifamily" },
];
const PROPERTY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map(o => [o.value, o.label])
);
const TXN_OPTIONS: Opt[] = [
  { value: "lease", label: "Lease" },
  { value: "sale", label: "Sale" },
];
const LEASE_TYPE_OPTIONS: Opt[] = [
  { value: "", label: "— Select —" },
  { value: "NNN", label: "NNN" },
  { value: "FSG", label: "FSG (Full Service Gross)" },
  { value: "MG", label: "MG (Modified Gross)" },
  { value: "G", label: "Gross" },
  { value: "N", label: "Net" },
  { value: "MN", label: "Modified Net" },
];
const LEASE_TERM_OPTIONS: Opt[] = [
  { value: "", label: "— Select —" },
  { value: "negotiable", label: "Negotiable" },
  { value: "custom", label: "Custom" },
];
const CORNER_OPTIONS: Opt[] = [
  { value: "", label: "Select…" },
  { value: "NE", label: "NE" },
  { value: "NW", label: "NW" },
  { value: "SE", label: "SE" },
  { value: "SW", label: "SW" },
];
const RELEASE_OPTIONS: Opt[] = [
  { value: "hold", label: "Hold Until Further Notice" },
  { value: "immediate", label: "Release to MLS & Website Immediately" },
  { value: "date", label: "Release on Date" },
];
const NOTIFY_OPTIONS: Opt[] = [
  { value: "admin-immediate", label: "Admin releases to MLS immediately" },
  { value: "admin-date", label: "Notify the MLS on this date" },
  { value: "agent-notified", label: "Agent will notify / has already notified the MLS" },
];

const strOpts = (...v: string[]): Opt[] => [{ value: "", label: "—" }, ...v.map(x => ({ value: x, label: x }))];
const YN_OPTS: Opt[] = [{ value: "", label: "—" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }];

type DField = { id: string; label: string; type?: "text" | "select"; options?: Opt[] };

const DETAIL_FIELDS: Record<string, DField[]> = {
  industrial: [
    { id: "l-ind-size", label: "Size SF" },
    { id: "l-ind-office", label: "Office SF" },
    { id: "l-ind-parking", label: "Parking" },
    { id: "l-ind-yard", label: "Yard", type: "select", options: YN_OPTS },
    { id: "l-ind-gl", label: "GL Doors" },
    { id: "l-ind-dh", label: "DH Doors" },
    { id: "l-ind-sprinklers", label: "Sprinklers" },
    { id: "l-ind-clearance", label: "Clearance" },
    { id: "l-ind-amps", label: "Amps / Power" },
    { id: "l-ind-zoning", label: "Zoning" },
    { id: "l-ind-construction", label: "Construction" },
  ],
  office: [
    { id: "l-off-rsf", label: "Rentable SF" },
    { id: "l-off-usf", label: "Usable SF" },
    { id: "l-off-floor", label: "Floor" },
    { id: "l-off-parking", label: "Parking" },
    { id: "l-off-class", label: "Class", type: "select", options: strOpts("A", "B", "C") },
    { id: "l-off-zoning", label: "Zoning" },
    { id: "l-off-hvac", label: "HVAC" },
  ],
  retail: [
    { id: "l-ret-gla", label: "GLA SF" },
    { id: "l-ret-frontage", label: "Frontage (ft)" },
    { id: "l-ret-parking", label: "Parking" },
    { id: "l-ret-traffic", label: "Traffic Count" },
    { id: "l-ret-zoning", label: "Zoning" },
    { id: "l-ret-anchor", label: "Anchor Tenant" },
    { id: "l-ret-center-type", label: "Center Type", type: "select", options: strOpts("Strip", "Power Center", "Regional Mall", "Neighborhood", "Freestanding") },
  ],
  land: [
    { id: "l-land-zoning", label: "Zoning" },
    { id: "l-land-utilities", label: "Utilities" },
    { id: "l-land-topo", label: "Topography", type: "select", options: strOpts("Flat", "Sloped", "Irregular") },
    { id: "l-land-entitle", label: "Entitlements" },
    { id: "l-land-apn", label: "APN" },
    { id: "l-land-flood", label: "Flood Zone", type: "select", options: strOpts("Zone A", "Zone X", "Zone AE") },
  ],
};
const DETAIL_GROUPS: Record<string, { id: string; label: string; options: Opt[] }[]> = {
  industrial: [
    { id: "l-bldg-type", label: "Building Type", options: [{ value: "freestanding", label: "Freestanding" }, { value: "pol", label: "POL" }, { value: "multi", label: "Multi" }, { value: "condo", label: "Condo" }] },
    { id: "l-use", label: "Use", options: [{ value: "mfg", label: "Manufacturing" }, { value: "whse", label: "Warehouse/Distribution" }, { value: "rd", label: "R&D" }] },
  ],
  office: [
    { id: "l-off-type", label: "Office Type", options: [{ value: "single_tenant", label: "Single Tenant" }, { value: "multi_tenant", label: "Multi-Tenant" }, { value: "medical", label: "Medical" }, { value: "creative", label: "Creative/Flex" }] },
  ],
  retail: [
    { id: "l-ret-use", label: "Use", options: [{ value: "restaurant", label: "Restaurant" }, { value: "service", label: "Service" }, { value: "medical", label: "Medical/Dental" }, { value: "general", label: "General Retail" }] },
  ],
  land: [],
};
const detailKey = (t: string) =>
  t === "medical" || t === "multifamily" ? "office" : ["industrial", "office", "retail", "land"].includes(t) ? t : "industrial";

const DEAL_DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 84,
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
function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}
function num(v: string): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}
function formatUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function humanError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
function extractMime(file: File): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  if (t === "image/webp") return "image/webp";
  if (t === "application/pdf") return "application/pdf";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/pdf";
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
  const today = todayISO();
  return {
    "l-prop-type": "industrial",
    "l-txn-type": "lease",
    "l-date-entered": today,
    "l-listing-expiration": addMonthsISO(today, 12),
    "l-address": "",
    "l-project-name": "",
    "l-city": "",
    "l-state": "CA",
    "l-zip": "",
    "l-cross": "",
    "l-corner": "",
    "l-lease-sf": "",
    "l-lease-term-type": "",
    "l-lease-term": "",
    "l-lease-type": "",
    "l-bldg-sf": "",
    "l-year-built": "",
    "l-parking-ratio": "",
    "l-acres-gross": "",
    "l-acres-net": "",
    "l-sale-price": "",
    "l-sale-terms": "",
    "l-cap-rate": "",
    "l-release-date": "",
    "l-agent-notify": "admin-immediate",
    "l-comments": "",
  };
}

export default function PortalListingForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [vals, setVals] = useState<Vals>(initialVals);
  const [groups, setGroups] = useState<Groups>({});
  const [agents, setAgents] = useState<Agent[]>([{ name: "", phone: "", email: "", shared: "" }]);
  const [release, setRelease] = useState("hold");
  const [revealLease, setRevealLease] = useState(false);
  const [revealSale, setRevealSale] = useState(false);
  const [expiryAuto, setExpiryAuto] = useState(true);
  const [docs, setDocs] = useState<ListingDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const uploadBatch = trpc.files.uploadBatch.useMutation();
  const extractDoc = trpc.aiAssist.extractListingDocument.useMutation();
  const sendMut = trpc.email.sendToAdmin.useMutation();
  const analyzing = uploadBatch.isPending || extractDoc.isPending;
  const submitting = sendMut.isPending;

  const propType = vals["l-prop-type"];
  const isLease = vals["l-txn-type"] === "lease";
  const isLand = propType === "land";
  const dk = detailKey(propType);

  const bldgSf = num(vals["l-bldg-sf"]);
  const monthly = isLease && num(vals["l-lease-sf"]) && bldgSf ? formatUSD(num(vals["l-lease-sf"]) * bldgSf) : "";
  const saleSf = !isLease && num(vals["l-sale-price"]) && bldgSf ? formatUSD(num(vals["l-sale-price"]) / bldgSf) : "";

  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setAgents(prev => (prev[0]?.name ? prev : [{ ...prev[0], name }, ...prev.slice(1)]));
  }, [user?.name]);

  // One-shot prefill from Quick Convert / portal funnel.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUICK_CONVERT_PREFILL_STORAGE_KEY);
      if (!raw) return;
      const payload = parseQuickConvertPrefill(raw);
      sessionStorage.removeItem(QUICK_CONVERT_PREFILL_STORAGE_KEY);
      if (!payload || payload.tab !== "listing" || !payload.fields) return;
      applyExtracted(payload.fields as Record<string, unknown>);
      toast.success("We carried over your earlier details — review and finish below.");
    } catch {
      /* ignore malformed prefill */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setVal(id: string, value: string) {
    setVals(prev => ({ ...prev, [id]: value }));
  }
  function onDateEntered(v: string) {
    setVals(prev => {
      const next = { ...prev, "l-date-entered": v };
      if (expiryAuto && v) next["l-listing-expiration"] = addMonthsISO(v, 12);
      return next;
    });
  }
  function onExpiration(v: string) {
    setExpiryAuto(false);
    setVal("l-listing-expiration", v);
  }
  function toggleGroup(id: string, value: string) {
    setGroups(prev => {
      const cur = prev[id] || [];
      return { ...prev, [id]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] };
    });
  }

  function applyExtracted(raw: Record<string, unknown>) {
    const norm = normalizeListingExtractFields(raw as Record<string, string>) as Record<string, string>;
    const f = { ...(raw as Record<string, string>), ...norm };
    setVals(prev => {
      const next = { ...prev };
      const set = (id: string, v?: string) => {
        if (v != null && String(v).trim()) next[id] = String(v);
      };
      if (f.propertyType) next["l-prop-type"] = normalizeListingPropertyType(String(f.propertyType));
      if (f.transactionType) next["l-txn-type"] = /sale/i.test(String(f.transactionType)) ? "sale" : "lease";
      set("l-address", f.address);
      set("l-city", f.city);
      set("l-state", f.state);
      set("l-zip", f.zip);
      set("l-date-entered", f.dateEntered);
      set("l-cross", f.crossStreets);
      set("l-lease-sf", f.rateSfMo);
      set("l-lease-term", f.term);
      set("l-lease-type", f.leaseType);
      set("l-bldg-sf", f.buildingSf || f.sizeSf || f.suiteSf);
      set("l-year-built", f.yearBuilt);
      set("l-sale-price", f.askingPrice);
      set("l-comments", f.comments);
      if (f.listingExpiration && String(f.listingExpiration).trim()) {
        next["l-listing-expiration"] = String(f.listingExpiration);
      } else if (next["l-date-entered"]) {
        next["l-listing-expiration"] = addMonthsISO(next["l-date-entered"], 12);
      }
      return next;
    });
    if (f.listingAgentName && String(f.listingAgentName).trim()) {
      const agentName = String(f.listingAgentName);
      setAgents(prev => (prev[0]?.name ? prev : [{ ...prev[0], name: agentName }, ...prev.slice(1)]));
    }
  }

  async function onDocsSelected(files: FileList | null) {
    if (!files || !files.length) return;
    try {
      const payload = await Promise.all(
        Array.from(files).map(async file => ({
          filename: file.name,
          mimeType: extractMime(file),
          base64Data: await fileToBase64(file),
          category: "listing_deal_documents",
          reference: vals["l-address"] || "listing",
        }))
      );
      const result = await uploadBatch.mutateAsync({ files: payload, uploaderName: user?.name ?? undefined });
      const ok = (result?.results ?? result ?? []).filter((r: { success?: boolean }) => r && r.success !== false);
      const uploaded = ok
        .map((r: { filename?: string; url?: string; fileKey?: string }) => ({
          filename: r.filename ?? "Document",
          url: r.url ?? "",
          fileKey: r.fileKey ?? "",
        }))
        .filter((r: { url: string }) => r.url);
      setDocs(prev => [...prev, ...uploaded]);

      // AI-extract from the first uploaded document and prefill.
      const first = uploaded[0];
      if (first?.url) {
        const ex = await extractDoc.mutateAsync({ fileUrl: first.url, mimeType: "application/pdf" });
        if (ex?.success && ex.fields && Object.keys(ex.fields).length) {
          applyExtracted(ex.fields as Record<string, unknown>);
          toast.success("Document analyzed — we filled in what we could find.");
        } else {
          toast.success("Document uploaded.");
        }
      }
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  function buildSections(): PdfSection[] {
    const v = (id: string) => vals[id] || "";
    const sections: PdfSection[] = [
      {
        title: "Listing Details",
        fields: [
          { label: "Date Entered", value: v("l-date-entered") },
          { label: "Property Type", value: PROPERTY_TYPE_LABELS[propType] ?? propType },
          { label: "Transaction", value: isLease ? "Lease" : "Sale" },
          { label: "Address", value: v("l-address") },
          { label: "Project / Property Name", value: v("l-project-name") },
          { label: "City", value: v("l-city") },
          { label: "State", value: v("l-state") },
          { label: "Zip", value: v("l-zip") },
          { label: "Cross Street(s)", value: v("l-cross") },
          { label: "Corner", value: v("l-corner") },
          { label: "Listing Expiration", value: v("l-listing-expiration") },
        ],
      },
      {
        title: isLease ? "Lease Pricing" : "Sale Pricing",
        fields: isLease
          ? [
              { label: "Rate $/SF/Mo", value: v("l-lease-sf") },
              { label: "Monthly Rent", value: monthly },
              { label: "Lease Type", value: v("l-lease-type") },
              { label: "Term", value: v("l-lease-term-type") === "custom" ? v("l-lease-term") : v("l-lease-term-type") },
              { label: "Reveal Prices to MLS", value: revealLease ? "Yes" : "No" },
            ]
          : [
              { label: "Asking Price", value: v("l-sale-price") },
              { label: "Sale $/SF", value: saleSf },
              { label: "Sale Terms", value: v("l-sale-terms") },
              { label: "CAP Rate", value: v("l-cap-rate") },
              { label: "Reveal Prices to MLS", value: revealSale ? "Yes" : "No" },
            ],
      },
      {
        title: "Size",
        fields: isLand
          ? [
              { label: "Gross Acres", value: v("l-acres-gross") },
              { label: "Net Acres", value: v("l-acres-net") },
            ]
          : [
              { label: "Building / GLA SF", value: v("l-bldg-sf") },
              { label: "Year Built", value: v("l-year-built") },
              { label: "Parking Ratio", value: v("l-parking-ratio") },
            ],
      },
    ];

    // Type-specific property details.
    const detailFields = DETAIL_FIELDS[dk].map(d => ({
      label: d.label,
      value: d.type === "select" ? optLabel(d.options, v(d.id)) : v(d.id),
    }));
    DETAIL_GROUPS[dk].forEach(g => {
      const picked = (groups[g.id] || []).map(val => g.options.find(o => o.value === val)?.label || val);
      detailFields.push({ label: g.label, value: picked.join(", ") });
    });
    sections.push({ title: `${PROPERTY_TYPE_LABELS[propType] ?? "Property"} Details`, fields: detailFields });

    sections.push({
      title: "Release Instructions",
      fields: [
        { label: "Listing Release", value: optLabel(RELEASE_OPTIONS, release) },
        { label: "Release Date", value: release === "date" ? v("l-release-date") : "" },
        { label: "Notify the MLS", value: optLabel(NOTIFY_OPTIONS, v("l-agent-notify")) },
      ],
    });

    sections.push({
      title: "Listing Agents",
      fields: agents
        .filter(a => a.name.trim() || a.email.trim())
        .map((a, i) => ({
          label: `Agent ${i + 1}`,
          value: [a.name, a.phone, a.email, a.shared ? `${a.shared}% shared` : ""].filter(Boolean).join(" · "),
        })),
    });

    if (docs.length) {
      sections.push({
        title: "Deal Documents",
        fields: docs.map((d, i) => ({ label: `Document ${i + 1}`, value: d.filename })),
      });
    }

    sections.push({ title: "Comments", fields: [{ label: "Comments / Special Instructions", value: v("l-comments") }] });
    return sections;
  }

  function pdfInput(propertyAddress: string) {
    return {
      title: "LISTING ENTRY",
      sections: buildSections(),
      table: agents.filter(a => a.name.trim() || a.email.trim()).length
        ? {
            title: "Listing Agents",
            columns: ["Name", "Phone", "Email", "Shared %"],
            rows: agents.filter(a => a.name.trim() || a.email.trim()).map(a => [a.name, a.phone, a.email, a.shared]),
          }
        : undefined,
      propertyAddress,
      filenamePrefix: "Listing_Entry",
    };
  }

  async function onDownloadPdf() {
    const propertyAddress = [vals["l-address"].trim(), vals["l-city"].trim()].filter(Boolean).join(", ");
    try {
      const pdf = await buildSectionedPdf(pdfInput(propertyAddress));
      downloadBlob(pdf.blob, pdf.filename);
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  async function onSubmit() {
    setError(null);
    if (!vals["l-address"].trim() || !vals["l-city"].trim()) {
      setError("Property address and city are required before sending.");
      return;
    }
    const propertyAddress = [vals["l-address"].trim(), vals["l-city"].trim()].filter(Boolean).join(", ");
    const sections = buildSections();
    const senderEmail = user?.email && /.+@.+\..+/.test(user.email) ? user.email : undefined;
    const supportingFiles = docs
      .filter(d => isListingSupportingFileUrl(d.url) && d.fileKey)
      .map(d => ({ filename: d.filename, url: d.url, fileKey: d.fileKey, category: "listing_deal_documents", label: "Deal Document" }));
    try {
      const pdf = await buildSectionedPdf(pdfInput(propertyAddress));
      const result = await sendMut.mutateAsync({
        formType: "listing",
        brokerName: (user?.name || agents[0]?.name || "").trim(),
        propertyAddress,
        sections,
        senderEmail,
        pdfAttachment: { filename: pdf.filename, mimeType: pdf.mimeType, base64Data: pdf.base64Data },
        supportingFiles,
        formData: undefined,
      });
      if (!result.success) {
        throw new Error(result.error || "The listing could not be submitted.");
      }
      downloadBlob(pdf.blob, pdf.filename);
      toast.success("Listing submitted — the admin team has it in the queue.");
      setLocation("/portal/submissions");
    } catch (e) {
      setError(humanError(e));
    }
  }

  function onClear() {
    if (!window.confirm("Clear the listing form?")) return;
    setVals(initialVals());
    setGroups({});
    setAgents([{ name: user?.name?.trim() || "", phone: "", email: "", shared: "" }]);
    setRelease("hold");
    setRevealLease(false);
    setRevealSale(false);
    setExpiryAuto(true);
    setDocs([]);
    setError(null);
  }

  const showProjectName = propType === "office" || propType === "retail";
  const showCorner = propType === "retail";
  const showCapRate = propType === "retail" && !isLease;

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="New listing?"
      title="Add a listing"
      description="Enter the property, pricing, agents, and release instructions, then send it to the admin team for marketing and records. Upload the signed exclusive and Deal Assist will prefill most of this for you."
      actions={
        <LinkButton href="/portal/workspace" variant="secondary">
          Back to workspace
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 920 }}>
        {/* Documents + AI */}
        <Card padding="lg">
          <SectionTitle>Deal documents</SectionTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              border: "1px dashed var(--ink-200)",
              borderRadius: 10,
              padding: "14px 16px",
              background: "var(--ink-50)",
            }}
          >
            <span style={{ color: "var(--ai-500)", display: "flex" }}>
              <Icons.Sparkles size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
                Got the signed exclusive or listing agreement?
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                {docs.length ? `${docs.length} document(s) attached` : "Upload it and we'll read it and prefill the form."}
              </div>
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept={DEAL_DOC_ACCEPT}
              multiple
              style={{ display: "none" }}
              onChange={e => onDocsSelected(e.target.files)}
            />
            <Button variant="ai" loading={analyzing} onClick={() => docInputRef.current?.click()} icon={<Icons.Upload size={15} />}>
              {analyzing ? "Analyzing…" : "Upload & analyze"}
            </Button>
          </div>
          {docs.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
              {docs.map((d, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--ink-600)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.Docs size={13} /> {d.filename}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Property + pricing */}
        <Card padding="lg">
          <SectionTitle>Property</SectionTitle>

          <Field label="Property type" required>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PROPERTY_TYPES.map(opt => {
                const selected = propType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVal("l-prop-type", opt.value)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      border: `1px solid ${selected ? "var(--lee-red)" : "var(--ink-200)"}`,
                      background: selected ? "var(--lee-red-wash)" : "var(--ink-0)",
                      color: selected ? "var(--lee-red)" : "var(--ink-700)",
                      transition: "border-color .12s, background .12s",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 16 }}>
            <Field label="Transaction type" required>
              <Select value={vals["l-txn-type"]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("l-txn-type", e.target.value)} options={TXN_OPTIONS} />
            </Field>
            <Field label="Date entered" required>
              <Input type="date" value={vals["l-date-entered"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDateEntered(e.target.value)} />
            </Field>
            <Field label="Listing expiration" help={expiryAuto ? "Auto: 12 months from date entered" : undefined}>
              <Input type="date" value={vals["l-listing-expiration"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onExpiration(e.target.value)} />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="Address" required>
              <AddressAutocompleteInput
                value={vals["l-address"]}
                onChange={v => setVal("l-address", v)}
                onSelect={s => {
                  setVal("l-address", s.address);
                  if (s.city) setVal("l-city", s.city);
                  if (s.state) setVal("l-state", s.state);
                  if (s.zip) setVal("l-zip", s.zip);
                }}
                placeholder="1450 Von Karman Ave"
              />
            </Field>
          </div>

          {showProjectName && (
            <div style={{ marginTop: 14 }}>
              <Field label="Project / property name" optional>
                <Input value={vals["l-project-name"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-project-name", e.target.value)} placeholder="Plaza Tower" />
              </Field>
            </div>
          )}

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginTop: 14 }}>
            <Field label="City" required>
              <Input value={vals["l-city"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-city", e.target.value)} placeholder="Irvine" />
            </Field>
            <Field label="State" required>
              <Input value={vals["l-state"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-state", e.target.value)} placeholder="CA" />
            </Field>
            <Field label="Zip" required>
              <Input value={vals["l-zip"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-zip", e.target.value)} placeholder="92612" />
            </Field>
            <Field label="Cross street(s)" optional>
              <Input value={vals["l-cross"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-cross", e.target.value)} placeholder="At Jamboree" />
            </Field>
            {showCorner && (
              <Field label="Corner" optional>
                <Select value={vals["l-corner"]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("l-corner", e.target.value)} options={CORNER_OPTIONS} />
              </Field>
            )}
          </div>
        </Card>

        {/* Size + pricing */}
        <Card padding="lg">
          <SectionTitle>{isLease ? "Size & lease pricing" : "Size & sale pricing"}</SectionTitle>

          {isLand ? (
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Field label="Gross acres"><Input value={vals["l-acres-gross"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-acres-gross", e.target.value)} inputMode="decimal" /></Field>
              <Field label="Net acres" optional><Input value={vals["l-acres-net"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-acres-net", e.target.value)} inputMode="decimal" /></Field>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Field label="Building / GLA SF"><Input value={vals["l-bldg-sf"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-bldg-sf", e.target.value)} placeholder="52,000" inputMode="numeric" /></Field>
              <Field label="Year built" optional><Input value={vals["l-year-built"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-year-built", e.target.value)} /></Field>
              <Field label="Parking ratio" optional><Input value={vals["l-parking-ratio"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-parking-ratio", e.target.value)} /></Field>
            </div>
          )}

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginTop: 14 }}>
            {isLease ? (
              <>
                <Field label="Rate $/SF/Mo"><Input value={vals["l-lease-sf"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-lease-sf", e.target.value)} placeholder="1.15" inputMode="decimal" /></Field>
                <Field label="Monthly rent"><Input value={monthly} auto readOnly placeholder="—" /></Field>
                <Field label="Lease type" required><Select value={vals["l-lease-type"]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("l-lease-type", e.target.value)} options={LEASE_TYPE_OPTIONS} /></Field>
                <Field label="Term"><Select value={vals["l-lease-term-type"]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("l-lease-term-type", e.target.value)} options={LEASE_TERM_OPTIONS} /></Field>
                {vals["l-lease-term-type"] === "custom" && (
                  <Field label="Term (months)"><Input value={vals["l-lease-term"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-lease-term", e.target.value)} inputMode="numeric" /></Field>
                )}
              </>
            ) : (
              <>
                <Field label="Asking price"><Input value={vals["l-sale-price"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-sale-price", e.target.value)} placeholder="8,200,000" inputMode="decimal" prefix="$" /></Field>
                <Field label="Sale $/SF"><Input value={saleSf} auto readOnly placeholder="—" /></Field>
                <Field label="Sale terms" optional><Input value={vals["l-sale-terms"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-sale-terms", e.target.value)} /></Field>
                {showCapRate && (
                  <Field label="CAP rate" optional><Input value={vals["l-cap-rate"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-cap-rate", e.target.value)} suffix="%" /></Field>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <Toggle
              on={isLease ? revealLease : revealSale}
              onClick={() => (isLease ? setRevealLease(v => !v) : setRevealSale(v => !v))}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
              {(isLease ? revealLease : revealSale) ? "Prices visible on MLS" : "Prices hidden from MLS"}
            </span>
          </div>
        </Card>

        {/* Property details (type-specific) */}
        <Card padding="lg">
          <SectionTitle>{PROPERTY_TYPE_LABELS[propType] ?? "Property"} details</SectionTitle>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {DETAIL_FIELDS[dk].map(d => (
              <Field key={d.id} label={d.label} optional>
                {d.type === "select" ? (
                  <Select value={vals[d.id] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal(d.id, e.target.value)} options={d.options || []} />
                ) : (
                  <Input value={vals[d.id] || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(d.id, e.target.value)} />
                )}
              </Field>
            ))}
          </div>
          {DETAIL_GROUPS[dk].map(g => (
            <div key={g.id} style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 8 }}>{g.label}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {g.options.map(o => {
                  const on = (groups[g.id] || []).includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleGroup(g.id, o.value)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 999,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--lee-red)" : "var(--ink-200)"}`,
                        background: on ? "var(--lee-red-wash)" : "var(--ink-0)",
                        color: on ? "var(--lee-red)" : "var(--ink-700)",
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {/* Listing agents */}
        <Card padding="lg">
          <SectionTitle>Listing agents</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {agents.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 90px 40px", gap: 8, alignItems: "center" }}>
                <Input value={a.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgents(prev => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Agent name" />
                <Input value={a.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgents(prev => prev.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="949-000-0000" />
                <Input value={a.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgents(prev => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} placeholder="email@lee-associates.com" />
                <Input value={a.shared} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgents(prev => prev.map((x, j) => (j === i ? { ...x, shared: e.target.value } : x)))} placeholder="50" suffix="%" />
                <button
                  type="button"
                  aria-label="Remove agent"
                  onClick={() => setAgents(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                  style={{ width: 34, height: 40, border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--err-600)", borderRadius: 8, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" size="sm" icon={<Icons.Plus size={14} />} onClick={() => setAgents(prev => [...prev, { name: "", phone: "", email: "", shared: "" }])}>
              Add agent
            </Button>
          </div>
        </Card>

        {/* Release instructions */}
        <Card padding="lg">
          <SectionTitle>Release instructions</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {RELEASE_OPTIONS.map(o => (
              <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-800)", cursor: "pointer" }}>
                <input type="radio" name="l-release" checked={release === o.value} onChange={() => setRelease(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 14 }}>
            {release === "date" && (
              <Field label="MLS & website release date">
                <Input type="date" value={vals["l-release-date"]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal("l-release-date", e.target.value)} />
              </Field>
            )}
            <Field label="Notify the MLS?">
              <Select value={vals["l-agent-notify"]} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("l-agent-notify", e.target.value)} options={NOTIFY_OPTIONS} />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Comments / special instructions" optional>
              <textarea value={vals["l-comments"]} onChange={e => setVal("l-comments", e.target.value)} placeholder="Suite mix, cross streets, or other notes for admin" style={textareaStyle} />
            </Field>
          </div>
        </Card>

        {error ? (
          <div role="alert" style={{ color: "var(--err-700)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Warn size={14} /> {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={onSubmit} loading={submitting} iconRight={<Icons.Arrow size={16} />}>
            {submitting ? "Submitting…" : "Submit to admin"}
          </Button>
          <Button variant="secondary" onClick={onDownloadPdf} icon={<Icons.Download size={15} />}>
            Download PDF
          </Button>
          <Button variant="ghost" onClick={onClear}>
            Clear form
          </Button>
          {user?.name ? (
            <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Signed in as {user.name}</span>
          ) : null}
        </div>
      </div>
    </AdminPortalShell>
  );
}

function optLabel(options: Opt[] | undefined, value: string): string {
  if (!options) return value;
  return options.find(o => o.value === value)?.label ?? value;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: "var(--ink-900)",
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: "1px solid var(--ink-150)",
      }}
    >
      {children}
    </div>
  );
}
