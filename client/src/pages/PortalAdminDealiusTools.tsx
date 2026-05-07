import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileUp, Send, Trash2 } from "lucide-react";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Badge, Button, Field, Input, Select } from "../design/index.jsx";

type EntryMode = "deal" | "listing";
type RentRow = { months: number | string; monthly: number | string; free: boolean };
type ListingSpaceRow = { suite: string; sqft: number | string; askingRate?: number | string; availableDate?: string; comments?: string };
type BrokerRow = { name: string; side?: string; pct: number | string; lead?: boolean };

type DealiusEntry = {
  entryMode: EntryMode;
  dealName: string;
  listingName: string;
  repTypeID: string;
  transactionType: string;
  listingTransaction: string;
  address: string;
  city: string;
  zip: string;
  suite: string;
  propertyType: string;
  sqft: number | string;
  totalBldgSF: number | string;
  yearBuilt: number | string;
  clientCo: string;
  oppositeCo: string;
  ownerCompany: string;
  startDate: string;
  endDate: string;
  occupancyDate: string;
  term: number | string;
  askingRate: number | string;
  totalConsideration: number | string;
  feePercent: number | string;
  listingStartDate: string;
  listingExpiryDate: string;
  listingAvailableDate: string;
  listingStatus: string;
  listingSource: string;
  listingNotes: string;
  rentRows: RentRow[];
  spaces: ListingSpaceRow[];
  brokers: BrokerRow[];
};

type DocRow = {
  file: File;
  documentType: string;
};

const DOC_TYPES = [
  { label: "Select type", value: "" },
  { label: "Listing Agreement", value: "Listing Agreement" },
  { label: "Lease / Sublease", value: "Lease" },
  { label: "Voucher / Deal Sheet", value: "Voucher" },
  { label: "Agency Disclosure", value: "Agency Disclosure" },
  { label: "LOI", value: "LOI" },
  { label: "Commission Agreement", value: "Commission Agreement" },
  { label: "Purchase Agreement", value: "Purchase Agreement" },
  { label: "Other", value: "Other" },
];

function num(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyEntry(mode: EntryMode): DealiusEntry {
  const today = new Date().toISOString().slice(0, 10);
  return {
    entryMode: mode,
    dealName: "New Deal",
    listingName: "New Listing",
    repTypeID: "4",
    transactionType: "Lease",
    listingTransaction: "lease",
    address: "",
    city: "",
    zip: "",
    suite: "",
    propertyType: "Industrial",
    sqft: "",
    totalBldgSF: "",
    yearBuilt: "",
    clientCo: "",
    oppositeCo: "",
    ownerCompany: "",
    startDate: "",
    endDate: "",
    occupancyDate: "",
    term: "",
    askingRate: "",
    totalConsideration: "",
    feePercent: "",
    listingStartDate: today,
    listingExpiryDate: "",
    listingAvailableDate: "",
    listingStatus: "active",
    listingSource: "Admin tools",
    listingNotes: "",
    rentRows: [],
    spaces: [],
    brokers: [{ name: "", pct: "100", lead: true }],
  };
}

function normalizeBrokers(raw: unknown): BrokerRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ name: "", pct: "100", lead: true }];
  return raw.map((b: Record<string, unknown>, index: number) => ({
    name: String(b?.name ?? ""),
    side: b?.side ? String(b.side) : undefined,
    pct: b?.pct != null && b?.pct !== "" ? String(b.pct) : "",
    lead: Boolean(b?.lead) || index === 0,
  }));
}

function syncListingTransactionFields(entry: DealiusEntry): DealiusEntry {
  if (entry.entryMode !== "listing") return entry;
  const lt = String(entry.listingTransaction || "lease").toLowerCase();
  let transactionType = entry.transactionType;
  if (lt === "sale") transactionType = "Sale";
  else if (lt === "sublease") transactionType = "Sublease";
  else if (lt === "sale or lease") transactionType = "Sale or Lease";
  else transactionType = "Lease";
  return { ...entry, transactionType };
}

