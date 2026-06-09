import { DealiusClient, resolveBrokerContactId } from "./dealiusClient";
import { authenticateConfiguredDealius } from "./dealiusAuth";
import { getDealiusUserDirectory } from "./dealiusUserDirectory";

type RentRowInput = { months?: unknown; monthly?: unknown; free?: unknown };
type BrokerRowInput = { name?: unknown; brokerName?: unknown; fullName?: unknown; pct?: unknown; percent?: unknown; commissionPct?: unknown };
type ListingSpaceInput = { suite?: unknown; name?: unknown; sqft?: unknown; askingRate?: unknown; availableDate?: unknown; comments?: unknown };

type NormalizedRentRow = { months: number; monthly: number | null; free: boolean };
type NormalizedBrokerRow = { name: string; pct: number | null; lead?: boolean; side?: string };
type NormalizedListingSpace = { suite: string; sqft: number; askingRate: number | null; availableDate?: unknown; comments: string };

export type DealiusDealEntry = Record<string, unknown> & {
  entryMode?: "deal";
  dealName?: unknown;
  address?: unknown;
  city?: unknown;
  zip?: unknown;
};

export type DealiusListingEntry = Record<string, unknown> & {
  entryMode?: "listing";
  listingName?: unknown;
  address?: unknown;
  city?: unknown;
  zip?: unknown;
};

/** Dealius lookup: 1 = per month, 2 = per year (annual). */
export const DEALIUS_RATE_PER_SF_MONTH = 1;
export const DEALIUS_RATE_PER_SF_YEAR = 2;

type PushLog = {
  warnings: string[];
  steps: Array<{ key: string; ok: boolean; detail?: string }>;
};

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function num(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInt(raw: unknown): number | null {
  const n = num(raw);
  if (n == null || n <= 0) return null;
  return Math.round(n);
}

function parseAddressParts(raw: string): { address?: string; city?: string; state?: string; zip?: string } {
  const match = raw.match(
    /^\s*(.+?)(?:,\s*|\s+)([A-Za-z][A-Za-z.\- ]+?)(?:,\s*|\s+)([A-Za-z]{2}|California)(?:\s+(\d{5}(?:-\d{4})?))?\s*$/
  );
  if (!match) return {};
  const [, address, city, state, zip] = match;
  return {
    address: address.trim(),
    city: city.trim(),
    state: state.toLowerCase() === "california" ? "CA" : state.toUpperCase(),
    zip: zip ? zip.replace(/\D/g, "").slice(0, 5) : undefined,
  };
}

function feePercentFrom(raw: unknown): number | null {
  const n = num(raw);
  if (n == null || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}

function firstFeePercent(p: Record<string, unknown>): number | null {
  const candidates: unknown[] = [
    p.feePercent,
    p.feePct,
    p.clientRepFee,
    p.oppositeSideRepFee,
    p.commissionRate,
    p.commissionPct,
    p.commRate,
    p.commPct,
    p.saleCommPct,
    p.dx_saleCommPct,
    p.voucherCommissionPct,
    p.voucherCommissionRate,
    p.lCommRate,
    p.sCommPct,
  ];
  for (const c of candidates) {
    const pct = feePercentFrom(c);
    if (pct != null) return pct;
  }
  return null;
}

function asRentRows(raw: unknown): NormalizedRentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: RentRowInput) => {
      const months = Math.max(0, Math.round(num(r?.months) ?? 0));
      const monthly = num(r?.monthly);
      return {
        months,
        monthly,
        free: Boolean(r?.free) || (monthly ?? 0) === 0,
      };
    })
    .filter(r => r.months > 0);
}

function asBrokers(raw: unknown): NormalizedBrokerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: BrokerRowInput & { lead?: unknown }) => {
      const pct = num(b?.pct ?? b?.percent ?? b?.commissionPct);
      return {
        name: str(b?.name || b?.brokerName || b?.fullName),
        pct,
        lead: Boolean(b?.lead),
        side: str((b as any)?.side),
      };
    })
    .filter(b => b.name);
}

function asListingSpaces(raw: unknown): NormalizedListingSpace[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((space: ListingSpaceInput) => ({
      suite: str(space?.suite || space?.name),
      sqft: positiveInt(space?.sqft) ?? 0,
      askingRate: num(space?.askingRate),
      availableDate: space?.availableDate,
      comments: str(space?.comments),
    }))
    .filter(space => space.suite || space.sqft > 0 || space.askingRate != null || space.comments);
}

function boolish(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  const value = str(raw).toLowerCase();
  return value === "true" || value === "yes" || value === "y" || value === "1";
}

