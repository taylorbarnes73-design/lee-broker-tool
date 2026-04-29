import React, { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Icons, PageHeader, Segmented, Button, Card, Badge,
  Input, Select, Field
} from '../design/index.jsx';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
};

type CompType = 'lease' | 'sale';
type CompSearchResult = {
  id: number;
  importId: number;
  compType: CompType;
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  market: string;
  subMarket: string;
  propertyType: string;
  propertySubType: string;
  transactionDate: string;
  source: string;
  metricLine: string;
  metaLine: string;
  sfLeased?: string | number;
  sfSold?: string | number;
  rate?: string | number;
  salePrice?: string | number;
  leaseTerm?: string | number;
  leaseDate?: string;
  saleDate?: string;
  reportCard: {
    heading?: string;
    addressLine?: string;
    cityLine?: string;
    submarketLine?: string;
    listingBrokerLine?: string;
    procuringBrokerLine?: string;
    sourceLine?: string;
    updatedLine?: string;
    comments?: string;
    fields: Record<string, string>;
  };
};

type UploadedFileRecord = {
  id?: number;
  fileKey: string;
  url: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  category: string;
  reference: string | null;
  uploaderName: string | null;
  createdAt?: Date;
  uploadedAt?: Date;
};

type ContractData = {
  contractType: string;
  party1Name?: string;
  agentName?: string;
  agentEmail?: string;
  propAddress?: string;
  propCity?: string;
  propState?: string;
  propZip?: string;
  termStart?: string;
  termEnd?: string;
  commAmount?: string;
  arbitration?: string;
  additionalProvisions?: string;
  redlines?: Array<{ paragraph: string; type: "strikethrough" | "added" | "modified"; note: string }>;
};

