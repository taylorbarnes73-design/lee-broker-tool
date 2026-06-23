import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileSearch, FileUp, Plus, Send, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { mergeVoucherFromContractExtraction } from "@shared/contractIntake";
import { Badge, Button, Field, Input, Select } from "../design/index.jsx";

type SubmissionDetail = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  payload: any;
};

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

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function num(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(raw: unknown): string {
  const n = num(raw);
  return n == null ? "" : String(n);
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fieldFromSections(payload: any, labels: string[]): string {
  const wanted = new Set(labels.map(normalizeLabel));
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  for (const section of sections) {
    const fields = Array.isArray(section?.fields) ? section.fields : [];
    for (const field of fields) {
      if (wanted.has(normalizeLabel(str(field?.label)))) return str(field?.value);
    }
  }
  return "";
}

function inferTransactionType(raw: unknown) {
  const value = str(raw).toLowerCase();
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewal";
  if (value.includes("sale") || value.includes("sold")) return "Sale";
  return "Lease";
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
  if (String(repTypeID) === "5") {
    return `Referred: ${propertyName}`.replace(/\s+/g, " ").trim();
  }
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

type PartyLabels = {
  clientParty: string;
  oppositeParty: string;
  clientCo: string;
  oppositeCo: string;
  clientContact: string;
  oppositeContact: string;
  note: string;
};

function partyLabelsFromRepType(repTypeID: string): PartyLabels {
  const map: Record<string, PartyLabels> = {
    "1": {
      clientParty: "Buyer — your client",
      oppositeParty: "Seller — opposite side",
      clientCo: "Buyer company",
      oppositeCo: "Seller company",
      clientContact: "Buyer contact",
      oppositeContact: "Seller contact",
      note: "Buyer rep: your client is the buyer. Seller details go on the opposite side.",
    },
    "2": {
      clientParty: "Seller — your client",
      oppositeParty: "Buyer — opposite side",
      clientCo: "Seller company",
      oppositeCo: "Buyer company",
      clientContact: "Seller contact",
      oppositeContact: "Buyer contact",
      note: "Seller rep: your client is the seller. Buyer details go on the opposite side.",
    },
    "3": {
      clientParty: "Tenant — your client",
      oppositeParty: "Landlord — opposite side",
      clientCo: "Tenant company",
      oppositeCo: "Landlord company",
      clientContact: "Tenant contact",
      oppositeContact: "Landlord contact",
      note: "Tenant rep: your client is the tenant. Landlord details go on the opposite side.",
    },
    "4": {
      clientParty: "Landlord — your client",
      oppositeParty: "Tenant — opposite side",
      clientCo: "Landlord company",
      oppositeCo: "Tenant company",
      clientContact: "Landlord contact",
      oppositeContact: "Tenant contact",
      note: "Landlord rep: your client is the landlord. Tenant details go on the opposite side.",
    },
  };
  return (
    map[repTypeID] ?? {
      clientParty: "Your client",
      oppositeParty: "Opposite side",
      clientCo: "Client company",
      oppositeCo: "Opposite company",
      clientContact: "Client contact",
      oppositeContact: "Opposite contact",
      note: "Your client is the side you represent. The opposite side is the other party in the transaction.",
    }
  );
}

function isLeaseTransaction(raw: unknown) {
  const value = str(raw).toLowerCase();
  return value.includes("lease") || value.includes("renew");
}

function feePercentFrom(raw: unknown): string {
  const n = num(raw);
  if (n == null || n <= 0) return "";
  return String(n <= 1 ? n * 100 : n);
}

function asRentRows(raw: unknown, fallbackMonths?: unknown, fallbackRate?: unknown, fallbackSqft?: unknown): RentRow[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row: any) => ({
        months: compactNumber(row?.months),
        monthly: compactNumber(row?.monthly),
        free: Boolean(row?.free) || (num(row?.monthly) ?? 0) === 0,
      }))
      .filter(row => num(row.months) != null && Number(row.months) > 0);
  }

  const months = num(fallbackMonths);
  const rate = num(fallbackRate);
  const sqft = num(fallbackSqft);
  if (months && months > 0 && rate && sqft) {
    return [{ months: String(months), monthly: String(Math.round(rate * sqft * 100) / 100), free: false }];
  }
  return [];
}