function uniqNames(names: Array<unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const value = str(n);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizePropertyType(raw: unknown): string {
  const value = str(raw);
  const v = value.toLowerCase();
  if (v.includes("industrial")) return "Industrial";
  if (v.includes("office")) return "Office";
  if (v.includes("retail")) return "Retail";
  if (v.includes("land")) return "Land";
  if (v.includes("multi")) return "Multi-Family";
  if (v.includes("medical")) return "Medical";
  return value || "Industrial";
}

function propertyTypeIdFrom(raw: unknown): number {
  const v = normalizePropertyType(raw).toLowerCase();
  const map: Record<string, number> = {
    retail: 1,
    office: 2,
    industrial: 3,
    "multi-family": 4,
    multifamily: 4,
    land: 5,
    medical: 8,
  };
  return map[v] ?? 3;
}

function repTypeIdFrom(raw: unknown): number {
  const v = str(raw).toLowerCase();
  if (!v) return 4;
  if (v.includes("tenant")) return 3;
  if (v.includes("landlord")) return 4;
  if (v.includes("buyer")) return 1;
  if (v.includes("seller")) return 2;
  if (v.includes("referr") || v.includes("other")) return 5;
  return positiveInt(raw) ?? 4;
}

function dealTypeIdFrom(raw: unknown, params: { isSale: boolean; isReferral: boolean }): number {
  const direct = positiveInt(raw);
  if (direct != null) return direct;
  const value = str(raw).toLowerCase();
  if (value.includes("sale") || value.includes("sold") || params.isSale) return 2;
  if (value.includes("referr") || value.includes("other") || params.isReferral) return 3;
  return 1;
}

function isSaleLike(p: Record<string, unknown>): boolean {
  const value = str(p.transactionType ?? p.txnType ?? p.listingTransaction ?? "").toLowerCase();
  return value.includes("sale") || value.includes("sold");
}

function isLeaseLike(p: Record<string, unknown>): boolean {
  if (isSaleLike(p)) return false;
  const value = str(p.transactionType ?? p.txnType ?? "").toLowerCase();
  const rep = str(p.representationType ?? "").toLowerCase();
  return !value || value.includes("lease") || value.includes("leasing") || value.includes("renew") || rep.includes("tenant") || rep.includes("landlord");
}

/** Dealius / ASP.NET payloads often nest the entity under `Data` or camelCase `data`. */
function unwrapDealiusEntity(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;
  if ("Data" in o && o.Data != null) return o.Data;
  if ("data" in o && o.data != null) return o.data;
  return data;
}

function idFrom(data: unknown, keys: string[]): number | null {
  const asInt = positiveInt(data);
  if (asInt != null) return asInt;

  if (data && typeof data === "object") {
    const unwrapped = unwrapDealiusEntity(data);
    const unwrappedInt = positiveInt(unwrapped);
    if (unwrappedInt != null) return unwrappedInt;

    if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
      const target = unwrapped as Record<string, unknown>;
      for (const key of keys) {
        const id = positiveInt(target[key]);
        if (id != null) return id;
      }
      const lowerToActual = new Map<string, string>();
      for (const k of Object.keys(target)) {
        lowerToActual.set(k.toLowerCase(), k);
      }
      for (const key of keys) {
        const actual = lowerToActual.get(key.toLowerCase());
        if (actual) {
          const id = positiveInt(target[actual]);
          if (id != null) return id;
        }
      }
    }
  }

  return null;
}

function listFrom(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.Data)) return o.Data as any[];
    if (Array.isArray(o.data)) return o.data as any[];
  }
  return [];
}

/** Best-effort message from Dealius JSON (including HTTP 200 error envelopes). */
function dealiusErrorDetail(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data.trim().slice(0, 400);
  if (typeof data !== "object") return String(data).slice(0, 400);
  const o = data as Record<string, unknown>;
  const inner = unwrapDealiusEntity(data);
  if (inner !== data) {
    const nested = dealiusErrorDetail(inner);
    if (nested) return nested;
  }
  const msg = str(o.Message ?? o.message ?? o.ErrorMessage ?? o.errorMessage ?? o.error ?? o.title);
  if (msg) return msg.slice(0, 500);
  const errs = o.Errors ?? o.errors;
  if (errs && typeof errs === "object") {
    try {
      const s = JSON.stringify(errs);
      if (s && s !== "{}") return s.slice(0, 500);
    } catch {
      /* ignore */
    }
  }
  try {
    const s = JSON.stringify(data);
    return s.length > 400 ? s.slice(0, 400) + "…" : s;
  } catch {
    return "";
  }
}

