import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Plus, Send, Trash2 } from "lucide-react";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Badge, Button, Field, Input, Select } from "../design/index.jsx";

type DealiusStatus =
  | { state: "loading" }
  | { state: "ok"; message: string }
  | { state: "mock"; message: string }
  | { state: "error"; message: string };

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
  clearHeight: number | string;
  dhDoors: number | string;
  glDoors: number | string;
  numParkingSpaces: number | string;
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
  paymentDate: string;
  paymentAmount: number | string;
  clientContactName: string;
  clientContactEmail: string;
  clientContactPhone: string;
  oppositeContactName: string;
  oppositeContactEmail: string;
  oppositeContactPhone: string;
  totalNNN: number | string;
  propTaxes: number | string;
  insurance: number | string;
  opex: number | string;
  cams: number | string;
  tiPerSF: number | string;
  escalation: number | string;
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

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function feePercentFrom(raw: unknown): string {
  const n = num(raw);
  if (n == null || n <= 0) return "";
  return String(n <= 1 ? n * 100 : n);
}

function suiteLabel(raw: unknown): string {
  const value = str(raw).replace(/\s+/g, " ");
  if (!value) return "";
  if (/^(suite|ste\.?|unit|#)\b/i.test(value)) return value.replace(/^ste\.?\b/i, "Ste");
  return `Ste ${value}`;
}

function propertyNameFromAddressSuite(address: unknown, suite: unknown): string {
  const cleanAddress = str(address);
  const cleanSuite = suiteLabel(suite);
  if (!cleanAddress) return cleanSuite;
  if (!cleanSuite) return cleanAddress;
  const normalizedAddress = cleanAddress.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const normalizedSuite = cleanSuite.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  const suiteNumber = normalizedSuite.replace(/^(suite|ste|unit|#)\s*/, "").trim();
  if (
    normalizedAddress.includes(normalizedSuite) ||
    (suiteNumber && new RegExp(`(^|\\s|#)${suiteNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedAddress))
  ) {
    return cleanAddress;
  }
  return `${cleanAddress}, ${cleanSuite}`;
}

function dealNamePrefixFromTransaction(raw: unknown): string {
  const value = str(raw).toLowerCase();
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewed";
  if (value.includes("sale") || value.includes("sold") || value.includes("purchase")) return "Sold";
  return "Leased";
}

function canonicalDealName(transactionType: unknown, address: unknown, suite: unknown, repTypeID?: unknown): string {
  const propertyName = propertyNameFromAddressSuite(address, suite) || "New Deal";
  if (String(repTypeID) === "5") return `Referred: ${propertyName}`;
  return `${dealNamePrefixFromTransaction(transactionType)}: ${propertyName}`;
}

function representationLabelFromId(raw: unknown): string {
  const map: Record<string, string> = {
    "1": "Buyer Rep",
    "2": "Seller Rep",
    "3": "Tenant Rep",
    "4": "Landlord Rep",
    "5": "Other / Referred Rep",
  };
  return (map[str(raw)] ?? str(raw)) || "Missing";
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
    clearHeight: "",
    dhDoors: "",
    glDoors: "",
    numParkingSpaces: "",
    clientCo: "",
    oppositeCo: "",
    ownerCompany: "",
    clientContactName: "",
    clientContactEmail: "",
    clientContactPhone: "",
    oppositeContactName: "",
    oppositeContactEmail: "",
    oppositeContactPhone: "",
    startDate: "",
    endDate: "",
    occupancyDate: "",
    term: "",
    askingRate: "",
    totalConsideration: "",
    feePercent: "",
    paymentDate: "",
    paymentAmount: "",
    totalNNN: "",
    propTaxes: "",
    insurance: "",
    opex: "",
    cams: "",
    tiPerSF: "",
    escalation: "",
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
    pct: feePercentFrom(b?.pct ?? b?.percent ?? b?.commissionPct),
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
  const [dealiusStatus, setDealiusStatus] = useState<DealiusStatus>({ state: "loading" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrapeFileRef = useRef<HTMLInputElement | null>(null);

  // Check Dealius authentication on mount so admins see right away whether a
  // push will actually reach Dealius or get silently mocked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/dealius/status`, { credentials: "include" });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || body?.success === false) {
          setDealiusStatus({ state: "error", message: body?.error ?? "Could not verify Dealius connection." });
          return;
        }
        const data = body?.data ?? {};
        if (data.mockMode) {
          setDealiusStatus({
            state: "mock",
            message: data.message ?? "Dealius credentials are not configured — pushes will be mocked.",
          });
        } else if (data.authenticated) {
          setDealiusStatus({ state: "ok", message: data.message ?? "Authenticated to Dealius." });
        } else {
          setDealiusStatus({ state: "error", message: data.message ?? "Dealius authentication failed." });
        }
      } catch (err: any) {
        if (cancelled) return;
        setDealiusStatus({ state: "error", message: err?.message ?? "Could not verify Dealius connection." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checklist = useMemo(() => {
    const listingSqft = entry.entryMode === "listing" && entry.spaces.some(space => Boolean(num(space.sqft)));
    const isReferred = String(entry.repTypeID) === "5";
    const rows = [
      { label: "Address", ok: Boolean(entry.address), detail: entry.address || "Missing" },
      { label: "City", ok: Boolean(entry.city), detail: entry.city || "Missing" },
      { label: "Zip", ok: Boolean(entry.zip), detail: entry.zip || "Missing" },
      { label: "Square feet", ok: Boolean(num(entry.sqft)) || listingSqft, detail: entry.sqft ? `${entry.sqft}` : listingSqft ? "From spaces" : "Missing" },
    ];
    if (entry.entryMode === "deal") {
      rows.push({ label: "Client company", ok: Boolean(entry.clientCo), detail: entry.clientCo || "Missing" });
      rows.push({ label: "Representation", ok: Boolean(entry.repTypeID), detail: representationLabelFromId(entry.repTypeID) });
      rows.push({ label: "Transaction", ok: Boolean(entry.transactionType), detail: entry.transactionType || "Missing" });
      if (isReferred) {
        rows.push({
          label: "Commission amount",
          ok: Boolean(num(entry.paymentAmount)),
          detail: entry.paymentAmount ? `$${entry.paymentAmount}` : "Missing",
        });
        rows.push({ label: "Internal fee", ok: Boolean(num(entry.feePercent)), detail: entry.feePercent ? `${entry.feePercent}%` : "Missing" });
      } else {
        rows.push({ label: "Fee percent", ok: Boolean(num(entry.feePercent)), detail: entry.feePercent ? `${entry.feePercent}%` : "Missing" });
      }
      if (!isReferred && entry.transactionType === "Lease") {
        rows.push({
          label: "Rent schedule",
          ok: entry.rentRows.some(row => Boolean(num(row.months))),
          detail: `${entry.rentRows.length} row(s)`,
        });
      }
    }
    return rows;
  }, [entry]);

  const canPush = checklist.every(item => item.ok);
  const dealID = pushResult?.dealID;
  const listingID = pushResult?.listingID;

  function patchEntry(patch: Partial<DealiusEntry>) {
    setEntry(current => {
      const next = { ...current, ...patch };
      if (
        next.entryMode === "deal" &&
        !("dealName" in patch) &&
        ("transactionType" in patch || "address" in patch || "suite" in patch || "repTypeID" in patch || "entryMode" in patch)
      ) {
        next.dealName = canonicalDealName(next.transactionType, next.address, next.suite, next.repTypeID);
        if (String(next.repTypeID) === "5" && !num(next.feePercent)) next.feePercent = "100";
      }
      return next;
    });
  }

  function patchRent(index: number, patch: Partial<RentRow>) {
    setEntry(current => ({
      ...current,
      rentRows: current.rentRows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function patchSpace(index: number, patch: Partial<ListingSpaceRow>) {
    setEntry(current => ({
      ...current,
      spaces: current.spaces.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function patchBroker(index: number, patch: Partial<BrokerRow>) {
    setEntry(current => ({
      ...current,
      brokers: current.brokers.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
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
      if (next.entryMode === "deal") {
        if (String(next.repTypeID) === "5" && !num(next.feePercent)) next.feePercent = "100";
      }
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
        {dealiusStatus.state === "mock" && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 8,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Dealius is in mock mode.</strong>{" "}
              {dealiusStatus.message ?? "No real credentials are configured, so pushes won’t reach Dealius."}{" "}
              Set <code>DEALIUS_USERNAME</code> and <code>DEALIUS_PASSWORD</code> in the server environment to enable live pushes.
            </div>
          </div>
        )}
        {dealiusStatus.state === "error" && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Dealius connection failed.</strong>{" "}
              {dealiusStatus.message ?? "Could not authenticate to Dealius."}
            </div>
          </div>
        )}
        {dealiusStatus.state === "ok" && (
          <div
            role="status"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#ecfdf5",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: 12,
              alignSelf: "flex-start",
            }}
          >
            <CheckCircle2 size={14} />
            <span>Connected to Dealius</span>
          </div>
        )}
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
                      { label: "Other / Referred Rep", value: "5" },
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
            <Field label="Clear height">
              <Input type="number" value={entry.clearHeight} onChange={(e: any) => patchEntry({ clearHeight: e.target.value })} />
            </Field>
            <Field label="DH doors">
              <Input type="number" value={entry.dhDoors} onChange={(e: any) => patchEntry({ dhDoors: e.target.value })} />
            </Field>
            <Field label="GL doors">
              <Input type="number" value={entry.glDoors} onChange={(e: any) => patchEntry({ glDoors: e.target.value })} />
            </Field>
            <Field label="Parking spaces">
              <Input type="number" value={entry.numParkingSpaces} onChange={(e: any) => patchEntry({ numParkingSpaces: e.target.value })} />
            </Field>
          </div>
        </section>

        {entry.entryMode === "deal" && (
          <section className="dealius-panel">
            <div className="dealius-section-title">Parties and economics</div>
            <div className="dealius-subsection-title">Parties</div>
            <div className="dealius-form-grid">
              <Field label="Client company">
                <Input value={entry.clientCo} onChange={(e: any) => patchEntry({ clientCo: e.target.value })} />
              </Field>
              <Field label="Opposite company">
                <Input value={entry.oppositeCo} onChange={(e: any) => patchEntry({ oppositeCo: e.target.value })} />
              </Field>
              <Field label="Client contact">
                <Input value={entry.clientContactName} onChange={(e: any) => patchEntry({ clientContactName: e.target.value })} />
              </Field>
              <Field label="Client contact email">
                <Input type="email" value={entry.clientContactEmail} onChange={(e: any) => patchEntry({ clientContactEmail: e.target.value })} />
              </Field>
              <Field label="Client contact phone">
                <Input value={entry.clientContactPhone} onChange={(e: any) => patchEntry({ clientContactPhone: e.target.value })} />
              </Field>
              <Field label="Opposite contact">
                <Input value={entry.oppositeContactName} onChange={(e: any) => patchEntry({ oppositeContactName: e.target.value })} />
              </Field>
              <Field label="Opposite contact email">
                <Input type="email" value={entry.oppositeContactEmail} onChange={(e: any) => patchEntry({ oppositeContactEmail: e.target.value })} />
              </Field>
              <Field label="Opposite contact phone">
                <Input value={entry.oppositeContactPhone} onChange={(e: any) => patchEntry({ oppositeContactPhone: e.target.value })} />
              </Field>
            </div>

            <div className="dealius-subsection-title">Dates</div>
            <div className="dealius-form-grid">
              <Field label="Start date">
                <Input type="date" value={entry.startDate} onChange={(e: any) => patchEntry({ startDate: e.target.value })} />
              </Field>
              <Field label="End date">
                <Input type="date" value={entry.endDate} onChange={(e: any) => patchEntry({ endDate: e.target.value })} />
              </Field>
              <Field label="Term months">
                <Input type="number" value={entry.term} onChange={(e: any) => patchEntry({ term: e.target.value })} />
              </Field>
              <Field label="Occupancy date">
                <Input type="date" value={entry.occupancyDate} onChange={(e: any) => patchEntry({ occupancyDate: e.target.value })} />
              </Field>
            </div>

            <div className="dealius-subsection-title">Financials</div>
            <div className="dealius-form-grid">
              <Field label={String(entry.repTypeID) === "5" ? "Internal fee" : "Fee percent (from voucher)"}>
                <Input type="number" step="0.01" value={entry.feePercent} onChange={(e: any) => patchEntry({ feePercent: e.target.value })} suffix="%" />
              </Field>
              {String(entry.repTypeID) === "5" && (
                <>
                  <Field label="Commission amount">
                    <Input type="number" step="0.01" value={entry.paymentAmount} onChange={(e: any) => patchEntry({ paymentAmount: e.target.value })} prefix="$" />
                  </Field>
                  <Field label="Payment date">
                    <Input type="date" value={entry.paymentDate} onChange={(e: any) => patchEntry({ paymentDate: e.target.value })} />
                  </Field>
                </>
              )}
              <Field label={entry.transactionType === "Sale" ? "Sale price" : "Asking rate"}>
                <Input
                  type="number"
                  step="0.01"
                  value={entry.transactionType === "Sale" ? entry.totalConsideration : entry.askingRate}
                  onChange={(e: any) =>
                    entry.transactionType === "Sale"
                      ? patchEntry({ totalConsideration: e.target.value })
                      : patchEntry({ askingRate: e.target.value })
                  }
                />
              </Field>
              <Field label="NNN ($/SF/yr)">
                <Input type="number" step="0.01" value={entry.totalNNN} onChange={(e: any) => patchEntry({ totalNNN: e.target.value })} />
              </Field>
              <Field label="Avg escalation">
                <Input type="number" step="0.01" value={entry.escalation} onChange={(e: any) => patchEntry({ escalation: e.target.value })} suffix="%" />
              </Field>
              <Field label="Prop taxes">
                <Input type="number" step="0.01" value={entry.propTaxes} onChange={(e: any) => patchEntry({ propTaxes: e.target.value })} />
              </Field>
              <Field label="Insurance">
                <Input type="number" step="0.01" value={entry.insurance} onChange={(e: any) => patchEntry({ insurance: e.target.value })} />
              </Field>
              <Field label="OPEX">
                <Input type="number" step="0.01" value={entry.opex} onChange={(e: any) => patchEntry({ opex: e.target.value })} suffix="%" />
              </Field>
              <Field label="CAMs">
                <Input type="number" step="0.01" value={entry.cams} onChange={(e: any) => patchEntry({ cams: e.target.value })} />
              </Field>
              <Field label="TI allowance">
                <Input type="number" step="0.01" value={entry.tiPerSF} onChange={(e: any) => patchEntry({ tiPerSF: e.target.value })} />
              </Field>
            </div>
          </section>
        )}

        {entry.entryMode === "listing" && (
          <section className="dealius-panel">
            <div className="dealius-section-title">Listing details</div>
            <div className="dealius-form-grid">
              <Field label="Listing start">
                <Input type="date" value={entry.listingStartDate} onChange={(e: any) => patchEntry({ listingStartDate: e.target.value })} />
              </Field>
              <Field label="Listing expiration">
                <Input type="date" value={entry.listingExpiryDate} onChange={(e: any) => patchEntry({ listingExpiryDate: e.target.value })} />
              </Field>
              <Field label="Available date">
                <Input type="date" value={entry.listingAvailableDate} onChange={(e: any) => patchEntry({ listingAvailableDate: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select
                  value={entry.listingStatus}
                  onChange={(e: any) => patchEntry({ listingStatus: e.target.value })}
                  options={["active", "pending", "draft"]}
                />
              </Field>
              <Field label="Asking rate">
                <Input type="number" step="0.01" value={entry.askingRate} onChange={(e: any) => patchEntry({ askingRate: e.target.value })} />
              </Field>
              <Field label="Commission">
                <Input type="number" step="0.01" value={entry.feePercent} onChange={(e: any) => patchEntry({ feePercent: e.target.value })} suffix="%" />
              </Field>
            </div>
          </section>
        )}

        {entry.entryMode === "listing" && (
          <section className="dealius-panel">
            <div className="dealius-section-heading-row">
              <div className="dealius-section-title">Property spaces</div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => patchEntry({ spaces: [...entry.spaces, { suite: "", sqft: "", askingRate: "", availableDate: "", comments: "" }] })}
              >
                Add space
              </Button>
            </div>
            <div className="dealius-table">
              <div className="dealius-table-head spaces">
                <div>Suite</div>
                <div>SF</div>
                <div>Rate</div>
                <div>Available</div>
                <div>Comments</div>
                <div />
              </div>
              {entry.spaces.map((row, index) => (
                <div className="dealius-table-row spaces" key={index}>
                  <Input value={row.suite} onChange={(e: any) => patchSpace(index, { suite: e.target.value })} />
                  <Input type="number" value={row.sqft} onChange={(e: any) => patchSpace(index, { sqft: e.target.value })} />
                  <Input type="number" step="0.01" value={row.askingRate ?? ""} onChange={(e: any) => patchSpace(index, { askingRate: e.target.value })} />
                  <Input value={row.availableDate ?? ""} onChange={(e: any) => patchSpace(index, { availableDate: e.target.value })} />
                  <Input value={row.comments ?? ""} onChange={(e: any) => patchSpace(index, { comments: e.target.value })} />
                  <button
                    type="button"
                    className="dealius-icon-btn"
                    onClick={() => patchEntry({ spaces: entry.spaces.filter((_, i) => i !== index) })}
                    aria-label="Remove listing space"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {entry.entryMode === "deal" && entry.transactionType === "Lease" && String(entry.repTypeID) !== "5" && (
          <section className="dealius-panel">
            <div className="dealius-section-heading-row">
              <div className="dealius-section-title">Rent schedule</div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => patchEntry({ rentRows: [...entry.rentRows, { months: "", monthly: "", free: false }] })}
              >
                Add row
              </Button>
            </div>
            <div className="dealius-table">
              <div className="dealius-table-head rent">
                <div>Months</div>
                <div>Monthly rent</div>
                <div>Free</div>
                <div>Monthly $/SF</div>
                <div />
              </div>
              {entry.rentRows.map((row, index) => (
                <div className="dealius-table-row rent" key={index}>
                  <Input type="number" value={row.months} onChange={(e: any) => patchRent(index, { months: e.target.value })} />
                  <Input type="number" value={row.monthly} onChange={(e: any) => patchRent(index, { monthly: e.target.value })} />
                  <label className="dealius-checkbox">
                    <input type="checkbox" checked={row.free} onChange={e => patchRent(index, { free: e.target.checked })} />
                  </label>
                  <div className="dealius-derived-value">
                    {row.free || !num(row.monthly) || !num(entry.sqft)
                      ? "Free"
                      : `$${((num(row.monthly) ?? 0) / Math.max(1, num(entry.sqft) ?? 1)).toFixed(4)}`}
                  </div>
                  <button
                    type="button"
                    className="dealius-icon-btn"
                    onClick={() => patchEntry({ rentRows: entry.rentRows.filter((_, i) => i !== index) })}
                    aria-label="Remove rent row"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="dealius-panel">
          <div className="dealius-section-heading-row">
            <div className="dealius-section-title">{entry.entryMode === "listing" ? "Listing brokers" : "Deal brokers"}</div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => patchEntry({ brokers: [...entry.brokers, { name: "", side: "", pct: "", lead: false }] })}
            >
              Add broker
            </Button>
          </div>
          <div className="dealius-table">
            <div className="dealius-table-head broker">
              <div>Name</div>
              <div>Side</div>
              <div>Commission</div>
              <div>Lead</div>
              <div />
            </div>
            {entry.brokers.map((row, index) => (
              <div className="dealius-table-row broker" key={index}>
                <Input value={row.name} onChange={(e: any) => patchBroker(index, { name: e.target.value })} />
                <Select
                  value={row.side ?? ""}
                  onChange={(e: any) => patchBroker(index, { side: e.target.value })}
                  options={[
                    { label: "Unspecified", value: "" },
                    { label: "Listing", value: "Listing" },
                    { label: "Procuring", value: "Procuring" },
                    { label: "Both", value: "Both" },
                    { label: "Referral", value: "Referral" },
                  ]}
                />
                <Input type="number" step="0.01" value={row.pct} onChange={(e: any) => patchBroker(index, { pct: e.target.value })} suffix="%" />
                <label className="dealius-checkbox">
                  <input type="checkbox" checked={Boolean(row.lead)} onChange={e => patchBroker(index, { lead: e.target.checked })} />
                </label>
                <button
                  type="button"
                  className="dealius-icon-btn"
                  onClick={() => patchEntry({ brokers: entry.brokers.filter((_, i) => i !== index) })}
                  aria-label="Remove broker row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
            {pushResult?.mockMode && (
              <div
                role="status"
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  This push was simulated — no data was sent to Dealius because credentials are missing.
                </div>
              </div>
            )}
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