function asListingSpaces(raw: unknown, fallbackSuite: unknown, fallbackSqft: unknown, fallbackRate: unknown): ListingSpaceRow[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row: any) => ({
        suite: str(row?.suite || row?.name),
        sqft: compactNumber(row?.sqft),
        askingRate: compactNumber(row?.askingRate),
        availableDate: str(row?.availableDate).slice(0, 10),
        comments: str(row?.comments),
      }))
      .filter(row => row.suite || num(row.sqft) != null || num(row.askingRate) != null || row.comments);
  }

  const suite = str(fallbackSuite);
  const sqft = compactNumber(fallbackSqft);
  if (suite || sqft) {
    return [{ suite, sqft, askingRate: compactNumber(fallbackRate), availableDate: "", comments: "" }];
  }
  return [];
}

function asBrokerRows(raw: unknown, fallbacks: unknown[]): BrokerRow[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row: any, index) => ({
        name: str(row?.name || row?.brokerName || row?.fullName),
        side: str(row?.side),
        pct: feePercentFrom(row?.pct ?? row?.percent ?? row?.commissionPct),
        lead: Boolean(row?.lead) || index === 0,
      }))
      .filter(row => row.name);
  }

  const seen = new Set<string>();
  return fallbacks
    .map(name => str(name))
    .filter(Boolean)
    .filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((name, index, list) => ({
      name,
      pct: list.length === 1 ? "100" : "50",
      lead: index === 0,
    }));
}