const DOC_CATEGORIES = [
  { name: 'Listing Agreements', category: 'listing_agreement', tone: 'crimson' },
  { name: 'Lease Documents', category: 'lease_document', tone: 'slate' },
  { name: 'Purchase & Sale', category: 'purchase_sale', tone: 'neutral' },
  { name: 'Commission Agreements', category: 'commission_agreement', tone: 'neutral' },
  { name: 'Disclosures', category: 'disclosure', tone: 'warn' },
  { name: 'Sign Orders', category: 'sign_order', tone: 'neutral' },
  { name: 'Voucher Forms', category: 'voucher_doc', tone: 'neutral' },
  { name: 'Office Forms', category: 'office_form', tone: 'slate' },
  { name: 'Marketing & PR', category: 'marketing_pr', tone: 'neutral' },
  { name: 'Comp Workbooks', category: 'comp_workbook', tone: 'neutral' },
] as const;

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatShortDate(value?: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SectionHeader({ eyebrow, title, description, right }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        {eyebrow && <div className="lee-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)' }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2 }}>{description}</div>}
      </div>
      {right}
    </div>
  );
}

function compField(comp: CompSearchResult, field: string) {
  return comp.reportCard?.fields?.[field] || "";
}

function compParty(comp: CompSearchResult) {
  return comp.compType === 'lease'
    ? compField(comp, "Lessee") || "Confidential"
    : compField(comp, "Buyer") || "Confidential";
}

function compSize(comp: CompSearchResult) {
  return comp.compType === 'lease'
    ? compField(comp, "Space Leased") || compField(comp, "Bldg SqFt") || "-"
    : compField(comp, "Bldg. SqFt") || "-";
}

function compRate(comp: CompSearchResult) {
  return comp.compType === 'lease'
    ? compField(comp, "Rent/SqFt") || "-"
    : compField(comp, "Sale Price") || compField(comp, "Sale $/SF") || "-";
}

function compTerm(comp: CompSearchResult) {
  return comp.compType === 'lease'
    ? compField(comp, "Term") || "-"
    : compField(comp, "Trans. Type") || "-";
}
/* Lee Broker Tool — Comps, Admin, Contracts, Documents, AI panel */

// â”€â”€ Comp Reports (the user said this is a mess — redesign as a clear workflow) â”€â”€
const LEASE_REPORT_FIELD_ORDER = [
  "Space Leased",
  "Office",
  "Trans. Date",
  "Prop. Type",
  "On Mrkt",
  "DH",
  "Sprk",
  "Lessee",
  "Rent/SqFt",
  "TI Allow",
  "Expir. Date",
  "Subtype",
  "Amps",
  "GL",
  "Rail",
  "Lessor",
  "Eff. Rent",
  "Free Rent",
  "Term",
  "Bldg. Class",
  "Mul-Ten",
  "POL",
  "Yrd",
  "Space Type",
  "Bldg SqFt",
  "NNN Chgs",
  "Occ Date",
  "Parking",
  "Yr Built",
  "HT",
  "Land",
  "Options/Rent Adj",
] as const;

const SALE_REPORT_FIELD_ORDER = [
  "Bldg. SqFt",
  "Sale Price",
  "Trans. Date",
  "Prop. Type",
  "Yr Built",
  "DH",
  "Sprk",
  "Buyer",
  "Office SqFt",
  "Sale $/SF",
  "On Market",
  "Subtype",
  "Mul-Tnt",
  "GL",
  "RR",
  "Seller",
  "Land Size",
  "Trans. Type",
  "Cap Rate",
  "Bldg. Class",
  "Amps",
  "Clr",
  "Yard",
  "Buyer Previous Location",
] as const;

function buildMetropolisCompPacketHtml({
  compType,
  rows,
  subjectAddress,
  subjectCity,
  propertyType,
}: {
  compType: CompType;
  rows: CompSearchResult[];
  subjectAddress: string;
  subjectCity: string;
  propertyType: string;
}) {
  const title = compType === "lease" ? "LEASE COMPARABLES" : "SALE COMPARABLES";
  const fieldOrder = compType === "lease" ? LEASE_REPORT_FIELD_ORDER : SALE_REPORT_FIELD_ORDER;
  const generated = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subjectLine = [subjectAddress, subjectCity, propertyType].filter(Boolean).join(" | ");
  const cards = rows.map((comp, index) => {
    const card = comp.reportCard;
    const fields = fieldOrder.map((field) => `
      <div class="field">
        <div class="label">${htmlEscape(field)}</div>
        <div class="value">${htmlEscape(card.fields[field] || "")}</div>
      </div>
    `).join("");
    const brokerLines = [
      card.procuringBrokerLine,
      card.listingBrokerLine,
      card.sourceLine,
    ].filter(Boolean).map((line) => `<div>${htmlEscape(line)}</div>`).join("");
    const locationLines = [
      card.addressLine,
      card.cityLine,
      card.submarketLine,
    ].filter(Boolean).map((line) => `<div>${htmlEscape(line)}</div>`).join("");

    return `
      <section class="comp-card">
        <div class="comp-number">${index + 1}.</div>
        <div class="photo">No Photo Available</div>
        <div class="comp-body">
          <div class="comp-title">${htmlEscape(card.heading || comp.title || comp.address)}</div>
          <div class="location">${locationLines}</div>
          <div class="field-grid">${fields}</div>
          <div class="broker-lines">${brokerLines}</div>
          ${card.comments ? `<div class="comments"><b>Comments:</b> ${htmlEscape(card.comments)}</div>` : ""}
          <div class="updated">${htmlEscape(card.updatedLine)}</div>
        </div>
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${htmlEscape(title)} - Metropolis</title>
  <style>
    @page { size: letter landscape; margin: 0.32in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 8.5pt;
      line-height: 1.25;
      background: #fff;
    }
    .report-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      padding-bottom: 6px;
      border-bottom: 1px solid #111;
      margin-bottom: 6px;
    }
    .title { font-size: 14pt; font-weight: 700; letter-spacing: 0; }
    .subtitle, .date, .subject { font-size: 8.5pt; }
    .disclaimer { font-size: 7pt; color: #333; margin-bottom: 6px; }
    .comp-card {
      display: grid;
      grid-template-columns: 24px 104px 1fr;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid #999;
      break-inside: avoid;
      page-break-inside: avoid;
      min-height: 112px;
    }
    .comp-number { font-weight: 700; font-size: 10pt; }
    .photo {
      border: 1px solid #bbb;
      background: #f2f2f2;
      color: #555;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px;
      font-size: 7pt;
      min-height: 76px;
    }
    .comp-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .location { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; text-transform: uppercase; }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      border-top: 1px solid #cfcfcf;
      border-left: 1px solid #cfcfcf;
    }
    .field {
      min-height: 24px;
      padding: 2px 4px;
      border-right: 1px solid #cfcfcf;
      border-bottom: 1px solid #cfcfcf;
      overflow-wrap: anywhere;
    }
    .label { font-size: 6.5pt; color: #555; font-weight: 700; }
    .value { font-size: 8pt; font-weight: 600; }
    .broker-lines { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; margin-top: 4px; }
    .comments { margin-top: 3px; }
    .updated { margin-top: 2px; font-size: 7pt; color: #333; text-align: right; }
  </style>
</head>
<body>
  <header class="report-header">
    <div>
      <div class="title">${htmlEscape(title)}</div>
      <div class="subtitle">Metropolis</div>
      <div class="subtitle">Industrial with Small Pictures</div>
      <div class="subject">${htmlEscape(subjectLine)}</div>
    </div>
    <div class="date">${htmlEscape(generated)}</div>
  </header>
  <div class="disclaimer">This information is compiled from data we believe to be correct but no liability is assumed by the company as to the accuracy of such data.</div>
  ${cards}
</body>
</html>`;
}

function FunctionalCompScreen() {
  const utils = trpc.useUtils();
  const [compType, setCompType] = useState<CompType>('lease');
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [closedWithin, setClosedWithin] = useState("12 months");
  const [selectedCompKeys, setSelectedCompKeys] = useState<Set<string>>(new Set());
  const compImportInputRef = useRef<HTMLInputElement | null>(null);

  const dateFrom = useMemo(() => {
    const months = Number(closedWithin.split(" ")[0]) || 12;
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().slice(0, 10);
  }, [closedWithin]);

  const compsQuery = trpc.compData.search.useQuery({
    compType,
    query: query.trim() || undefined,
    city: city.trim() || undefined,
    propertyType: propertyType.trim() || undefined,
    dateFrom,
    limit: 20,
  });
  const comps = useMemo(() => (compsQuery.data?.results ?? []) as CompSearchResult[], [compsQuery.data?.results]);
  const latestImport = compsQuery.data?.latestImport;
  const selectedComps = useMemo(
    () => comps.filter((comp) => selectedCompKeys.has(`${comp.compType}-${comp.id}`)),
    [comps, selectedCompKeys]
  );

  useEffect(() => {
    setSelectedCompKeys(new Set(comps.map((comp) => `${comp.compType}-${comp.id}`)));
  }, [comps]);

  const workbookUploadMutation = trpc.files.upload.useMutation();
  const workbookImportMutation = trpc.compData.importWorkbook.useMutation({
    onSuccess: async () => {
      toast.success("Comp workbook imported.");
      await Promise.all([
        utils.compData.search.invalidate(),
        utils.compData.latest.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const isImporting = workbookUploadMutation.isPending || workbookImportMutation.isPending;

  const handleImportWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const base64Data = await readFileAsBase64(file);
      const uploaded = await workbookUploadMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64Data,
        category: "comp_workbook",
        reference: "Comparable workbook import",
      });
      await workbookImportMutation.mutateAsync({ fileKey: uploaded.fileKey, filename: file.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import workbook.");
    }
  };

  const toggleComp = (key: string) => {
    setSelectedCompKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allChecked = comps.length > 0 && comps.every((c) => selectedCompKeys.has(`${c.compType}-${c.id}`));
  const someChecked = comps.some((c) => selectedCompKeys.has(`${c.compType}-${c.id}`));

  const handleSelectAll = () => {
    if (allChecked) {
      setSelectedCompKeys(new Set());
    } else {
      setSelectedCompKeys(new Set(comps.map((c) => `${c.compType}-${c.id}`)));
    }
  };

  const handleExportCsv = () => {
    const rows = selectedComps.length ? selectedComps : comps;
    if (!rows.length) {
      toast.error("No comps to export.");
      return;
    }

    const headers = ["Type", "Property", "Address", "City", "Property Type", "Party", "Size", "Rate/Price", "Term", "Closed", "Source"];
    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((comp) => [
        comp.compType,
        comp.title,
        comp.address,
        comp.city,
        comp.propertyType,
        compParty(comp),
        compSize(comp),
        compRate(comp),
        compTerm(comp),
        comp.transactionDate,
        comp.source,
      ].map(csvEscape).join(",")),
    ].join("\n");

    downloadTextFile(`lee-${compType}-comps-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8", csv);
    toast.success("CSV exported.");
  };

  const handleBuildPacket = () => {
    const rows = selectedComps.length ? selectedComps : comps;
    if (!rows.length) {
      toast.error("No comps selected.");
      return;
    }

    const html = buildMetropolisCompPacketHtml({
      compType,
      rows,
      subjectAddress: "",
      subjectCity: city,
      propertyType,
    });

    downloadTextFile(`lee-${compType}-comps-packet.html`, "text/html;charset=utf-8", html);
    toast.success("Packet downloaded. Open the file and print to PDF.");
  };

  const selectedCount = selectedComps.length;

  return (
    <div>
      <input
        ref={compImportInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleImportWorkbook}
      />
      <PageHeader
        eyebrow="Market Intelligence"
        title="Comparable Reports"
        description="Filter comps, select the ones you want, then build a branded PDF packet."
      />

      <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar: filters */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card padding={16}>
            <Field label="Comp type">
              <Segmented
                size="sm"
                value={compType}
                onChange={(value: CompType) => setCompType(value)}
                options={[{ value: 'lease', label: 'Lease' }, { value: 'sale', label: 'Sale' }]}
              />
            </Field>
            <div style={{ marginTop: 12 }}>
              <Field label="Keyword">
                <Input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                  placeholder="Tenant, buyer, address..."
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="City">
                <Input
                  value={city}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setCity(event.target.value)}
                  placeholder="e.g. Costa Mesa"
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Property type">
                <Input
                  value={propertyType}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPropertyType(event.target.value)}
                  placeholder="e.g. Industrial"
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Closed within">
                <Select
                  value={closedWithin}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setClosedWithin(event.target.value)}
                  options={['3 months', '6 months', '12 months', '24 months']}
                />
              </Field>
            </div>
          </Card>

          <button
            onClick={() => compImportInputRef.current?.click()}
            disabled={isImporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
              background: 'none', border: '1px solid var(--ink-200)', borderRadius: 7,
              cursor: isImporting ? 'default' : 'pointer', fontSize: 12, color: 'var(--ink-600)',
              fontWeight: 500,
            }}
          >
            <Icons.Upload size={13}/>
            {isImporting ? "Importing..." : "Import workbook"}
          </button>

          {latestImport && (
            <div style={{ fontSize: 11, color: 'var(--ink-400)', lineHeight: 1.4, padding: '2px 2px' }}>
              Source: {latestImport.workbookName}
            </div>
          )}
        </div>

        {/* Main: results table */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {/* Column header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 2.2fr 1.1fr .9fr 1fr .9fr .9fr',
            padding: '10px 20px',
            background: 'var(--ink-50)',
            borderBottom: '1px solid var(--ink-150)',
            fontSize: 10, fontWeight: 700, color: 'var(--ink-500)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            alignItems: 'center',
          }}>
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
              onChange={handleSelectAll}
              style={{ accentColor: 'var(--lee-crimson)', cursor: 'pointer' }}
            />
            <div>Property</div>
            <div>{compType === 'lease' ? 'Tenant' : 'Buyer'}</div>
            <div>SF</div>
            <div>{compType === 'lease' ? 'Rate' : 'Price'}</div>
            <div>{compType === 'lease' ? 'Term' : 'Type'}</div>
            <div>Closed</div>
          </div>

          {compsQuery.isLoading && (
            <div style={{ padding: '28px 20px', color: 'var(--ink-400)', fontSize: 13 }}>Loading...</div>
          )}
          {compsQuery.isError && (
            <div style={{ padding: '20px', color: 'var(--err-600)', fontSize: 13 }}>{compsQuery.error.message}</div>
          )}
          {!compsQuery.isLoading && !compsQuery.isError && !comps.length && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
              No comps match the current filters.
            </div>
          )}

          {comps.map((r) => {
            const key = `${r.compType}-${r.id}`;
            const checked = selectedCompKeys.has(key);
            return (
              <label
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 2.2fr 1.1fr .9fr 1fr .9fr .9fr',
                  padding: '11px 20px',
                  alignItems: 'center',
                  borderTop: '1px solid var(--ink-150)',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: checked ? 'var(--ink-0)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleComp(key)}
                  style={{ accentColor: 'var(--lee-crimson)', cursor: 'pointer' }}
                />
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title || r.address}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {[r.city, r.propertyType].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8, fontSize: 12 }}>
                  {compParty(r)}
                </div>
                <div className="lee-mono" style={{ color: 'var(--ink-700)', fontSize: 12 }}>{compSize(r)}</div>
                <div className="lee-mono" style={{ fontWeight: 600, fontSize: 13 }}>{compRate(r)}</div>
                <div className="lee-mono" style={{ color: 'var(--ink-600)', fontSize: 12 }}>{compTerm(r)}</div>
                <div style={{ color: 'var(--ink-500)', fontSize: 12 }}>{r.transactionDate || "—"}</div>
              </label>
            );
          })}

          {/* Action footer */}
          <div style={{
            padding: '12px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid var(--ink-150)',
            background: 'var(--ink-50)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              {selectedCount} of {comps.length} selected
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" icon={<Icons.Download size={13}/>} onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Icons.Docs size={13}/>}
                onClick={handleBuildPacket}
                disabled={selectedCount === 0}
              >
                Build packet ({selectedCount})
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CompScreen() {
  return <FunctionalCompScreen />;
}


function StatCard({label,value,unit,trend}: { label: string; value: ReactNode; unit?: string; trend?: string }) {
  return (
    <Card padding={16}>
      <div className="lee-eyebrow">{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap: 4, marginTop: 4 }}>
        <span className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{unit}</span>
      </div>
      {trend && <div style={{ fontSize: 11, color: trend.startsWith('-') ? 'var(--err-600)' : 'var(--ok-600)', fontWeight: 600, marginTop: 2 }}>{trend}</div>}
    </Card>
  );
}

// â”€â”€ Admin Portal — inbox, Dealius push, agent roster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function AdminScreen() {
  const [view, setView] = React.useState('inbox');
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Admin Portal"
        description="Inbox of broker submissions, Dealius listing & deal input, agent roster, and office operations."
        right={<>
          <Badge tone="crimson" size="md">7 pending</Badge>
          <Button variant="secondary" size="sm" icon={<Icons.Download size={14}/>}>Export week</Button>
          <Button variant="primary" size="sm" icon={<Icons.Plus size={14}/>}>Add agent</Button>
        </>}
      />

      {/* View switcher */}
      <div style={{ padding: '0 32px', borderBottom: '1px solid var(--ink-200)', display:'flex', gap: 2 }}>
        {[
          {id:'inbox', label:'Submissions inbox', count: 7},
          {id:'dealius', label:'Dealius push', count: 3},
          {id:'roster', label:'Agent roster', count: 24},
          {id:'ops', label:'Office ops'},
        ].map(v => {
          const active = v.id === view;
          return (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              padding: '12px 18px', background:'transparent', border:'none', cursor:'pointer',
              fontSize: 13.5, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lee-crimson)' : 'var(--ink-600)',
              borderBottom: active ? '2px solid var(--lee-crimson)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {v.label}
              {v.count !== undefined && (
                <span className="lee-mono" style={{
                  padding: '1px 6px', borderRadius: 999,
                  background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-100)',
                  color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-600)',
                  fontSize: 10, fontWeight: 700,
                }}>{v.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {view === 'inbox' && <AdminInbox/>}
      {view === 'dealius' && <AdminDealius/>}
      {view === 'roster' && <AdminRoster/>}
      {view === 'ops' && <AdminOps/>}
    </div>
  );
}

// â”€â”€ Inbox: submissions with submitter info + queue context â”€â”€â”€â”€â”€
function AdminInbox() {
  const rows = [
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'2847 Newport Blvd · Costa Mesa', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$127,935', age:'2h 14m', tone:'crimson', id:'V-2026-0418', flag:'Co-broker split'},
    {type:'Listing', icon:<Icons.Listing size={14}/>, prop:'1250 E Alton Ave · Santa Ana', agent:'Marcus Reeves', agentTitle:'Principal', avatar:'MR', amt:'—', age:'4h 02m', tone:'slate', id:'L-2026-0412', flag:null},
    {type:'Sign', icon:<Icons.Sign size={14}/>, prop:'3400 Bristol St · Costa Mesa', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$705', age:'6h 38m', tone:'neutral', id:'S-2026-0410', flag:null},
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'875 W 17th St · Costa Mesa', agent:'Sam Park', agentTitle:'Associate', avatar:'SP', amt:'$58,200', age:'1d', tone:'crimson', id:'V-2026-0404', flag:'Missing W-9'},
    {type:'Contract', icon:<Icons.Contract size={14}/>, prop:'512 Superior Ave · Newport', agent:'Marcus Reeves', agentTitle:'Principal', avatar:'MR', amt:'—', age:'1d 2h', tone:'ai', id:'C-2026-0401', flag:'4 redlines'},
    {type:'Listing Mod', icon:<Icons.Listing size={14}/>, prop:'2100 Placentia Ave · Costa Mesa', agent:'Kai Nguyen', agentTitle:'Associate', avatar:'KN', amt:'—', age:'2d', tone:'slate', id:'L-2026-0395', flag:null},
    {type:'Voucher', icon:<Icons.Voucher size={14}/>, prop:'6400 W Coast Hwy · Newport', agent:'Taylor Barnes', agentTitle:'Senior Associate', avatar:'TB', amt:'$41,300', age:'3d', tone:'crimson', id:'V-2026-0388', flag:null},
  ];
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems:'start' }}>
      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        {/* Sub-tabs */}
        <div style={{ display:'flex', gap: 4, borderBottom: '1px solid var(--ink-200)', padding: '0 4px' }}>
          {['Pending · 7','In review · 2','Approved · 142','Rejected · 3','All'].map((t,i) => (
            <button key={i} style={{
              padding: '9px 14px', background:'transparent', border:'none', cursor:'pointer',
              fontSize: 12.5, fontWeight: i===0 ? 700 : 500,
              color: i===0 ? 'var(--ink-900)' : 'var(--ink-500)',
              borderBottom: i===0 ? '2px solid var(--ink-900)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t}</button>
          ))}
          <div style={{ flex: 1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding: '0 4px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, width: 220, height: 32, padding:'0 10px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
              <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
              <input placeholder="Search submitter, propertyâ€¦" style={{ flex:1, border:'none', outline:'none', fontSize: 12, background:'transparent' }}/>
            </div>
            <Button variant="secondary" size="sm" icon={<Icons.Filter size={13}/>}>Filter</Button>
          </div>
        </div>

        {/* Column header */}
        <Card padding={0}>
          <div style={{
            display:'grid', gridTemplateColumns: '36px 110px 1.3fr 1.2fr 110px 110px 90px 200px',
            padding: '10px 20px', gap: 12, alignItems:'center',
            background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)',
            fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
            <div>Type</div>
            <div>Property / ID</div>
            <div>Submitted by</div>
            <div style={{ textAlign:'right' }}>Amount</div>
            <div>Submitted</div>
            <div>Status</div>
            <div style={{ textAlign:'right' }}>Actions</div>
          </div>

          {rows.map((r,i) => (
            <div key={i} style={{
              display:'grid', gridTemplateColumns: '36px 110px 1.3fr 1.2fr 110px 110px 90px 200px',
              padding: '14px 20px', alignItems:'center', gap: 12,
              borderTop: i>0 ? '1px solid var(--ink-150)' : 'none',
              cursor: 'pointer',
            }}>
              <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
              <Badge tone={r.tone} size="sm" icon={r.icon}>{r.type}</Badge>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.prop}</div>
                <div style={{ display:'flex', gap: 8, marginTop: 2, alignItems:'center' }}>
                  <span className="lee-mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>{r.id}</span>
                  {r.flag && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--warn-100)', color: 'var(--warn-600)', fontWeight: 600 }}>âš  {r.flag}</span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink-900)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{r.avatar}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.agent}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>{r.agentTitle}</div>
                </div>
              </div>
              <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600, textAlign:'right' }}>{r.amt}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{r.age} ago</div>
              <div><Badge tone="warn" size="sm">Pending</Badge></div>
              <div style={{ display:'flex', gap: 6, justifyContent:'flex-end' }}>
                <Button variant="secondary" size="sm">Review</Button>
                <Button variant="primary" size="sm" icon={<Icons.Check size={13}/>}>Approve</Button>
              </div>
            </div>
          ))}

          {/* Bulk actions bar */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--ink-200)', background: 'var(--ink-50)', display:'flex', alignItems:'center', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-500)' }}>7 items · bulk actions:</span>
            <Button variant="ghost" size="sm" icon={<Icons.Check size={12}/>}>Approve all</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Send size={12}/>}>Push to Dealius</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Download size={12}/>}>Export CSV</Button>
          </div>
        </Card>
      </div>

      {/* Right rail */}
      <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'sticky', top: 24 }}>
        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 10 }}>This week · Newport Beach office</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>14</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Vouchers processed</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>$1.47M</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Commission closed</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>3.2h</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Avg turnaround</div>
            </div>
            <div>
              <div className="lee-mono" style={{ fontSize: 22, fontWeight: 700 }}>98%</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>First-pass accept</div>
            </div>
          </div>
        </Card>

        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
            <div className="lee-eyebrow">Queue load by type</div>
          </div>
          {[
            {label:'Vouchers', n: 3, max: 7, tone:'var(--lee-crimson)'},
            {label:'Listings', n: 2, max: 7, tone:'var(--ink-900)'},
            {label:'Sign orders', n: 1, max: 7, tone:'var(--ink-500)'},
            {label:'Contracts', n: 1, max: 7, tone:'var(--ai-500)'},
          ].map((q,i) => (
            <div key={i} style={{ marginTop: i===0 ? 0 : 10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--ink-700)', fontWeight: 500 }}>{q.label}</span>
                <span className="lee-mono" style={{ color: 'var(--ink-500)' }}>{q.n}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow:'hidden' }}>
                <div style={{ width: `${(q.n/q.max)*100}%`, height:'100%', background: q.tone, borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </Card>

        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <Icons.Sparkles size={13} style={{ color:'var(--ai-500)' }}/>
            <div className="lee-eyebrow" style={{ margin: 0 }}>Deal Assist flags</div>
          </div>
          {[
            'V-2026-0404 missing W-9 from co-broker',
            'C-2026-0401 has 4 non-standard redlines',
            'V-2026-0418 split doesn\'t match listing agmt',
          ].map((m,i) => (
            <div key={i} style={{ display:'flex', gap: 8, padding: '8px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none', fontSize: 12, color: 'var(--ink-700)' }}>
              <span style={{ color: 'var(--warn-500)' }}>âš </span>
              {m}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// â”€â”€ Dealius push: quick-input for listings and deals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AdminDealius() {
  const [mode, setMode] = React.useState('listing');
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns:'1fr 360px', gap: 24, alignItems:'start' }}>
      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        <Card>
          <SectionHeader
            eyebrow="Dealius sync"
            title="Push to Dealius"
            description="Enter or confirm listing and deal data, then push to Dealius for CRM, pipeline and commission tracking."
          />
          <div style={{ marginBottom: 18 }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                {value:'listing', label:'Listing input'},
                {value:'deal', label:'Deal input'},
              ]}
            />
          </div>

          {mode === 'listing' ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
              <Field label="Property address" required span={2}><Input defaultValue="2847 Newport Blvd, Costa Mesa, CA 92627"/></Field>
              <Field label="Listing type" required><Select value="Exclusive" onChange={()=>{}} options={['Exclusive Right to Sell','Exclusive Right to Lease','Sublease','Open Listing']}/></Field>
              <Field label="Property type" required><Select value="Industrial" onChange={()=>{}} options={['Office','Industrial','Retail','Flex','Land','Multifamily']}/></Field>
              <Field label="SF" required><Input suffix="SF" defaultValue="24,500"/></Field>
              <Field label="Asking rate"><Input prefix="$" suffix="/SF/YR NNN" defaultValue="1.95"/></Field>
              <Field label="Listing start"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Apr 22, 2026"/></Field>
              <Field label="Listing end"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Oct 22, 2026"/></Field>
              <Field label="Lead broker"><Select value="Taylor Barnes" onChange={()=>{}} options={['Taylor Barnes','Marcus Reeves','Sam Park','Kai Nguyen']}/></Field>
              <Field label="Co-broker"><Input placeholder="Optional"/></Field>
              <Field label="Commission %"><Input suffix="%" defaultValue="6.00"/></Field>
              <Field label="MLS"><Select value="AIR CRE" onChange={()=>{}} options={['AIR CRE','CoStar','LoopNet','CREXi']}/></Field>
              <Field label="Dealius pipeline stage" span={2}>
                <Select value="Prospect → Active" onChange={()=>{}} options={['Prospect','Active','Under contract','Closed']}/>
              </Field>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
              <Field label="Deal type" required><Select value="Lease" onChange={()=>{}} options={['Lease','Sale','Sublease','Renewal','Expansion']}/></Field>
              <Field label="Our side" required><Select value="Listing" onChange={()=>{}} options={['Listing','Tenant rep','Buyer rep','Both sides']}/></Field>
              <Field label="Property" required span={2}><Input defaultValue="2847 Newport Blvd, Costa Mesa, CA 92627"/></Field>
              <Field label="Tenant / Buyer"><Input defaultValue="Pacific Coast Distribution LLC"/></Field>
              <Field label="Landlord / Seller"><Input defaultValue="Pacific Holdings LLC"/></Field>
              <Field label="Close / Lease comm. date"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="May 15, 2026"/></Field>
              <Field label="Consideration"><Input prefix="$" defaultValue="4,312,500"/></Field>
              <Field label="Gross commission"><Input prefix="$" defaultValue="258,750"/></Field>
              <Field label="Lee side share"><Input suffix="%" defaultValue="50"/></Field>
              <Field label="Lead broker"><Select value="Taylor Barnes" onChange={()=>{}} options={['Taylor Barnes','Marcus Reeves','Sam Park','Kai Nguyen']}/></Field>
              <Field label="Dealius deal ID"><Input className="lee-mono" defaultValue="D-2026-01872"/></Field>
            </div>
          )}

          <div style={{ marginTop: 20, padding: 14, background:'var(--ai-100)', border: '1px solid rgba(110,63,217,.2)', borderRadius: 10, display:'flex', alignItems:'center', gap: 12 }}>
            <Icons.Sparkles size={18} style={{ color: 'var(--ai-500)' }}/>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-700)' }}>
              <b>Deal Assist</b> pre-filled {mode === 'listing' ? '9' : '7'} fields from the submitted voucher and attached listing agreement.
            </div>
            <Button variant="ghost" size="sm">Review sources</Button>
          </div>

          <div style={{ marginTop: 20, display:'flex', gap: 10, justifyContent:'flex-end', paddingTop: 16, borderTop: '1px solid var(--ink-150)' }}>
            <Button variant="secondary">Save draft</Button>
            <Button variant="secondary" icon={<Icons.Download size={14}/>}>Export</Button>
            <Button variant="primary" icon={<Icons.Send size={14}/>}>Push to Dealius</Button>
          </div>
        </Card>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'sticky', top: 24 }}>
        <Card padding={20}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background:'var(--ok-500)' }}/>
            <div className="lee-eyebrow" style={{ margin: 0 }}>Dealius · Connected</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>
            Last sync 3 min ago · OAuth valid through Jul 2026
          </div>
          <div style={{ marginTop: 12, display:'flex', gap: 8 }}>
            <Button variant="ghost" size="sm">Open Dealius →</Button>
            <Button variant="ghost" size="sm">Re-auth</Button>
          </div>
        </Card>

        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Recent pushes</div>
          {[
            {id:'L-2026-0412', label:'1250 E Alton Ave', when:'12m ago', ok:true},
            {id:'D-2026-01868', label:'Deal · 875 W 17th St', when:'1h ago', ok:true},
            {id:'L-2026-0409', label:'512 Superior Ave', when:'3h ago', ok:false, err:'Missing SF'},
            {id:'D-2026-01864', label:'Deal · 6400 W Coast Hwy', when:'yesterday', ok:true},
          ].map((p,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: p.ok ? 'var(--ok-500)' : 'var(--err-600)' }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }} className="lee-mono">{p.id}{p.err ? ` · ${p.err}` : ''}</div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>{p.when}</div>
            </div>
          ))}
        </Card>

        <Card padding={20}>
          <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Field mapping</div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.6 }}>
            Lee fields mapped to Dealius objects:
          </div>
          <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 6, fontSize: 11.5 }}>
            {[
              ['Voucher → Commission record', 12],
              ['Listing → Property + Listing', 18],
              ['Contract → Document', 6],
            ].map(([k,n],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding: '4px 0' }}>
                <span style={{ color:'var(--ink-700)' }}>{k}</span>
                <span className="lee-mono" style={{ color:'var(--ink-500)' }}>{n} fields</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" style={{ marginTop: 10 }}>Edit mapping →</Button>
        </Card>
      </div>
    </div>
  );
}

// â”€â”€ Agent roster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AdminRoster() {
  const roster = [
    {name:'Taylor Barnes', avatar:'TB', title:'Senior Associate', email:'tbarnes@lee-nb.com', phone:'(949) 556-0118', license:'DRE #01984412', team:'Industrial', ytd:'$287K', deals:9, status:'Active', joined:'Feb 2021'},
    {name:'Marcus Reeves', avatar:'MR', title:'Principal', email:'mreeves@lee-nb.com', phone:'(949) 556-0102', license:'DRE #01456780', team:'Office', ytd:'$412K', deals:6, status:'Active', joined:'May 2015'},
    {name:'Sam Park', avatar:'SP', title:'Associate', email:'spark@lee-nb.com', phone:'(949) 556-0124', license:'DRE #02123498', team:'Retail', ytd:'$128K', deals:4, status:'Active', joined:'Aug 2023'},
    {name:'Kai Nguyen', avatar:'KN', title:'Associate', email:'knguyen@lee-nb.com', phone:'(949) 556-0131', license:'DRE #02201765', team:'Industrial', ytd:'$64K', deals:3, status:'Active', joined:'Jan 2024'},
    {name:'Diana Cho', avatar:'DC', title:'Principal', email:'dcho@lee-nb.com', phone:'(949) 556-0109', license:'DRE #01312558', team:'Capital Markets', ytd:'$598K', deals:4, status:'Active', joined:'Oct 2012'},
    {name:'Reggie Alvarez', avatar:'RA', title:'Senior Associate', email:'ralvarez@lee-nb.com', phone:'(949) 556-0115', license:'DRE #01876321', team:'Office', ytd:'$201K', deals:7, status:'Active', joined:'Jun 2018'},
    {name:'Priya Shah', avatar:'PS', title:'Associate', email:'pshah@lee-nb.com', phone:'(949) 556-0128', license:'DRE #02098412', team:'Retail', ytd:'$92K', deals:5, status:'Active', joined:'Mar 2022'},
    {name:'Joel Martinez', avatar:'JM', title:'Associate', email:'jmartinez@lee-nb.com', phone:'(949) 556-0133', license:'DRE #02245009', team:'Industrial', ytd:'$45K', deals:2, status:'Onboarding', joined:'Mar 2026'},
  ];
  return (
    <div style={{ padding: 32, display:'flex', flexDirection:'column', gap: 16 }}>
      {/* Roster stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 12 }}>
        <StatCard label="Total agents" value="24" unit=""/>
        <StatCard label="Active" value="22" unit=""/>
        <StatCard label="Onboarding" value="2" unit=""/>
        <StatCard label="YTD production" value="$4.2M" unit=""/>
        <StatCard label="Avg deals / agent" value="8.4" unit=""/>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 20px', display:'flex', alignItems:'center', gap: 12, borderBottom: '1px solid var(--ink-150)' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Roster</div>
          <Badge size="sm">{roster.length} shown · 24 total</Badge>
          <div style={{ flex: 1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap:6, width: 260, height: 32, padding:'0 10px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
            <input placeholder="Search name, license, teamâ€¦" style={{ flex:1, border:'none', outline:'none', fontSize: 12, background:'transparent' }}/>
          </div>
          <Select value="All teams" onChange={()=>{}} options={['All teams','Industrial','Office','Retail','Capital Markets']}/>
          <Button variant="secondary" size="sm" icon={<Icons.Download size={13}/>}>Export</Button>
          <Button variant="primary" size="sm" icon={<Icons.Plus size={13}/>}>Add agent</Button>
        </div>

        {/* Column header */}
        <div style={{
          display:'grid', gridTemplateColumns: '2fr 1.1fr 1.4fr 1fr 0.9fr 0.9fr 0.9fr 120px',
          padding: '10px 20px', gap: 12, alignItems:'center',
          background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)',
          fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <div>Agent</div>
          <div>Title</div>
          <div>Contact</div>
          <div>License</div>
          <div>Team</div>
          <div style={{ textAlign:'right' }}>YTD GCI</div>
          <div style={{ textAlign:'right' }}>Deals</div>
          <div style={{ textAlign:'right' }}>Status</div>
        </div>

        {roster.map((a,i) => (
          <div key={i} style={{
            display:'grid', gridTemplateColumns: '2fr 1.1fr 1.4fr 1fr 0.9fr 0.9fr 0.9fr 120px',
            padding: '14px 20px', alignItems:'center', gap: 12,
            borderTop: i>0 ? '1px solid var(--ink-150)' : 'none',
            cursor: 'pointer',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--ink-900)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{a.avatar}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>Joined {a.joined}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>{a.title}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-700)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.email}</div>
              <div className="lee-mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>{a.phone}</div>
            </div>
            <div className="lee-mono" style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{a.license}</div>
            <div><Badge size="sm" tone={a.team === 'Industrial' ? 'slate' : a.team === 'Office' ? 'neutral' : a.team === 'Retail' ? 'warn' : 'ai'}>{a.team}</Badge></div>
            <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600, textAlign:'right' }}>{a.ytd}</div>
            <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600, textAlign:'right' }}>{a.deals}</div>
            <div style={{ textAlign:'right' }}><Badge size="sm" tone={a.status === 'Active' ? 'success' : 'warn'}>{a.status}</Badge></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// â”€â”€ Office ops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AdminOps() {
  return (
    <div style={{ padding: 32, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Commission payouts · this week</div>
        {[
          {agent:'Taylor Barnes', amt:'$63,968', status:'Scheduled Fri'},
          {agent:'Marcus Reeves', amt:'$98,441', status:'Awaiting wire'},
          {agent:'Sam Park', amt:'$29,100', status:'Paid'},
          {agent:'Diana Cho', amt:'$152,890', status:'Paid'},
        ].map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.agent}</div>
            <div className="lee-mono" style={{ fontSize: 13, fontWeight: 600 }}>{p.amt}</div>
            <Badge size="sm" tone={p.status === 'Paid' ? 'success' : p.status === 'Scheduled Fri' ? 'neutral' : 'warn'}>{p.status}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Compliance & renewals</div>
        {[
          {who:'Joel Martinez', what:'DRE license expires', when:'34 days', tone:'warn'},
          {who:'Priya Shah', what:'E&O insurance renewal', when:'62 days', tone:'neutral'},
          {who:'Reggie Alvarez', what:'Continuing ed hours', when:'2 of 45h done', tone:'warn'},
          {who:'Office', what:'MLS dues · AIR CRE', when:'Paid Apr 10', tone:'success'},
        ].map((r,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.who}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{r.what}</div>
            </div>
            <Badge size="sm" tone={r.tone}>{r.when}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>MLS & data feeds</div>
        {[
          {label:'AIR CRE · listings feed', status:'Syncing', tone:'success', sub:'Last: 3 min ago'},
          {label:'CoStar · comps pull', status:'Syncing', tone:'success', sub:'Last: 12 min ago'},
          {label:'Dealius · deals', status:'Connected', tone:'success', sub:'OAuth valid'},
          {label:'CREXi · listings', status:'Error', tone:'danger', sub:'Reauth required'},
        ].map((f,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{f.sub}</div>
            </div>
            <Badge size="sm" tone={f.tone}>{f.status}</Badge>
          </div>
        ))}
      </Card>

      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 14 }}>Open tasks</div>
        {[
          'Review voucher V-2026-0404 · missing W-9',
          'Push 3 approved listings to Dealius',
          'Confirm Joel Martinez DRE renewal',
          'Reconcile April commission ledger',
          'Approve sign vendor invoice · $2,140',
        ].map((t,i) => (
          <label key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding: '8px 0', borderTop: i>0 ? '1px solid var(--ink-150)' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor:'var(--lee-crimson)' }}/>
            <span style={{ fontSize: 12.5, color: 'var(--ink-700)' }}>{t}</span>
          </label>
        ))}
      </Card>
    </div>
  );
}

// â”€â”€ Contract intake â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FunctionalContractScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"upload" | "fill">("upload");
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState("Exclusive Right - Owner Lease");
  const [uploadedContract, setUploadedContract] = useState<{ url: string; fileKey: string; filename: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [contractData, setContractData] = useState<ContractData>({
    contractType: "Exclusive Right - Owner Lease",
    party1Name: "Pacific Holdings LLC",
    agentName: user?.name ?? "Taylor Barnes",
    agentEmail: user?.email ?? "",
    propAddress: "2847 Newport Blvd",
    propCity: "Costa Mesa",
    propState: "CA",
    propZip: "92627",
    termStart: "2026-04-22",
    termEnd: "2026-10-22",
    commAmount: "6.00%",
    arbitration: "AAA",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const contractGroups = [
    { name: 'Listing Agreements', items: [
      'Exclusive Right to Sell',
      'Exclusive Right to Lease',
      'Exclusive Right - Sublease',
      'Limited Listing Agreement',
      'Open Listing Agreement',
      'Listing Modification / Extension',
    ]},
    { name: 'Representation', items: [
      'Exclusive Right - Buyer/Lessee',
      'Exclusive Right - Owner Sale',
      'Exclusive Right - Owner Lease',
      'Non-Exclusive Buyer Rep',
    ]},
    { name: 'Commission Agreements', items: [
      'Commission Agreement - Lease',
      'Commission Agreement - Sale',
      'Co-Broker Commission Agreement',
      'Referral Agreement',
    ]},
    { name: 'Lease Documents', items: [
      'AIR CRE Standard Industrial / Commercial',
      'AIR CRE Multi-Tenant Industrial',
      'AIR CRE Office Lease',
      'AIR CRE Retail Lease',
      'Lease Addendum',
      'Sublease Agreement',
      'Consent to Sublease',
      'Amendment to Lease',
      'Estoppel Certificate',
      'SNDA',
      'Notice to Vacate',
      'Early Termination',
    ]},
    { name: 'Purchase & Sale', items: [
      'AIR CRE Standard Purchase Agreement',
      'Letter of Intent - Purchase',
      'Counter Offer',
      'PSA Addendum',
      'Assignment of Purchase Agreement',
    ]},
    { name: 'Disclosures', items: [
      'Agency Disclosure (CAR)',
      'Agency Confirmation',
      'Natural Hazard Disclosure',
      'Commercial Property Disclosure',
      'Lead-Based Paint Disclosure',
      'Environmental / CERCLA',
      'SB-800 Disclosure',
      'Wire Fraud Advisory',
      'Arbitration Advisory',
    ]},
  ];

  const filteredGroups = contractGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.toLowerCase().includes(search.toLowerCase().trim())),
    }))
    .filter((group) => group.items.length);

  useEffect(() => {
    setContractData((current) => ({ ...current, contractType: selectedContract }));
  }, [selectedContract]);

  useEffect(() => {
    setContractData((current) => ({
      ...current,
      agentName: current.agentName || user?.name || "",
      agentEmail: current.agentEmail || user?.email || "",
    }));
  }, [user?.email, user?.name]);

  const uploadMutation = trpc.files.upload.useMutation();
  const extractMutation = trpc.contracts.extractContract.useMutation();
  const submitMutation = trpc.contracts.submitContractToAdmin.useMutation();
  const isExtracting = uploadMutation.isPending || extractMutation.isPending;

  const setContractField = (field: Exclude<keyof ContractData, "redlines">, value: string) => {
    setContractData((current) => ({ ...current, [field]: value }));
  };

  const processContractFile = async (file: File) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Upload a PDF contract.");
      return;
    }

    try {
      const base64Data = await readFileAsBase64(file);
      const uploaded = await uploadMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
        category: "contract",
        reference: selectedContract,
        uploaderName: user?.name ?? undefined,
      });
      setUploadedContract({ url: uploaded.url, fileKey: uploaded.fileKey, filename: uploaded.filename });

      const extracted = await extractMutation.mutateAsync({
        pdfUrl: uploaded.url,
        contractType: selectedContract,
      });

      if (extracted.success && extracted.data) {
        setContractData((current) => ({
          ...current,
          ...(extracted.data as Partial<ContractData>),
          contractType: selectedContract,
        }));
        setMode("fill");
        toast.success("Contract fields extracted.");
      } else {
        toast.error(extracted.error || "Contract uploaded, but extraction failed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process contract.");
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await processContractFile(file);
  };

  const handleSubmitContract = async () => {
    try {
      const result = await submitMutation.mutateAsync({
        contractData,
        brokerName: user?.name ?? contractData.agentName,
        senderEmail: user?.email ?? contractData.agentEmail,
        notes: notes.trim() || undefined,
      });

      if (result.success) toast.success("Contract sent to admin.");
      else toast.error(result.error || "Contract submission failed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Contract submission failed.");
    }
  };

  const redlines = contractData.redlines ?? [];

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={handleFileChange}/>
      <PageHeader
        eyebrow="AIR CRE"
        title="Contract Intake"
        description="Prepare AIR CRE forms, extract signed PDFs, and send clean data sheets to admin."
        right={<Button variant="primary" size="sm" icon={<Icons.Arrow size={14}/>} onClick={handleSubmitContract} disabled={submitMutation.isPending}>{submitMutation.isPending ? "Sending..." : "Submit to admin"}</Button>}
      />
      <div style={{ padding: 32, display:'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems:'start' }}>
        <Card padding={16} style={{ maxHeight: 780, overflow: 'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 12, padding: '6px 10px', background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={13} style={{ color: 'var(--ink-400)' }}/>
            <input
              placeholder="Search agreements..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }}
            />
          </div>
          {filteredGroups.map((group) => (
            <div key={group.name} style={{ marginBottom: 14 }}>
              <div className="lee-eyebrow" style={{ marginBottom: 4, padding: '0 8px', display:'flex', justifyContent:'space-between', alignItems: 'center' }}>
                <span>{group.name}</span>
                <span style={{ color: 'var(--ink-400)', fontWeight: 500 }}>{group.items.length}</span>
              </div>
              {group.items.map((item) => {
                const active = item === selectedContract;
                return (
                  <button key={item} onClick={() => setSelectedContract(item)} style={{
                    display:'block', width: '100%', textAlign:'left',
                    padding: '8px 10px', marginBottom: 2,
                    background: active ? 'var(--lee-crimson-wash)' : 'transparent',
                    border: 'none', borderRadius: 6,
                    fontSize: 12.5, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-700)',
                    cursor: 'pointer', lineHeight: 1.35,
                  }}>{item}</button>
                );
              })}
            </div>
          ))}
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <Card>
            <SectionHeader eyebrow="Selected" title={selectedContract} description="Upload a signed PDF to extract fields, or fill the data sheet directly."/>
            <div style={{ display:'flex', gap: 8, marginBottom: 20 }}>
              <Segmented options={[{value:'upload',label:'Upload signed PDF'},{value:'fill',label:'Fill out here'}]} value={mode} onChange={(value: "upload" | "fill") => setMode(value)}/>
            </div>

            {mode === 'upload' ? (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) void processContractFile(file);
                }}
                style={{
                  border: '2px dashed var(--ink-300)', borderRadius: 12,
                  padding: 40, textAlign:'center',
                  background: 'linear-gradient(180deg, #FBF8FE 0%, var(--ink-0) 100%)',
                }}
              >
                <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 14, background: 'var(--ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow: '0 8px 22px rgba(139,95,240,.35)' }}>
                  <Icons.Upload size={26}/>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Drop signed contract PDF</div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, maxWidth: 420, margin:'4px auto 16px' }}>
                  Deal Assist extracts parties, dates, commission, and redlines from the PDF.
                </div>
                <Button variant="ai" icon={<Icons.Upload size={14}/>} onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>
                  {isExtracting ? "Processing..." : "Choose PDF"}
                </Button>
                {uploadedContract && (
                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-600)' }}>
                    Uploaded: <button onClick={() => window.open(uploadedContract.url, "_blank", "noopener")} style={{ border: 'none', background: 'transparent', color: 'var(--lee-crimson)', cursor: 'pointer', fontWeight: 600 }}>{uploadedContract.filename}</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
                <Field label="Owner / client name" required><Input value={contractData.party1Name ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("party1Name", event.target.value)}/></Field>
                <Field label="Broker of record" required><Input value={contractData.agentName ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("agentName", event.target.value)}/></Field>
                <Field label="Broker email"><Input value={contractData.agentEmail ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("agentEmail", event.target.value)}/></Field>
                <Field label="Commission"><Input value={contractData.commAmount ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("commAmount", event.target.value)}/></Field>
                <Field label="Property address" required span={2}><Input value={contractData.propAddress ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("propAddress", event.target.value)}/></Field>
                <Field label="City"><Input value={contractData.propCity ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("propCity", event.target.value)}/></Field>
                <Field label="State"><Input value={contractData.propState ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("propState", event.target.value)}/></Field>
                <Field label="Zip"><Input value={contractData.propZip ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("propZip", event.target.value)}/></Field>
                <Field label="Arbitration"><Select value={contractData.arbitration ?? "AAA"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setContractField("arbitration", event.target.value)} options={['AAA','JAMS','Judicial reference','None']}/></Field>
                <Field label="Listing start"><Input type="date" prefix={<Icons.Calendar size={14}/>} value={contractData.termStart ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("termStart", event.target.value)}/></Field>
                <Field label="Listing end"><Input type="date" prefix={<Icons.Calendar size={14}/>} value={contractData.termEnd ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setContractField("termEnd", event.target.value)}/></Field>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader eyebrow="Admin packet" title="Review and submit" description="Notes and extracted redlines are included with the admin data sheet."/>
            <div style={{ display: 'grid', gridTemplateColumns: redlines.length ? '1fr 1fr' : '1fr', gap: 16 }}>
              <div>
                <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Anything admin should know before entering this in AIR CRE..."
                  style={{ width: '100%', minHeight: 118, resize: 'vertical', border: '1px solid var(--ink-200)', borderRadius: 8, padding: 12, fontSize: 13, outline: 'none' }}
                />
              </div>
              {redlines.length > 0 && (
                <div>
                  <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Redlines</div>
                  <div style={{ border: '1px solid var(--ink-200)', borderRadius: 8, overflow: 'hidden' }}>
                    {redlines.map((redline, index) => (
                      <div key={`${redline.paragraph}-${index}`} style={{ padding: 10, borderTop: index > 0 ? '1px solid var(--ink-150)' : 'none', fontSize: 12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap: 8 }}>
                          <strong>Para {redline.paragraph || "-"}</strong>
                          <Badge size="sm" tone={redline.type === "added" ? "success" : "warn"}>{redline.type}</Badge>
                        </div>
                        <div style={{ color: 'var(--ink-600)', marginTop: 4 }}>{redline.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, display:'flex', justifyContent:'flex-end', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setMode("fill")}>Review fields</Button>
              <Button variant="primary" size="sm" icon={<Icons.Arrow size={14}/>} onClick={handleSubmitContract} disabled={submitMutation.isPending}>{submitMutation.isPending ? "Sending..." : "Submit to admin"}</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ContractScreen() {
  return <FunctionalContractScreen />;
}

// â”€â”€ Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FunctionalDocsScreen() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const docsQuery = trpc.files.list.useQuery({ limit: 200 });
  const uploadMutation = trpc.files.upload.useMutation({
    onSuccess: async () => {
      toast.success("Document uploaded.");
      await utils.files.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const allDocs = useMemo(() => (docsQuery.data ?? []) as UploadedFileRecord[], [docsQuery.data]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of allDocs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return counts;
  }, [allDocs]);

  const filteredDocs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allDocs.filter((doc) => {
      if (activeCategory && doc.category !== activeCategory) return false;
      if (!normalizedQuery) return true;
      return [
        doc.filename,
        doc.reference,
        doc.category,
        doc.uploaderName,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
    });
  }, [activeCategory, allDocs, query]);

  const activeCategoryInfo = DOC_CATEGORIES.find((item) => item.category === activeCategory);
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const base64Data = await readFileAsBase64(file);
      await uploadMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data,
        category: activeCategory ?? "other",
        reference: activeCategoryInfo?.name ?? "Document Library",
        uploaderName: user?.name ?? undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload document.");
    }
  };

  const openDoc = async (doc: UploadedFileRecord) => {
    try {
      const freshUrl = await utils.client.files.getUrl.query({ fileKey: doc.fileKey });
      window.open(freshUrl.url, "_blank", "noopener");
    } catch (error) {
      if (doc.url) {
        window.open(doc.url, "_blank", "noopener");
        return;
      }
      toast.error(error instanceof Error ? error.message : "No download URL is available for this file.");
    }
  };

  return (
    <div>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
        style={{ display: "none" }}
        onChange={handleUpload}
      />
      <PageHeader
        eyebrow="Resources"
        title="Document Library"
        description="Downloadable AIR CRE forms, Lee & Associates templates, and office standards."
        right={<>
          <div style={{ display:'flex', alignItems:'center', gap:8, width: 280, height: 36, padding:'0 12px', background:'var(--ink-0)', border:'1px solid var(--ink-200)', borderRadius: 6 }}>
            <Icons.Search size={14} style={{ color: 'var(--ink-400)' }}/>
            <input
              placeholder={`Search ${allDocs.length} documents...`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ flex:1, border:'none', outline:'none', fontSize: 13, background:'transparent' }}
            />
          </div>
          <Button variant="secondary" size="sm" icon={<Icons.Upload size={14}/>} onClick={() => uploadInputRef.current?.click()} disabled={uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </>}
      />
      <div style={{ padding: 32, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16 }}>
        <Card hoverable padding={20} style={{ cursor:'pointer', borderColor: activeCategory ? undefined : 'var(--lee-crimson)' }} onClick={() => setActiveCategory(undefined)}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-600)' }}>
              <Icons.Docs size={20}/>
            </div>
            <Badge tone={!activeCategory ? "crimson" : "neutral"} size="sm">{allDocs.length} files</Badge>
          </div>
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>All documents</div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>Showing every uploaded file</div>
        </Card>
        {DOC_CATEGORIES.map((folder) => {
          const active = activeCategory === folder.category;
          const count = categoryCounts.get(folder.category) ?? 0;
          return (
            <Card key={folder.category} hoverable padding={20} style={{ cursor:'pointer', borderColor: active ? 'var(--lee-crimson)' : undefined }} onClick={() => setActiveCategory(folder.category)}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-600)' }}>
                  <Icons.Docs size={20}/>
                </div>
                <Badge tone={folder.tone} size="sm">{count} files</Badge>
              </div>
              <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>{folder.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>{active ? "Filtered" : "Click to filter"}</div>
            </Card>
          );
        })}
      </div>
      <div style={{ padding: '0 32px 32px' }}>
        <Card padding={0}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink-150)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{activeCategoryInfo?.name ?? "Recently used"}</div>
            <Button variant="ghost" size="sm" onClick={() => setActiveCategory(undefined)}>See all</Button>
          </div>
          {docsQuery.isLoading && <div style={{ padding: 20 }}>Loading documents...</div>}
          {docsQuery.isError && <div style={{ padding: 20, color: 'var(--err-600)' }}>{docsQuery.error.message}</div>}
          {!docsQuery.isLoading && !filteredDocs.length && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>
              No documents found.
            </div>
          )}
          {filteredDocs.map((doc, index) => {
            const category = DOC_CATEGORIES.find((item) => item.category === doc.category);
            return (
              <div key={doc.fileKey} style={{ display:'grid', gridTemplateColumns:'24px 1fr 140px 90px 100px 80px', padding: '12px 20px', alignItems:'center', gap: 12, borderTop: index > 0 ? '1px solid var(--ink-150)':'none' }}>
                <Icons.Docs size={16} style={{color:'var(--ink-500)'}}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.reference ?? doc.uploaderName ?? "Document Library"}</div>
                </div>
                <Badge size="sm" tone={category?.tone ?? "neutral"}>{category?.name ?? doc.category}</Badge>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{formatFileSize(doc.fileSize)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{formatShortDate(doc.createdAt ?? doc.uploadedAt)}</div>
                <div style={{ display:'flex', gap: 4, justifyContent:'flex-end' }}>
                  <button onClick={() => void openDoc(doc)} title="Download" style={{ padding: 6, background:'transparent', border:'none', color:'var(--ink-600)', cursor:'pointer' }}><Icons.Download size={14}/></button>
                  <button onClick={() => void openDoc(doc)} title="Open" style={{ padding: 6, background:'transparent', border:'none', color:'var(--ink-600)', cursor:'pointer' }}><Icons.External size={14}/></button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

export function DocsScreen() {
  return <FunctionalDocsScreen />;
}