function stripPushMetadata(entry: DealiusEntry): Record<string, unknown> {
  const { listingFormImport, excelImport, ...rest } = entry as DealiusEntry & {
    listingFormImport?: unknown;
    excelImport?: unknown;
  };
  return rest as Record<string, unknown>;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function PortalAdminDealiusTools() {
  const [entry, setEntry] = useState<DealiusEntry>(() => emptyEntry("deal"));
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<any>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [docTargetType, setDocTargetType] = useState<"deal" | "listing">("deal");
  const [docTargetId, setDocTargetId] = useState("");
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrapeFileRef = useRef<HTMLInputElement | null>(null);

  const checklist = useMemo(() => {
    const listingSqft = entry.entryMode === "listing" && entry.spaces.some(space => Boolean(num(space.sqft)));
    const rows = [
      { label: "Address", ok: Boolean(entry.address), detail: entry.address || "Missing" },
      { label: "City", ok: Boolean(entry.city), detail: entry.city || "Missing" },
      { label: "Zip", ok: Boolean(entry.zip), detail: entry.zip || "Missing" },
      { label: "Square feet", ok: Boolean(num(entry.sqft)) || listingSqft, detail: entry.sqft ? `${entry.sqft}` : listingSqft ? "From spaces" : "Missing" },
    ];
    if (entry.entryMode === "deal") {
      rows.push({ label: "Fee percent", ok: Boolean(num(entry.feePercent)), detail: entry.feePercent ? `${entry.feePercent}%` : "Missing" });
    }
    return rows;
  }, [entry]);

  const canPush = checklist.every(item => item.ok);
  const dealID = pushResult?.dealID;
  const listingID = pushResult?.listingID;

  function patchEntry(patch: Partial<DealiusEntry>) {
    setEntry(current => ({ ...current, ...patch }));
  }

  async function scrapeFromFile(file: File) {
    setScraping(true);
    setPushError(null);
    try {
      const base64Data = await fileToBase64(file);
      const response = await fetch(`/api/dealius/scrape`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Could not scrape document");

      const nextMode = body?.data?.entryMode === "listing" ? ("listing" as const) : ("deal" as const);
      const patch = (body?.data?.patch ?? {}) as Partial<DealiusEntry> & Record<string, unknown>;
      let next = { ...emptyEntry(nextMode), ...patch, entryMode: nextMode } as DealiusEntry;
      if (patch.repTypeID != null) next.repTypeID = String(patch.repTypeID);
      if (Array.isArray(patch.rentRows)) next.rentRows = patch.rentRows as RentRow[];
      if (Array.isArray(patch.brokers)) next.brokers = normalizeBrokers(patch.brokers);
      if (Array.isArray(patch.spaces)) next.spaces = patch.spaces as ListingSpaceRow[];
      next = syncListingTransactionFields(next);

      setEntry(next);
      setPushResult(null);
      setDocTargetType(nextMode);
      setDocTargetId("");
      const warnings = body?.data?.warnings;
      if (Array.isArray(warnings) && warnings.length) {
        warnings.forEach((w: string) => toast.info(String(w)));
      }
      toast.success(nextMode === "listing" ? "Listing scraped into editor." : "Deal scraped into editor.");
    } catch (error: any) {
      const message = error?.message ?? "Could not scrape document";
      toast.error(message);
      setPushError(message);
    } finally {
      setScraping(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setPushError(null);
    try {
      const response = await fetch(`/api/dealius/push`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryMode: entry.entryMode, entry: stripPushMetadata(entry) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(body?.errors) ? body.errors.join(" ") : body?.error;
        throw new Error(detail || "Push failed");
      }
      setPushResult(body?.data ?? null);
      if (entry.entryMode === "listing" && body?.data?.listingID) {
        setDocTargetType("listing");
        setDocTargetId(String(body.data.listingID));
      } else if (body?.data?.dealID) {
        setDocTargetType("deal");
        setDocTargetId(String(body.data.dealID));
      }
      toast.success(entry.entryMode === "listing" ? "Listing pushed to Dealius." : "Deal pushed to Dealius.");
    } catch (error: any) {
      const message = error?.message ?? "Push failed";
      setPushError(message);
      toast.error(message);
    } finally {
      setPushing(false);
    }
  }

  async function uploadDocuments() {
    if (!docTargetId || docRows.length === 0) return;
    setUploadingDocs(true);
    try {
      const files = await Promise.all(
        docRows.map(async row => ({
          filename: row.file.name,
          mimeType: row.file.type || "application/octet-stream",
          base64Data: await fileToBase64(row.file),
          documentType: row.documentType || null,
        }))
      );
      const response = await fetch(`/api/dealius/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: docTargetType, entityId: docTargetId, files }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 207) throw new Error(body?.error ?? "Document upload failed");
      if (body?.success === false) toast.warning(body?.error ?? "Some documents failed to attach.");
      else toast.success("Documents attached to Dealius.");
      setDocRows([]);
    } catch (error: any) {
      toast.error(error?.message ?? "Document upload failed");
    } finally {
      setUploadingDocs(false);
    }
  }

  return (
    <AdminPortalShell
      section="dealius-tools"
      title="Dealius tools"
      description="Create and push Dealius entries without starting from a submission. Admin-only."
    >
      <div className="dealius-workspace">
        <section className="dealius-flow-panel">
          <div>
            <div className="dealius-flow-kicker">Admin tool</div>
            <div className="dealius-flow-title">Dealius entry workspace</div>
          </div>
          <div className="dealius-flow-steps">
            <div className="complete">
              <span>Compose</span>
              <strong>{entry.entryMode === "listing" ? "Listing" : "Deal"}</strong>
            </div>
            <div className={canPush ? "complete" : ""}>
              <span>Validate</span>
              <strong>{canPush ? "Ready" : "Review"}</strong>
            </div>
            <div className={docTargetId ? "complete" : ""}>
              <span>Attach</span>
              <strong>{docTargetId ? `${docTargetType} ${docTargetId}` : "Optional"}</strong>
            </div>
          </div>
        </section>

        <div className="dealius-toolbar">
          <div className="dealius-toolbar-left">
            <div className="dealius-mode-control" aria-label="Dealius entry mode">
              <button
                type="button"
                className={entry.entryMode === "deal" ? "active" : ""}
                onClick={() => {
                  const next = emptyEntry("deal");
                  setEntry(next);
                  setPushResult(null);
                  setPushError(null);
                  setDocTargetType("deal");
                  setDocTargetId("");
                }}
              >
                Deal
              </button>
              <button
                type="button"
                className={entry.entryMode === "listing" ? "active" : ""}
                onClick={() => {
                  const next = emptyEntry("listing");
                  setEntry(next);
                  setPushResult(null);
                  setPushError(null);
                  setDocTargetType("listing");
                  setDocTargetId("");
                }}
              >
                Listing
              </button>
            </div>
            <div className="dealius-toolbar-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={scraping}
                onClick={() => scrapeFileRef.current?.click()}
              >
                {scraping ? "Scraping..." : "Scrape voucher / listing PDF"}
              </Button>
              <input
                ref={scrapeFileRef}
                type="file"
                accept=".pdf,.xls,.xlsx,.xlsm"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void scrapeFromFile(file);
                }}
              />
            </div>
          </div>
          <div className="dealius-toolbar-status">
            <Badge tone={canPush ? "success" : "warn"}>{canPush ? "Ready" : "Needs review"}</Badge>
            {dealID && (
              <a href={`https://leenewportbeach.dealius.com/deals/${dealID}`} target="_blank" rel="noreferrer">
                Deal {dealID} <ExternalLink size={12} />
              </a>
            )}
            {listingID && (
              <a href={`https://leenewportbeach.dealius.com/listings/${listingID}`} target="_blank" rel="noreferrer">
                Listing {listingID} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        <section className="dealius-panel">
          <div className="dealius-section-title">{entry.entryMode === "listing" ? "Listing setup" : "Deal setup"}</div>
          <div className="dealius-form-grid">
            {entry.entryMode === "listing" ? (
              <>
                <Field label="Listing name" span={2}>
                  <Input value={entry.listingName} onChange={(e: any) => patchEntry({ listingName: e.target.value })} />
                </Field>
                <Field label="Listing transaction">
                  <Select
                    value={entry.listingTransaction}
                    onChange={(e: any) => {
                      const listingTransaction = e.target.value;
                      const lt = String(listingTransaction).toLowerCase();
                      let transactionType = "Lease";
                      if (lt === "sale") transactionType = "Sale";
                      else if (lt === "sublease") transactionType = "Sublease";
                      else if (lt === "sale or lease") transactionType = "Sale or Lease";
                      patchEntry({ listingTransaction, transactionType });
                    }}
                    options={[
                      { label: "Lease listing", value: "lease" },
                      { label: "Sale listing", value: "sale" },
                      { label: "Sale or lease", value: "sale or lease" },
                      { label: "Sublease", value: "sublease" },
                    ]}
                  />
                </Field>
                <Field label="Owner company">
                  <Input value={entry.ownerCompany} onChange={(e: any) => patchEntry({ ownerCompany: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Deal name" span={2}>
                  <Input value={entry.dealName} onChange={(e: any) => patchEntry({ dealName: e.target.value })} />
                </Field>
                <Field label="Representation">
                  <Select
                    value={entry.repTypeID}
                    onChange={(e: any) => patchEntry({ repTypeID: e.target.value })}
                    options={[
                      { label: "Landlord Rep", value: "4" },
                      { label: "Tenant Rep", value: "3" },
                      { label: "Seller Rep", value: "2" },
                      { label: "Buyer Rep", value: "1" },
                    ]}
                  />
                </Field>
                <Field label="Transaction">
                  <Select
                    value={entry.transactionType}
                    onChange={(e: any) => patchEntry({ transactionType: e.target.value })}
                    options={["Lease", "Sale", "Consulting", "Renewal"]}
                  />
                </Field>
              </>
            )}
          </div>
        </section>

        <section className="dealius-panel">
          <div className="dealius-section-title">Property</div>
          <div className="dealius-form-grid">
            <Field label="Address" span={2}>
              <Input value={entry.address} onChange={(e: any) => patchEntry({ address: e.target.value })} />
            </Field>
            <Field label="Suite">
              <Input value={entry.suite} onChange={(e: any) => patchEntry({ suite: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={entry.city} onChange={(e: any) => patchEntry({ city: e.target.value })} />
            </Field>
            <Field label="Zip">
              <Input value={entry.zip} onChange={(e: any) => patchEntry({ zip: e.target.value })} />
            </Field>
            <Field label="Property type">
              <Select
                value={entry.propertyType}
                onChange={(e: any) => patchEntry({ propertyType: e.target.value })}
                options={["Industrial", "Office", "Retail", "Land", "Multi-Family", "Medical"]}
              />
            </Field>
            <Field label="Deal / space SF">
              <Input type="number" value={entry.sqft} onChange={(e: any) => patchEntry({ sqft: e.target.value })} />
            </Field>
            <Field label="Building SF">
              <Input type="number" value={entry.totalBldgSF} onChange={(e: any) => patchEntry({ totalBldgSF: e.target.value })} />
            </Field>
            <Field label="Year built">
              <Input type="number" value={entry.yearBuilt} onChange={(e: any) => patchEntry({ yearBuilt: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="dealius-panel dealius-action-panel">
          <div>
            <div className="dealius-section-title">Pre-flight</div>
            <div className="dealius-checklist">
              {checklist.map(item => (
                <div key={item.label} className={item.ok ? "ok" : "missing"}>
                  <span>{item.label}</span>
                  <strong>{item.detail}</strong>
                </div>
              ))}
            </div>
            {pushError && <div className="dealius-error">{pushError}</div>}
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            icon={<Send size={16} />}
            disabled={pushing || !canPush}
            onClick={() => void handlePush()}
          >
            {pushing ? "Pushing..." : entry.entryMode === "listing" ? "Push listing" : "Push deal"}
          </Button>
        </section>

        <section className="dealius-panel">
          <div className="dealius-section-heading-row">
            <div>
              <div className="dealius-section-title">Attach documents</div>
              <div className="dealius-muted">Target: {docTargetType} {docTargetId || "enter an ID (or push first)"}</div>
            </div>
            <Button type="button" variant="secondary" size="sm" icon={<FileUp size={14} />} onClick={() => fileRef.current?.click()}>
              Select files
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx,.xlsm,.csv"
            style={{ display: "none" }}
            onChange={e => {
              const files = Array.from(e.target.files ?? []);
              setDocRows(current => [...current, ...files.map(file => ({ file, documentType: "" }))]);
              e.target.value = "";
            }}
          />
          <div className="dealius-doc-target-row">
            <Select
              value={docTargetType}
              onChange={(e: any) => setDocTargetType(e.target.value)}
              options={[
                { label: "Deal", value: "deal" },
                { label: "Listing", value: "listing" },
              ]}
            />
            <Input value={docTargetId} onChange={(e: any) => setDocTargetId(e.target.value)} placeholder="Dealius ID" />
          </div>
          {docRows.length > 0 && (
            <div className="dealius-doc-list">
              {docRows.map((row, index) => (
                <div className="dealius-doc-row" key={`${row.file.name}-${index}`}>
                  <div>
                    <strong>{row.file.name}</strong>
                    <span>{Math.max(1, Math.round(row.file.size / 1024))} KB</span>
                  </div>
                  <Select
                    value={row.documentType}
                    onChange={(e: any) =>
                      setDocRows(current => current.map((doc, i) => (i === index ? { ...doc, documentType: e.target.value } : doc)))
                    }
                    options={DOC_TYPES}
                  />
                  <button
                    type="button"
                    className="dealius-icon-btn"
                    onClick={() => setDocRows(current => current.filter((_, i) => i !== index))}
                    aria-label="Remove document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="dealius-doc-actions">
            <Button
              type="button"
              variant="primary"
              icon={<FileUp size={14} />}
              disabled={!docTargetId || docRows.length === 0 || uploadingDocs}
              onClick={() => void uploadDocuments()}
            >
              {uploadingDocs ? "Uploading..." : "Attach to Dealius"}
            </Button>
          </div>
        </section>
      </div>
    </AdminPortalShell>
  );
}