function omitEmpty<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function isoDate(raw: unknown): string | undefined {
  const value = str(raw);
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function todayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addressPartsFromEntry(entry: Record<string, unknown>) {
  const rawAddress = str(entry.address || entry.propertyAddress || entry.property || "");
  const parts = parseAddressParts(rawAddress);
  const hasStructuredPlace = Boolean(str(entry.city) || str(entry.zip || entry.zipCode));
  const address = hasStructuredPlace ? rawAddress : parts.address || rawAddress;
  return {
    address,
    city: str(entry.city || parts.city),
    zip: str(entry.zip || entry.zipCode || parts.zip),
  };
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

function dealNamePrefixFromTransaction(entry: Record<string, unknown>, isSale: boolean): string {
  const value = str(entry.transactionType ?? entry.txnType ?? entry.dealType ?? entry.dealName ?? "").toLowerCase();
  if (value.includes("consult")) return "Consulting";
  if (value.includes("renew")) return "Renewed";
  if (value.includes("sold") || value.includes("sale") || value.includes("purchase")) return "Sold";
  if (value.includes("lease") || value.includes("leased")) return "Leased";
  return isSale ? "Sold" : "Leased";
}

function normalizeDealEntry(entry: Record<string, unknown>) {
  const { address, city, zip } = addressPartsFromEntry(entry);
  const isSale = isSaleLike(entry);
  const isLease = !isSale && isLeaseLike(entry);
  const propertyType = normalizePropertyType(entry.propertyType || entry.propType || entry.subType || entry.occType);
  const sqft =
    positiveInt(entry.sqft || entry.dealSF || entry.lDealSF || entry.leasedSqFt || entry.squareFeet || entry.sizeSF) ?? 1;
  const totalBldgSF = positiveInt(entry.totalBldgSF || entry.bldgSF || entry.buildingSF || entry.buildingSizeSf);
  const suite = str(entry.suite || entry.unit);
  const propertyName = propertyNameFromAddressSuite(address, suite);
  const clientCo = str(entry.clientCo || entry.lessorName || entry.sellerName || entry.lsCompany);
  const clientContactName = str(entry.clientContactName || entry.clientContact || entry.lsContact);
  const brokersRaw = asBrokers(entry.brokers || entry.internalBrokers || entry.commissionBrokers);
  const fallbackBrokers = uniqNames([
    entry.listingAgentName,
    entry.procuringAgentName,
    entry.laName,
    entry.paName,
    entry.brokerName,
    entry.agentName,
    entry.submittedBy,
  ]).map((name, index) => ({ name, pct: null, lead: index === 0 }));
  const brokerSides = brokersRaw.map(b => str(b.side).toLowerCase());
  const representedBothSides =
    boolish(entry.representedBothSides || entry.bothSides || entry.brokerRepresentedBothSides) ||
    (brokerSides.some(side => side.includes("listing")) && brokerSides.some(side => side.includes("procur")));
  const repTypeID = isLease && representedBothSides ? 4 : (positiveInt(entry.repTypeID || entry.repType) ?? repTypeIdFrom(entry.representationType));
  const isReferral = repTypeID === 5;

  let dealName = `${dealNamePrefixFromTransaction(entry, isSale)}: ${propertyName || "New Deal"}`;
  if (isReferral) {
    dealName = `Referred: ${propertyName || "New Deal"}`.replace(/\s+/g, " ").trim();
  }
  const feePercent = firstFeePercent(entry);

  return {
    dealName,
    repTypeID,
    isReferral,
    dealTypeID: dealTypeIdFrom(entry.dealTypeID || entry.dealType || entry.transactionType || entry.txnType, {
      isSale,
      isReferral,
    }),
    dealStatusID: positiveInt(entry.dealStatusID || entry.statusID || entry.dealStatus) ?? 1,
    probability: 100,
    representedBothSides,
    isLease,
    isSale,
    address,
    city,
    zip,
    suite,
    propertyName,
    propertyType,
    propertyTypeID: propertyTypeIdFrom(propertyType),
    sqft,
    totalBldgSF: totalBldgSF ?? sqft,
    yearBuilt: positiveInt(entry.yearBuilt),
    clearHeight: num(entry.clearHeight || entry.clearance),
    dhDoors: positiveInt(entry.dhDoors || entry.dh),
    glDoors: positiveInt(entry.glDoors || entry.gl),
    numParkingSpaces: positiveInt(entry.numParkingSpaces || entry.parkingSpaces),
    indSF: positiveInt(entry.indSF),
    officeSF: positiveInt(entry.officeSF),
    landSF: positiveInt(entry.landSF),
    bldgClass: str(entry.bldgClass),
    numFloors: positiveInt(entry.numFloors || entry.floors),
    parkRatio: str(entry.parkRatio),
    rail: str(entry.rail),
    clientCo: str(entry.clientCo || entry.lessorName || entry.sellerName || entry.lsCompany),
    oppositeCo: str(entry.oppositeCo || entry.lesseeName || entry.buyerName || entry.lbCompany),
    clientContactName: str(entry.clientContactName || entry.clientContact || entry.lsContact),
    clientContactEmail: str(entry.clientContactEmail || entry.clientEmail || entry.lsEmail),
    clientContactPhone: str(entry.clientContactPhone || entry.clientPhone || entry.lsPhone),
    oppositeContactName: str(entry.oppositeContactName || entry.oppositeContact || entry.lbContact),
    oppositeContactEmail: str(entry.oppositeContactEmail || entry.oppositeEmail || entry.lbEmail),
    oppositeContactPhone: str(entry.oppositeContactPhone || entry.oppositePhone || entry.lbPhone),
    startDate: entry.startDate || entry.lStart || entry.leaseStart,
    endDate: entry.endDate || entry.lEnd || entry.leaseEnd,
    occupancyDate: entry.occupancyDate || entry.lOcc,
    term: positiveInt(entry.term || entry.lTerm || entry.leaseTerm),
    askingRate: num(entry.askingRate || entry.lAskingRate || entry.lRate),
    totalNNN: num(entry.totalNNN || entry.lNnnTotal),
    propTaxes: num(entry.propTaxes),
    insurance: num(entry.insurance),
    opex: num(entry.opex),
    cams: num(entry.cams),
    tiPerSF: num(entry.tiPerSF || entry.lTiSF),
    escalation: num(entry.escalation || entry.lEscalations),
    totalConsideration: num(entry.totalConsideration || entry.sPrice || entry.lConsideration || entry.salePrice),
    feePercent: isReferral ? feePercent ?? 100 : feePercent,
    paymentDate: entry.paymentDate,
    paymentAmount: num(entry.paymentAmount || entry.commissionAmount || entry.referralFee || entry.totalInvoice || entry.invoiceAmount),
    rentRows: asRentRows(entry.rentRows || entry.rentSchedule),
    brokers: brokersRaw.length ? brokersRaw : fallbackBrokers,
  };
}

function normalizeListingEntry(entry: Record<string, unknown>) {
  const { address, city, zip } = addressPartsFromEntry(entry);
  const transaction = str(entry.listingTransaction || entry.transactionType || entry.txnType || "lease").toLowerCase();
  const isSale = transaction.includes("sale") && !transaction.includes("lease");
  const propertyType = normalizePropertyType(entry.propertyType || entry.propType || entry.subType);
  const rawSpaces = asListingSpaces(entry.spaces || entry.listingSpaces);
  const spacesSqft = rawSpaces.reduce((sum, space) => sum + Math.max(0, space.sqft), 0);
  const sqft =
    positiveInt(entry.sqft || entry.suiteSF || entry.dealSF || entry.sizeSF || entry.spaceSF || entry.leasedSqFt) ?? spacesSqft;
  const totalBldgSF = positiveInt(entry.totalBldgSF || entry.bldgSF || entry.buildingSF || entry.sizeSF);
  const suitesRaw = str(entry.suites || entry.suite || entry.unit);
  const suites = suitesRaw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const spaces = rawSpaces.length
    ? rawSpaces.map(space => ({ ...space, sqft: space.sqft || sqft || totalBldgSF || 0 }))
    : suites.length
      ? suites.map(suite => ({ suite, sqft: sqft || totalBldgSF || 0, askingRate: null, availableDate: undefined, comments: "" }))
      : [{ suite: "", sqft: sqft || totalBldgSF || 0, askingRate: null, availableDate: undefined, comments: "" }];
  const propertyName = propertyNameFromAddressSuite(address, suites.length === 1 ? suites[0] : "");
  const brokers = asBrokers(entry.brokers || entry.agents || entry.listingAgents);

  return {
    listingName: str(entry.listingName || entry.dealName) || propertyName || address || "New Listing",
    transactionType: isSale ? "Sale" : transaction.includes("sublease") ? "Sublease" : transaction.includes("sale or lease") ? "Sale or Lease" : "Lease",
    address,
    city,
    zip,
    suites,
    propertyName,
    propertyType,
    propertyTypeID: propertyTypeIdFrom(propertyType),
    sqft,
    totalBldgSF: totalBldgSF ?? sqft,
    spaces,
    yearBuilt: positiveInt(entry.yearBuilt),
    ownerCompany: str(entry.ownerCompany || entry.owner || entry.clientCo || entry.lessorName || entry.sellerName),
    askingRate: num(entry.askingRate || entry.leaseRate || entry.rate),
    commission: feePercentFrom(entry.commission || entry.commissionPercent || entry.saleCommPct || entry.feePercent),
    listingStartDate: entry.listingStartDate || entry.listingStart,
    listingExpiryDate: entry.listingExpiryDate || entry.listingExpiration || entry.listingExpiry,
    listingAvailableDate: entry.listingAvailableDate || entry.availableDate,
    listingStatus: str(entry.listingStatus || "active"),
    listingSource: str(entry.listingSource || "Admin portal"),
    listingNotes: str(entry.listingNotes || entry.notes),
    brokers,
  };
}

export function buildDealEntryFromSubmissionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const p = payload && typeof payload === "object" ? payload : {};
  const nested = p.voucherData && typeof p.voucherData === "object" ? (p.voucherData as Record<string, unknown>) : {};
  return { ...p, ...nested };
}

export function validateDealEntryForDealiusPush(entry: Record<string, unknown>): { ok: true } | { ok: false; errors: string[] } {
  const d = normalizeDealEntry(entry);
  const errors: string[] = [];
  if (!d.address) errors.push("Missing property address.");
  if (!d.city) errors.push("Missing city.");
  if (!d.zip) errors.push("Missing zip.");
  if (!d.dealName) errors.push("Missing deal name.");
  if (!d.clientCo) errors.push("Missing client company.");
  // Referred / other deals (repTypeID 5) do not require a fee percent or rent schedule.
  if (d.repTypeID !== 5) {
    if (d.feePercent == null || d.feePercent <= 0) errors.push("Missing fee percent.");
    if (d.isLease && d.rentRows.length === 0) errors.push("Lease-like deal requires at least one rent schedule row.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export function validateListingEntryForDealiusPush(entry: Record<string, unknown>): { ok: true } | { ok: false; errors: string[] } {
  const l = normalizeListingEntry(entry);
  const errors: string[] = [];
  if (!l.address) errors.push("Missing property address.");
  if (!l.city) errors.push("Missing city.");
  if (!l.zip) errors.push("Missing zip.");
  if ((!l.sqft || l.sqft <= 0) && !l.spaces.some(space => space.sqft > 0)) errors.push("Missing space square footage.");
  if (!l.listingName) errors.push("Missing listing name.");
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

/** Map client/opposite (who we represent vs other side) to lessee/lessor for Dealius lease deals. */
export function leasePartiesFromClientOpposite(params: {
  repTypeID: number;
  clientCo: string;
  oppositeCo: string;
  clientID: number | null;
  oppositeID: number | null;
  clientContactID: number | null;
  oppositeContactID: number | null;
}) {
  const isTenantRep = params.repTypeID === 3;
  const isLandlordRep = params.repTypeID === 4;
  const lesseeID = isTenantRep ? params.clientID : params.oppositeID;
  const lessorID = isLandlordRep ? params.clientID : params.oppositeID;
  const lesseeCo = isTenantRep ? params.clientCo : params.oppositeCo;
  const lessorCo = isLandlordRep ? params.clientCo : params.oppositeCo;
  const lesseeContactID = isTenantRep ? params.clientContactID : params.oppositeContactID;
  const lessorContactID = isLandlordRep ? params.clientContactID : params.oppositeContactID;
  return { lesseeID, lessorID, lesseeCo, lessorCo, lesseeContactID, lessorContactID };
}

async function resolveCompanyId(params: {
  client: DealiusClient;
  token: string;
  name: string;
  log: PushLog;
}): Promise<number | null> {
  const cleanName = params.name.trim();
  if (cleanName.length < 2) return null;
  const needle = cleanName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  try {
    const search = await params.client.request<any>({
      token: params.token,
      method: "GET",
      path: `/companies?PageSize=50&SearchTerm=${encodeURIComponent(cleanName)}`,
    });
    const valid = listFrom(search.data).filter(c => positiveInt(c.CompanyID) != null);
    const exact = valid.find(c => str(c.Name).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim() === needle);
    if (exact) return positiveInt(exact.CompanyID);
    const fuzzy = valid.find(c => {
      const name = str(c.Name).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      return needle.length >= 5 && (name.startsWith(needle.slice(0, 8)) || needle.startsWith(name.slice(0, 8)));
    });
    if (fuzzy) return positiveInt(fuzzy.CompanyID);
  } catch (error) {
    params.log.warnings.push(`Company search failed for ${cleanName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const created = await params.client.request<any>({
    token: params.token,
    method: "POST",
    path: "/companies",
    data: { Name: cleanName, Types: 1 },
  });
  const createdId = idFrom(created.data, ["CompanyID", "ID", "id"]);
  if (created.status >= 200 && created.status < 300 && createdId) return createdId;

  if (created.status === 409) {
    const retry = await params.client.request<any>({
      token: params.token,
      method: "GET",
      path: `/companies?PageSize=50&SearchTerm=${encodeURIComponent(cleanName)}`,
    });
    const first = listFrom(retry.data).find(c => positiveInt(c.CompanyID) != null);
    const id = first ? positiveInt(first.CompanyID) : null;
    if (id) return id;
  }

  params.log.warnings.push(`Could not resolve company "${cleanName}".`);
  return null;
}

async function resolveContactId(params: {
  client: DealiusClient;
  token: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyID: number;
  log: PushLog;
}): Promise<number | null> {
  const fullName = params.fullName.trim();
  if (!fullName) return null;
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || firstName;
  const email = str(params.email).toLowerCase();

  try {
    const search = await params.client.request<any>({
      token: params.token,
      method: "GET",
      path: `/contacts?PageSize=20&SearchTerm=${encodeURIComponent(fullName)}`,
    });
    const list = listFrom(search.data);
    const emailMatch = email
      ? list.find(c => positiveInt(c.ContactID) != null && str(c.Email).toLowerCase() === email)
      : null;
    if (emailMatch) return positiveInt(emailMatch.ContactID);
    const nameMatch = list.find(
      c =>
        positiveInt(c.ContactID) != null &&
        positiveInt(c.CompanyID) === params.companyID &&
        str(c.ContactName || c.FullName).toLowerCase().includes(firstName.toLowerCase())
    );
    if (nameMatch) return positiveInt(nameMatch.ContactID);
  } catch (error) {
    params.log.warnings.push(`Contact search failed for ${fullName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const created = await params.client.request<any>({
    token: params.token,
    method: "POST",
    path: "/contacts",
    data: omitEmpty({
      FirstName: firstName,
      LastName: lastName,
      Email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, "")}@placeholder.com`,
      CompanyID: params.companyID,
      MobilePhone: params.phone,
      Categories: 1,
    }),
  });
  const id = idFrom(created.data, ["ContactID", "ID", "id"]);
  if (created.status >= 200 && created.status < 300 && id) return id;
  params.log.warnings.push(`Could not resolve contact "${fullName}".`);
  return null;
}

async function createProperty(params: {
  client: DealiusClient;
  token: string;
  address: string;
  city: string;
  zip: string;
  propertyTypeID: number;
  sqft: number;
  totalBldgSF: number;
  yearBuilt: number | null;
  log: PushLog;
}): Promise<number> {
  const payload = omitEmpty({
    Name: params.address,
    AddressLine1: params.address,
    City: params.city || "Unknown",
    StateID: 1004,
    Zip: params.zip || "00000",
    PropertyTypeID: params.propertyTypeID,
    Latitude: 0,
    Longitude: 0,
    SquareFootage: Math.max(1, Math.round(params.sqft)),
    BuildingSizeSf: Math.max(1, Math.round(params.totalBldgSF)),
    YearBuilt: params.yearBuilt || undefined,
  });

  const res = await params.client.request<any>({ token: params.token, method: "POST", path: "/properties", data: payload });
  const id = idFrom(res.data, ["PropertyID", "ID", "id"]);
  if (res.status >= 200 && res.status < 300 && id) return id;

  if (res.status === 409) {
    const retry = await params.client.request<any>({
      token: params.token,
      method: "GET",
      path: `/properties?SearchTerm=${encodeURIComponent(params.address)}&PageSize=5`,
    });
    const found = listFrom(retry.data).find(p => idFrom(p, ["PropertyID", "ID", "id"]) != null);
    const foundId = found ? idFrom(found, ["PropertyID", "ID", "id"]) : null;
    if (foundId) {
      params.log.warnings.push(`Using existing Dealius property ${foundId} after duplicate response.`);
      return foundId;
    }
  }

  const detail = dealiusErrorDetail(res.data);
  throw new Error(
    detail
      ? `Dealius property create failed (HTTP ${res.status}): ${detail}`
      : `Dealius property create failed (HTTP ${res.status}).`
  );
}

async function createSpace(params: {
  client: DealiusClient;
  token: string;
  propertyID: number;
  name: string;
  address: string;
  city: string;
  zip: string;
  suite?: string;
  propertyTypeID: number;
  sqft: number;
  yearBuilt: number | null;
  details?: Record<string, unknown>;
}): Promise<number | null> {
  const payload = omitEmpty({
    Name: params.name,
    SpaceTypeID: params.propertyTypeID,
    SpaceAvailableSf: Math.max(1, Math.round(params.sqft)),
    StreetAddress: params.address,
    SuiteNumber: params.suite,
    City: params.city || "Unknown",
    StateID: 1004,
    Zip: params.zip || "00000",
    YearBuilt: params.yearBuilt || undefined,
    Details: params.details && Object.keys(params.details).length ? params.details : undefined,
  });
  const res = await params.client.request<any>({
    token: params.token,
    method: "POST",
    path: `/properties/${params.propertyID}/spaces`,
    data: payload,
  });
  if (res.status < 200 || res.status >= 300) return null;
  return idFrom(res.data, ["PropertySpaceID", "ID", "id"]);
}

export async function pushDealEntryToDealius(params: { entry: Record<string, unknown> }) {
  const validation = validateDealEntryForDealiusPush(params.entry);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const d = normalizeDealEntry(params.entry);
  const log: PushLog = { warnings: [], steps: [] };
  const client = new DealiusClient();
  const token = await authenticateConfiguredDealius(client);
  const directory = getDealiusUserDirectory();
  const estimatedCloseDate = todayIsoDate();

  const propertyID = await createProperty({
    client,
    token,
    address: d.propertyName,
    city: d.city,
    zip: d.zip,
    propertyTypeID: d.propertyTypeID,
    sqft: d.sqft,
    totalBldgSF: d.totalBldgSF,
    yearBuilt: d.yearBuilt,
    log,
  });
  log.steps.push({ key: "property", ok: true, detail: String(propertyID) });

  const spaceDetails = omitEmpty({
    BuildingClass: d.bldgClass || undefined,
    ClearHeight: d.clearHeight || undefined,
    IndustrialSF: d.indSF || undefined,
    OfficeSF: d.officeSF || undefined,
    NumberOfParkingSpaces: d.numParkingSpaces || undefined,
    NumberOfGLDoors: d.glDoors || undefined,
    NumberOfTruckLevelDoors: d.dhDoors || undefined,
    NumberOfFloors: d.numFloors || undefined,
    RailLine: d.rail || undefined,
    Zoning: d.parkRatio || undefined,
  });
  const propertySpaceID = await createSpace({
    client,
    token,
    propertyID,
    name: d.propertyName,
    address: d.address,
    city: d.city,
    zip: d.zip,
    suite: d.suite,
    propertyTypeID: d.propertyTypeID,
    sqft: d.sqft,
    yearBuilt: d.yearBuilt,
    details: spaceDetails,
  });
  log.steps.push({ key: "space", ok: Boolean(propertySpaceID), detail: propertySpaceID ? String(propertySpaceID) : "Skipped" });

  const clientID = d.clientCo ? await resolveCompanyId({ client, token, name: d.clientCo, log }) : null;
  const oppositeID = d.oppositeCo ? await resolveCompanyId({ client, token, name: d.oppositeCo, log }) : null;
  log.steps.push({ key: "companies", ok: Boolean(clientID || oppositeID), detail: [clientID, oppositeID].filter(Boolean).join(", ") });

  const clientContactID =
    clientID && d.clientContactName
      ? await resolveContactId({
          client,
          token,
          fullName: d.clientContactName,
          email: d.clientContactEmail,
          phone: d.clientContactPhone,
          companyID: clientID,
          log,
        })
      : null;
  const oppositeContactID =
    oppositeID && d.oppositeContactName
      ? await resolveContactId({
          client,
          token,
          fullName: d.oppositeContactName,
          email: d.oppositeContactEmail,
          phone: d.oppositeContactPhone,
          companyID: oppositeID,
          log,
        })
      : null;

  const leaseParties = d.isLease
    ? leasePartiesFromClientOpposite({
        repTypeID: d.repTypeID,
        clientCo: d.clientCo,
        oppositeCo: d.oppositeCo,
        clientID,
        oppositeID,
        clientContactID,
        oppositeContactID,
      })
    : null;

  const dealPayload = omitEmpty({
    DealName: d.dealName,
    RepresentationTypeID: d.repTypeID,
    DealTypeID: d.dealTypeID,
    DealStatusID: d.dealStatusID,
    Probability: d.probability,
    SpaceTypeID: d.propertyTypeID,
    EstimatedCloseDate: estimatedCloseDate,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceID || undefined,
    ClientID: clientID || undefined,
    Client: d.clientCo || undefined,
    OppositeSideID: oppositeID || undefined,
    OppositeSide: d.oppositeCo || undefined,
    ClientRepFee: d.feePercent ?? undefined,
    OppositeSideRepFee: d.feePercent ?? undefined,
    ...(d.isLease && leaseParties
      ? omitEmpty({
          LeaseTypeID: 1003,
          LeaseTerm: d.term,
          LeaseCommencementDate: isoDate(d.startDate),
          LeaseTermDate: isoDate(d.endDate),
          LeaseOccupancyDate: isoDate(d.occupancyDate),
          LeaseCurrentSquareFeetOccupied: d.sqft,
          RequestedSpace: d.sqft,
          LesseeID: leaseParties.lesseeID || undefined,
          LessorID: leaseParties.lessorID || undefined,
          Lessee: leaseParties.lesseeCo || undefined,
          Lessor: leaseParties.lessorCo || undefined,
        })
      : {}),
    ...(d.isSale
      ? omitEmpty({
          SaleAskingPriceAmount: d.totalConsideration,
          SalePurchasePriceAmount: d.totalConsideration,
        })
      : {}),
    PaymentDate: isoDate(d.paymentDate),
    PaymentAmount: d.paymentAmount ?? undefined,
  });

  const dealRes = await client.request<any>({ token, method: "POST", path: "/deals", data: dealPayload });
  const dealID = idFrom(dealRes.data, ["DealID", "ID", "id"]);
  if (!dealID) {
    const detail = dealiusErrorDetail(dealRes.data);
    throw new Error(
      detail
        ? `Dealius deal create failed (HTTP ${dealRes.status}): ${detail}`
        : `Dealius deal create failed (HTTP ${dealRes.status}).`
    );
  }
  log.steps.push({ key: "deal", ok: true, detail: String(dealID) });

  const contactIdsToLink = new Set<number>();
  for (const contactID of [clientContactID, oppositeContactID].filter(Boolean) as number[]) {
    contactIdsToLink.add(contactID);
  }
  if (leaseParties) {
    for (const contactID of [leaseParties.lesseeContactID, leaseParties.lessorContactID].filter(Boolean) as number[]) {
      contactIdsToLink.add(contactID);
    }
  }
  for (const contactID of contactIdsToLink) {
    const link = await client.request<any>({
      token,
      method: "POST",
      path: "/deals/contacts/add",
      data: { DealID: dealID, ContactID: contactID },
    });
    if (link.status < 200 || link.status >= 300) log.warnings.push(`Contact ${contactID} was not linked to deal ${dealID}.`);
  }

  const feeFraction = d.feePercent != null && d.feePercent > 1 ? d.feePercent / 100 : d.feePercent;
  const financialPayload = omitEmpty({
    DealID: dealID,
    DealName: d.dealName,
    ClientID: clientID || undefined,
    OppositeSideID: oppositeID || undefined,
    OppositeSide: d.oppositeCo || undefined,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceID || undefined,
    ...(d.feePercent != null ? { ClientRepFee: d.feePercent, OppositeSideRepFee: d.feePercent } : {}),
    LeaseCommencementDate: isoDate(d.startDate),
    LeaseTermDate: isoDate(d.endDate),
    LeaseOccupancyDate: isoDate(d.occupancyDate),
    LeaseTerm: d.rentRows.reduce((sum, row) => sum + row.months, 0) || d.term || undefined,
    LeaseTypeID: d.isLease ? 1003 : undefined,
    LeaseCurrentSquareFeetOccupied: d.isLease ? d.sqft : undefined,
    RequestedSpace: d.isLease ? d.sqft : undefined,
    ...(leaseParties
      ? omitEmpty({
          LesseeID: leaseParties.lesseeID || undefined,
          LessorID: leaseParties.lessorID || undefined,
          Lessee: leaseParties.lesseeCo || undefined,
          Lessor: leaseParties.lessorCo || undefined,
        })
      : {}),
    LeaseAskingRatePerSf: d.askingRate ?? undefined,
    LeaseAskingRatePerSfType: d.askingRate != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseNNNPerSF: d.totalNNN ?? undefined,
    LeaseNNNPerSFType: d.totalNNN != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseTaxes: d.propTaxes ?? undefined,
    LeaseTaxesType: d.propTaxes != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseInsurance: d.insurance ?? undefined,
    LeaseInsuranceType: d.insurance != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseOpex: d.opex ?? undefined,
    LeaseOpexType: d.opex != null ? 2 : undefined,
    LeaseCamsPerSf: d.cams ?? undefined,
    LeaseCamsPerSfType: d.cams != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseTiAllowancePerSf: d.tiPerSF ?? undefined,
    LeaseTiAllowancePerSfType: d.tiPerSF != null ? DEALIUS_RATE_PER_SF_YEAR : undefined,
    LeaseAvgEscalation: d.escalation ?? undefined,
    LeaseAvgEscalationType: d.escalation != null ? 2 : undefined,
    ...(d.isLease && d.rentRows.length ? { RentPerSfType: DEALIUS_RATE_PER_SF_MONTH } : {}),
    SaleAskingPriceAmount: d.isSale ? d.totalConsideration ?? undefined : undefined,
    SalePurchasePriceAmount: d.isSale ? d.totalConsideration ?? undefined : undefined,
    PaymentDate: isoDate(d.paymentDate),
    PaymentAmount: d.paymentAmount ?? undefined,
  });
  const put = await client.request<any>({ token, method: "PUT", path: "/deals", data: financialPayload });
  if (put.status < 200 || put.status >= 300) {
    const retryPayload = omitEmpty({
      ...financialPayload,
      ClientRepFee: feeFraction ?? undefined,
      OppositeSideRepFee: feeFraction ?? undefined,
    });
    const retry = await client.request<any>({ token, method: "PUT", path: "/deals", data: retryPayload });
    if (retry.status < 200 || retry.status >= 300) {
      log.warnings.push(`Financial update returned HTTP ${put.status} (retry HTTP ${retry.status}).`);
    }
  }
  log.steps.push({ key: "financials", ok: true });

  if (d.isLease && d.rentRows.length) {
    const rents = d.rentRows.map((r, index) => ({
      PeriodNo: index + 1,
      Months: r.months,
      MonthlyRatePerSf: r.free ? null : Number(((r.monthly ?? 0) / Math.max(1, d.sqft)).toFixed(6)),
    }));
    const primary = await client.request<any>({
      token,
      method: "POST",
      path: "/deals/rents",
      data: { DealID: dealID, RentPerSfType: DEALIUS_RATE_PER_SF_MONTH, Rents: rents },
    });
    if (primary.status < 200 || primary.status >= 300) {
      const fallback = rents.map(r => ({ ...r, MonthlyRatePerSf: r.MonthlyRatePerSf == null ? 0 : r.MonthlyRatePerSf }));
      const retry = await client.request<any>({
        token,
        method: "POST",
        path: "/deals/rents",
        data: { DealID: dealID, RentPerSfType: DEALIUS_RATE_PER_SF_MONTH, Rents: fallback },
      });
      if (retry.status < 200 || retry.status >= 300) {
        log.warnings.push(`Rent schedule returned HTTP ${primary.status} (retry HTTP ${retry.status}).`);
      }
    }
  }
  log.steps.push({ key: "rent", ok: !d.isLease || d.rentRows.length > 0, detail: `${d.rentRows.length} row(s)` });

  if (d.brokers.length) {
    const rows: any[] = [];
    for (const broker of d.brokers) {
      const contactID = await resolveBrokerContactId({ client, token, name: broker.name, directory });
      if (!contactID) {
        log.warnings.push(`Broker "${broker.name}" was not resolved.`);
        continue;
      }
      const pct = broker.pct != null && broker.pct > 1 ? broker.pct / 100 : broker.pct ?? 0;
      rows.push({ DealID: dealID, ContactID: contactID, IsLead: broker.lead || rows.length === 0, Commission: pct * 100 });
    }
    if (rows.length) {
      const primary = await client.request<any>({
        token,
        method: "POST",
        path: "/deals/brokers",
        data: { DealID: dealID, DealBrokers: rows },
      });
      if (primary.status < 200 || primary.status >= 300) {
        const retry = await client.request<any>({
          token,
          method: "POST",
          path: "/deals/brokers",
          data: { DealID: dealID, DealBrokers: rows.map(r => ({ ...r, Commission: r.Commission / 100 })) },
        });
        if (retry.status < 200 || retry.status >= 300) {
          log.warnings.push(`Broker assignment returned HTTP ${primary.status} (retry HTTP ${retry.status}).`);
        }
      }
    }
  }
  log.steps.push({ key: "brokers", ok: true, detail: `${d.brokers.length} broker(s)` });

  return {
    entryMode: "deal" as const,
    dealID,
    dealName: d.dealName,
    propertyName: d.propertyName,
    estimatedCloseDate,
    propertyID,
    propertySpaceID,
    warnings: log.warnings,
    steps: log.steps,
    mockMode: token === "dummy-token",
  };
}

export async function pushListingEntryToDealius(params: { entry: Record<string, unknown> }) {
  const validation = validateListingEntryForDealiusPush(params.entry);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const l = normalizeListingEntry(params.entry);
  const log: PushLog = { warnings: [], steps: [] };
  const client = new DealiusClient();
  const token = await authenticateConfiguredDealius(client);
  const directory = getDealiusUserDirectory();

  const ownerCompanyID = l.ownerCompany ? await resolveCompanyId({ client, token, name: l.ownerCompany, log }) : null;
  log.steps.push({ key: "owner", ok: Boolean(ownerCompanyID || !l.ownerCompany), detail: ownerCompanyID ? String(ownerCompanyID) : "No owner linked" });

  const propertyID = await createProperty({
    client,
    token,
    address: l.propertyName,
    city: l.city,
    zip: l.zip,
    propertyTypeID: l.propertyTypeID,
    sqft: l.sqft,
    totalBldgSF: l.totalBldgSF,
    yearBuilt: l.yearBuilt,
    log,
  });
  log.steps.push({ key: "property", ok: true, detail: String(propertyID) });

  const propertySpaceIDs: number[] = [];
  for (const space of l.spaces) {
    const spaceName = propertyNameFromAddressSuite(l.address, space.suite);
    const id = await createSpace({
      client,
      token,
      propertyID,
      name: spaceName || l.propertyName,
      address: l.address,
      city: l.city,
      zip: l.zip,
      suite: space.suite,
      propertyTypeID: l.propertyTypeID,
      sqft: space.sqft || l.sqft,
      yearBuilt: l.yearBuilt,
      details: omitEmpty({
        AskingRate: space.askingRate ?? undefined,
        AvailableDate: isoDate(space.availableDate),
        Comments: space.comments || undefined,
      }),
    });
    if (id) propertySpaceIDs.push(id);
  }
  log.steps.push({ key: "spaces", ok: propertySpaceIDs.length > 0, detail: `${propertySpaceIDs.length} space(s)` });

  const listingPayload = omitEmpty({
    Name: l.listingName,
    CompanyID: ownerCompanyID || undefined,
    PropertyID: propertyID,
    PropertySpaceID: propertySpaceIDs[0] || undefined,
    TransactionType: l.transactionType,
    AskingRate: l.askingRate ?? undefined,
    AskingRateType: l.askingRate != null ? 2 : undefined,
    CommissionPercent: l.commission ?? undefined,
    ListingStartDate: isoDate(l.listingStartDate),
    ListingExpiryDate: isoDate(l.listingExpiryDate),
    AvailableDate: isoDate(l.listingAvailableDate),
    Status: l.listingStatus || undefined,
    Source: l.listingSource || undefined,
    Notes: l.listingNotes || undefined,
  });
  const listingRes = await client.request<any>({ token, method: "POST", path: "/listings", data: listingPayload });
  const listingID = idFrom(listingRes.data, ["ListingID", "ID", "id"]);
  if (listingRes.status === 404) {
    log.warnings.push("/listings endpoint returned 404. Property and spaces were created, but listing shell was not.");
  } else if (listingRes.status < 200 || listingRes.status >= 300 || !listingID) {
    const detail = dealiusErrorDetail(listingRes.data);
    log.warnings.push(
      detail
        ? `Listing create returned HTTP ${listingRes.status}: ${detail}`
        : `Listing create returned HTTP ${listingRes.status}.`
    );
  }
  log.steps.push({ key: "listing", ok: Boolean(listingID), detail: listingID ? String(listingID) : "Not created" });

  if (listingID && l.brokers.length) {
    for (const broker of l.brokers) {
      const contactID = await resolveBrokerContactId({ client, token, name: broker.name, directory });
      if (!contactID) {
        log.warnings.push(`Broker "${broker.name}" was not resolved.`);
        continue;
      }
      const pct = broker.pct != null && broker.pct > 1 ? broker.pct : broker.pct != null ? broker.pct * 100 : undefined;
      const primary = await client.request<any>({
        token,
        method: "POST",
        path: `/listings/${listingID}/brokers`,
        data: omitEmpty({
          ListingID: listingID,
          ContactID: contactID,
          IsLead: broker.lead || l.brokers.indexOf(broker) === 0,
          Commission: pct,
        }),
      });
      if (primary.status < 200 || primary.status >= 300) {
        const retry = await client.request<any>({
          token,
          method: "POST",
          path: `/listings/${listingID}/brokers`,
          data: omitEmpty({
            ListingID: listingID,
            ContactID: contactID,
            IsLead: broker.lead || l.brokers.indexOf(broker) === 0,
            Commission: pct != null ? pct / 100 : undefined,
          }),
        });
        if (retry.status < 200 || retry.status >= 300) log.warnings.push(`Broker "${broker.name}" was not assigned.`);
      }
    }
  }
  log.steps.push({ key: "brokers", ok: true, detail: `${l.brokers.length} broker(s)` });

  return {
    entryMode: "listing" as const,
    listingID: listingID ?? null,
    listingName: l.listingName,
    propertyName: l.propertyName,
    propertyID,
    propertySpaceIDs,
    warnings: log.warnings,
    steps: log.steps,
    mockMode: token === "dummy-token",
  };
}

/**
 * Internal helpers exported for tests only. Treat as unstable; consumers should
 * use the high-level `pushDealEntryToDealius` / `pushListingEntryToDealius` /
 * `validate*` entry points.
 */
export const __dealiusInternals = {
  idFrom,
  listFrom,
  unwrapDealiusEntity,
  dealiusErrorDetail,
  normalizeDealEntry,
  normalizeListingEntry,
  propertyTypeIdFrom,
  repTypeIdFrom,
  firstFeePercent,
  createProperty,
  createSpace,
  resolveCompanyId,
  resolveContactId,
};