function buildInitialEntry(submission: SubmissionDetail): DealiusEntry {
  const payload = submission.payload ?? {};
  const voucherData = payload.voucherData && typeof payload.voucherData === "object" ? payload.voucherData : {};
  const p = { ...payload, ...voucherData };
  const formType = submission.formType.toLowerCase();
  const isListing = formType === "listing";

  const address = str(p.address) || fieldFromSections(payload, ["Address", "Property Address"]) || str(payload.propertyAddress || submission.reference);
  const city = str(p.city) || fieldFromSections(payload, ["City"]);
  const zip = str(p.zip || p.zipCode) || fieldFromSections(payload, ["Zip", "ZIP"]);
  const suite = str(p.suite || p.unit || fieldFromSections(payload, ["Suite", "Unit"]));
  const propertyType =
    str(p.propertyType || p.propType) ||
    fieldFromSections(payload, ["Property Type"]) ||
    "Industrial";
  const transactionType =
    inferTransactionType(p.transactionType || p.txnType || fieldFromSections(payload, ["Transaction Type"]));
  const listingTransaction = str(p.listingTransaction || p.transactionType || p.txnType).toLowerCase();
  const sqft =
    compactNumber(p.sqft || p.dealSF || p.lDealSF || p.sizeSF) ||
    compactNumber(fieldFromSections(payload, ["Building SF", "Suite SF", "Deal SF", "Space SF"]));
  const bldgSF =
    compactNumber(p.totalBldgSF || p.bldgSF || p.buildingSF) ||
    compactNumber(fieldFromSections(payload, ["Building SF"]));
  const leaseRate = p.lRate || p.leaseRate || fieldFromSections(payload, ["Rate ($/SF/Mo)", "Base Rent ($/SF/Mo)"]);
  const repTypeID = str(p.repTypeID || p.repType) || (transactionType === "Sale" ? "2" : "4");
  const voucherFee =
    feePercentFrom(p.feePercent || p.internalFeePercent || p.commissionRate || p.lCommRate || p.sCommPct || p.saleCommPct) ||
    feePercentFrom(fieldFromSections(payload, ["Total Commission %", "Commission (%)"]));
  const fee = String(repTypeID) === "5" ? voucherFee || "100" : voucherFee;
  const clientCo = str(p.clientCo || p.lessorName || p.sellerName || p.lsCompany) || fieldFromSections(payload, ["Lessor / Seller", "Seller / Client Co."]);
  const clientContactName = str(p.clientContactName || p.clientContact || p.lsContact);

  const brokers = asBrokerRows(p.brokers || p.agents, [
    p.listingAgentName,
    p.procuringAgentName,
    p.laName,
    p.paName,
    fieldFromSections(payload, ["Agent 1 Name", "Listing Agent"]),
    fieldFromSections(payload, ["Agent 2 Name", "Procuring Agent"]),
    submission.submittedBy,
  ]);

  return {
    entryMode: isListing ? "listing" : "deal",
    dealName: canonicalDealName(transactionType, address, suite, repTypeID),
    listingName: str(p.listingName || p.dealName) || address || "New Listing",
    repTypeID,
    transactionType,
    listingTransaction: listingTransaction || transactionType.toLowerCase(),
    address,
    city,
    zip,
    suite,
    propertyType,
    sqft,
    totalBldgSF: bldgSF || sqft,
    yearBuilt: compactNumber(p.yearBuilt || fieldFromSections(payload, ["Year Built"])),
    clearHeight: compactNumber(p.clearHeight || p.clearance),
    dhDoors: compactNumber(p.dhDoors || p.dh),
    glDoors: compactNumber(p.glDoors || p.gl),
    numParkingSpaces: compactNumber(p.numParkingSpaces || p.parkingSpaces),
    clientCo,
    oppositeCo: str(p.oppositeCo || p.lesseeName || p.buyerName || p.lbCompany) || fieldFromSections(payload, ["Lessee / Buyer", "Buyer / Opposite Co."]),
    ownerCompany: str(p.ownerCompany || p.owner || p.clientCo) || fieldFromSections(payload, ["Owner Name", "Owner / Sublessor Company"]),
    clientContactName,
    clientContactEmail: str(p.clientContactEmail || p.clientEmail || p.lsEmail),
    clientContactPhone: str(p.clientContactPhone || p.clientPhone || p.lsPhone),
    oppositeContactName: str(p.oppositeContactName || p.oppositeContact || p.lbContact),
    oppositeContactEmail: str(p.oppositeContactEmail || p.oppositeEmail || p.lbEmail),
    oppositeContactPhone: str(p.oppositeContactPhone || p.oppositePhone || p.lbPhone),
    startDate: str(p.startDate || p.lStart || p.leaseStart || fieldFromSections(payload, ["Commencement Date"])).slice(0, 10),
    endDate: str(p.endDate || p.lEnd || p.leaseEnd || fieldFromSections(payload, ["Expiration Date"])).slice(0, 10),
    occupancyDate: str(p.occupancyDate || p.lOcc).slice(0, 10),
    term: compactNumber(p.term || p.lTerm || p.leaseTerm || fieldFromSections(payload, ["Lease Term", "Lease Term (months)"])),
    askingRate: compactNumber(p.askingRate || p.lAskingRate || leaseRate),
    totalConsideration: compactNumber(p.totalConsideration || p.sPrice || p.salePrice || fieldFromSections(payload, ["Total Consideration", "Asking Price"])),
    feePercent: fee,
    paymentDate: str(p.paymentDate).slice(0, 10),
    paymentAmount: compactNumber(p.paymentAmount || p.commissionAmount || p.referralFee || p.totalInvoice || p.invoiceAmount),
    totalNNN: compactNumber(p.totalNNN || p.lNnnTotal),
    propTaxes: compactNumber(p.propTaxes),
    insurance: compactNumber(p.insurance),
    opex: compactNumber(p.opex),
    cams: compactNumber(p.cams),
    tiPerSF: compactNumber(p.tiPerSF || p.lTiSF),
    escalation: compactNumber(p.escalation || p.lEscalations),
    listingStartDate: str(p.listingStartDate || p.listingStart || p.submittedAt || submission.createdAt).slice(0, 10),
    listingExpiryDate: str(p.listingExpiryDate || p.listingExpiration).slice(0, 10),
    listingAvailableDate: str(p.listingAvailableDate || p.availableDate).slice(0, 10),
    listingStatus: str(p.listingStatus || "active"),
    listingSource: str(p.listingSource) || `Submission ${submission.id}`,
    listingNotes: str(p.listingNotes || p.notes),
    rentRows: asRentRows(p.rentRows || p.rentSchedule, p.lTerm || p.leaseTerm, leaseRate, sqft),
    spaces: asListingSpaces(p.spaces || p.listingSpaces, suite, sqft, leaseRate),
    brokers,
  };
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

function latestTarget(entry: DealiusEntry, payload: any, result: any): { entityType: "deal" | "listing"; entityId: string } {
  const push = payload?.dealiusPush ?? {};
  const dealID = result?.dealID ?? push?.dealID;
  const listingID = result?.listingID ?? push?.listingID;
  if (entry.entryMode === "listing" && listingID) return { entityType: "listing", entityId: String(listingID) };
  if (dealID) return { entityType: "deal", entityId: String(dealID) };
  if (listingID) return { entityType: "listing", entityId: String(listingID) };
  return { entityType: entry.entryMode === "listing" ? "listing" : "deal", entityId: "" };
}

export default function DealiusSubmissionWorkspace({
  submission,
  onRefresh,
}: {
  submission: SubmissionDetail;
  onRefresh: () => Promise<void>;
}) {
  const [entry, setEntry] = useState<DealiusEntry>(() => buildInitialEntry(submission));
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<any>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [docTargetType, setDocTargetType] = useState<"deal" | "listing">("deal");
  const [docTargetId, setDocTargetId] = useState("");
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [contractType, setContractType] = useState("Lease Agreement");
  const [extractingDoc, setExtractingDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const extractFileRef = useRef<HTMLInputElement | null>(null);
  const uploadFile = trpc.files.upload.useMutation();
  const extractContract = trpc.contracts.extractContract.useMutation();

  useEffect(() => {
    const next = buildInitialEntry(submission);
    setEntry(next);
    const target = latestTarget(next, submission.payload, null);
    setDocTargetType(target.entityType);
    setDocTargetId(target.entityId);
  }, [submission.id, submission.payload]);

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
      if (!isReferred && isLeaseTransaction(entry.transactionType)) {
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
  const partyLabels = useMemo(() => partyLabelsFromRepType(entry.repTypeID), [entry.repTypeID]);

  const outsideBrokers = useMemo(() => {
    const raw = submission.payload?.outsideBrokers;
    if (!Array.isArray(raw)) return [];
    return raw.filter((row: any) => str(row?.name)).map((row: any) => ({ name: str(row.name), amt: num(row.amt) }));
  }, [submission.payload]);

  const pendingOutsideBrokers = outsideBrokers.filter(
    ob => !entry.brokers.some(b => b.name.trim().toLowerCase() === ob.name.trim().toLowerCase())
  );

  function addOutsideBrokerToList(name: string) {
    patchEntry({ brokers: [...entry.brokers, { name, side: "Referral", pct: "", lead: false }] });
  }

  function patchEntry(patch: Partial<DealiusEntry>) {
    setEntry(current => {
      const next = { ...current, ...patch };
      if (next.entryMode === "deal" && ("transactionType" in patch || "address" in patch || "suite" in patch || "entryMode" in patch || "repTypeID" in patch || "clientCo" in patch || "clientContactName" in patch)) {
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

  async function handlePush() {
    setPushing(true);
    setPushError(null);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/push-dealius`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryMode: entry.entryMode, entry }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(body?.errors) ? body.errors.join(" ") : body?.error;
        throw new Error(detail || "Push failed");
      }
      setPushResult(body?.data ?? null);
      const target = latestTarget(entry, submission.payload, body?.data);
      setDocTargetType(target.entityType);
      setDocTargetId(target.entityId);
      const pushedId = body?.data?.dealID ?? body?.data?.listingID;
      toast.success(entry.entryMode === "listing" ? "Listing pushed to Dealius" : "Deal pushed to Dealius", {
        description: pushedId ? `${entry.entryMode === "listing" ? "Listing" : "Deal"} ${pushedId} is now live in Dealius.` : undefined,
        duration: 8000,
      });
      await onRefresh();
    } catch (error: any) {
      const message = error?.message ?? "Push failed";
      setPushError(message);
      toast.error(message);
    } finally {
      setPushing(false);
    }
  }

  async function handleExtractDocument(file: File) {
    setExtractingDoc(true);
    try {
      const base64Data = await fileToBase64(file);
      if (entry.entryMode === "listing") {
        const response = await fetch(`/api/submissions/${submission.id}/import-listing-pdf`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, filename: file.name }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "Listing PDF import failed");
        toast.success(
          `Listing form scraped: ${body?.data?.address ?? "property"} (${body?.data?.spaceCount ?? 0} space(s)).`
        );
        await onRefresh();
        return;
      }

      const uploaded = await uploadFile.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
        category: "submissions/contracts",
        reference: submission.reference || String(submission.id),
        uploaderName: "Admin Portal",
      });
      if (!uploaded?.success || !uploaded?.url) throw new Error("Upload failed");

      const extracted = await extractContract.mutateAsync({ pdfUrl: uploaded.url, contractType });
      if (!extracted?.success || !extracted?.data) throw new Error(extracted?.error || "Document extraction failed");

      const nextPayload = mergeVoucherFromContractExtraction({
        payload: submission.payload,
        contract: extracted.data,
        pdf: { url: uploaded.url, fileKey: uploaded.fileKey, filename: uploaded.filename },
        contractType,
      });

      const response = await fetch(`/api/submissions/${submission.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: nextPayload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Failed to save extracted fields");

      setEntry(buildInitialEntry({ ...submission, payload: nextPayload }));
      toast.success("Document scraped and fields refreshed.");
      await onRefresh();
    } catch (error: any) {
      toast.error(error?.message ?? "Document extraction failed");
    } finally {
      setExtractingDoc(false);
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
      const response = await fetch(`/api/submissions/${submission.id}/dealius-documents`, {
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
      await onRefresh();
    } catch (error: any) {
      toast.error(error?.message ?? "Document upload failed");
    } finally {
      setUploadingDocs(false);
    }
  }

  const target = latestTarget(entry, submission.payload, pushResult);
  const dealID = pushResult?.dealID ?? submission.payload?.dealiusPush?.dealID;
  const listingID = pushResult?.listingID ?? submission.payload?.dealiusPush?.listingID;
  const propertyName = propertyNameFromAddressSuite(entry.address, entry.suite);
  const todayLabel = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const extractedDocs = Array.isArray(submission.payload?.contractRevisions)
    ? submission.payload.contractRevisions.length
    : submission.payload?.contractExtraction
      ? 1
      : 0;

  return (
    <div className="dealius-workspace">
      <section className="dealius-flow-panel">
        <div>
          <div className="dealius-flow-kicker">Submission tool</div>
          <div className="dealius-flow-title">Document intake to Dealius</div>
        </div>
        <div className="dealius-flow-steps">
          <div className={extractedDocs > 0 ? "complete" : ""}>
            <span>Scrape</span>
            <strong>{extractedDocs > 0 ? `${extractedDocs} saved` : "Ready"}</strong>
          </div>
          <div className={canPush ? "complete" : ""}>
            <span>Push</span>
            <strong>{canPush ? "Ready" : "Review"}</strong>
          </div>
          <div className={target.entityId ? "complete" : ""}>
            <span>Attach</span>
            <strong>{target.entityId ? `${target.entityType} ${target.entityId}` : "After push"}</strong>
          </div>
        </div>
      </section>

      <section className="dealius-workflow-panel">
        <div className="dealius-workflow-top">
          <div className="dealius-mode-control" aria-label="Dealius entry mode">
            <button
              type="button"
              className={entry.entryMode === "deal" ? "active" : ""}
              onClick={() => patchEntry({ entryMode: "deal" })}
            >
              Deal entry
            </button>
            <button
              type="button"
              className={entry.entryMode === "listing" ? "active" : ""}
              onClick={() => patchEntry({ entryMode: "listing" })}
            >
              Listing entry
            </button>
          </div>
          <p className="dealius-mode-copy">
            {entry.entryMode === "listing"
              ? "Create a listing-side Dealius record from this submission."
              : "Review scraped fields, adjust the deal record, then push to Dealius."}
          </p>
        </div>
        <div className="dealius-workflow-actions">
          <div className="dealius-doc-target-row" style={{ margin: 0, flex: 1, minWidth: 240 }}>
            <Select
              value={contractType}
              onChange={(e: any) => setContractType(e.target.value)}
              options={["Lease Agreement", "Purchase & Sale Agreement", "AIR CRE Contract", "Commission Agreement"]}
            />
            <Button type="button" variant="secondary" icon={<FileSearch size={14} />} disabled={extractingDoc} onClick={() => extractFileRef.current?.click()}>
              {extractingDoc ? "Scraping..." : "Scrape PDF"}
            </Button>
          </div>
          <div className="dealius-toolbar-status">
            <Badge tone={canPush ? "success" : "warn"}>{canPush ? "Ready to push" : "Needs review"}</Badge>
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
        <input
          ref={extractFileRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void handleExtractDocument(file);
            e.target.value = "";
          }}
        />
      </section>

      <div className="dealius-form-card">
        <div className="dealius-form-head">
          <div>
            <div className="dealius-section-title">{entry.entryMode === "listing" ? "Listing entry" : "Deal entry"}</div>
            <p className="dealius-form-subtitle">Review every field before submitting to Dealius.</p>
          </div>
          <div className="dealius-rule-stack">
            <div>
              <span>Deal name</span>
              <strong>{entry.entryMode === "deal" ? entry.dealName : entry.listingName || "Listing"}</strong>
            </div>
            <div>
              <span>Property name</span>
              <strong>{propertyName || "Address required"}</strong>
            </div>
            {entry.entryMode === "deal" && (
              <div>
                <span>Estimated close</span>
                <strong>{todayLabel}</strong>
              </div>
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
                  onChange={(e: any) => patchEntry({ listingTransaction: e.target.value, transactionType: e.target.value === "sale" ? "Sale" : "Lease" })}
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
                <Input value={entry.dealName} auto />
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
        <>
          <section className="dealius-panel">
            <div className="dealius-section-title">Lease parties</div>
            <p className="dealius-party-note">{partyLabels.note}</p>
            <div className="dealius-party-columns">
              <div className="dealius-party-col">
                <div className="dealius-party-col-label">{partyLabels.clientParty}</div>
                <Field label={partyLabels.clientCo}>
                  <Input value={entry.clientCo} onChange={(e: any) => patchEntry({ clientCo: e.target.value })} />
                </Field>
                <Field label={partyLabels.clientContact}>
                  <Input value={entry.clientContactName} onChange={(e: any) => patchEntry({ clientContactName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={entry.clientContactEmail} onChange={(e: any) => patchEntry({ clientContactEmail: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={entry.clientContactPhone} onChange={(e: any) => patchEntry({ clientContactPhone: e.target.value })} />
                </Field>
              </div>
              <div className="dealius-party-col dealius-party-col-opposite">
                <div className="dealius-party-col-label">{partyLabels.oppositeParty}</div>
                <Field label={partyLabels.oppositeCo}>
                  <Input value={entry.oppositeCo} onChange={(e: any) => patchEntry({ oppositeCo: e.target.value })} />
                </Field>
                <Field label={partyLabels.oppositeContact}>
                  <Input value={entry.oppositeContactName} onChange={(e: any) => patchEntry({ oppositeContactName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={entry.oppositeContactEmail} onChange={(e: any) => patchEntry({ oppositeContactEmail: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={entry.oppositeContactPhone} onChange={(e: any) => patchEntry({ oppositeContactPhone: e.target.value })} />
                </Field>
              </div>
            </div>
          </section>

          <section className="dealius-panel">
            <div className="dealius-section-title">Dates &amp; term</div>
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
          </section>

          <section className="dealius-panel">
            <div className="dealius-section-title">Economics</div>
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
        </>
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
          <p className="dealius-hint">
            Rates push to Dealius as monthly $/SF. Monthly $/SF is calculated from monthly rent ÷ deal SF.
          </p>
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
            onClick={() => patchEntry({ brokers: [...entry.brokers, { name: "", pct: "", lead: false }] })}
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
        <p className="dealius-hint">
          Lead broker and commission splits are submitted with the deal when names match your Dealius directory.
        </p>
        {pendingOutsideBrokers.length > 0 && (
          <div className="dealius-status-banner warn">
            <div>
              <strong>Outside broker payout on this voucher.</strong> Dealius only tracks brokers you add to the list above
              — add the outside broker manually with their split, or this payout will not be reflected on the deal.
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {pendingOutsideBrokers.map(ob => (
                  <li key={ob.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {ob.name}
                    {ob.amt != null ? ` — $${ob.amt.toLocaleString()}` : ""}
                    <Button type="button" variant="secondary" size="sm" onClick={() => addOutsideBrokerToList(ob.name)}>
                      Add to broker list
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="dealius-sticky-action-bar">
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
          {!pushError && pushResult && (
            <div className="dealius-status-banner success">
              <div>
                <strong>✓ {entry.entryMode === "listing" ? "Listing" : "Deal"} pushed to Dealius.</strong>{" "}
                {dealID ? `Deal ${dealID}` : listingID ? `Listing ${listingID}` : ""} updated just now.
              </div>
            </div>
          )}
          {Array.isArray(pushResult?.warnings) && pushResult.warnings.length > 0 && (
            <div className="dealius-status-banner warn">
              <div>
                <strong>Review needed:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {pushResult.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
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
          {pushing ? "Pushing…" : entry.entryMode === "listing" ? "Push listing" : "Push deal"}
        </Button>
      </section>
      </div>

      <section className="dealius-panel">
        <div className="dealius-section-heading-row">
          <div>
            <div className="dealius-section-title">Attach documents</div>
            <div className="dealius-muted">Target: {target.entityType} {target.entityId || "not created yet"}</div>
          </div>
          <Button type="button" variant="secondary" size="sm" icon={<FileUp size={14} />} onClick={() => fileRef.current?.click()}>
            Select files
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
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
            {uploadingDocs ? "Uploading…" : "Attach to Dealius"}
          </Button>
        </div>
      </section>
    </div>
  );
}
