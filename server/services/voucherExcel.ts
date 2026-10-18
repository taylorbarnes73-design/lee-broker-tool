import type { WorkSheet } from "xlsx";
import XLSX from "xlsx";

/**
 * Parses the Lee & Associates commission voucher Excel (.xlsm / .xlsx).
 * - **legacy**: same cell grid as `dxParseVoucher` in `tool.html` / `broker_tool.html`.
 * - **v431**: "Updated Voucher" / rev 3-4-25 layout (e.g. `LEASE TRANSACTION DETAILS` at A34,
 *   listing/procuring **House** at B85 / J85, optional merged transaction type at A5:N5).
 */

export type VoucherExcelBrokerRow = { name: string; side?: string; pct: number | null };
export type VoucherExcelRentRow = { monthly: number; months: number; free: boolean };

export type ParsedLeeVoucherExcel = {
  dealName: string;
  repTypeID: number;
  isLease: boolean;
  isSale: boolean;
  transactionType: string;
  representationType: string;
  address: string;
  city: string;
  zip: string;
  suite?: string;
  propertyType?: string;
  sqft: number | null;
  dealSF: number | null;
  totalBldgSF: number | null;
  landSF: number | null;
  indSF: number | null;
  officeSF: number | null;
  clientCo?: string;
  oppositeCo?: string;
  lessorName?: string;
  lesseeName?: string;
  clientContact?: string;
  oppositeContact?: string;
  clientEmail?: string;
  oppositeEmail?: string;
  clientPhone?: string;
  oppositePhone?: string;
  startDate?: string | null;
  endDate?: string | null;
  occupancyDate?: string | null;
  term?: number | null;
  totalConsideration?: number | null;
  /** Commission % from voucher (same cell as legacy `saleCommPct` — used for lease + sale). */
  saleCommPct: number | null;
  /** Flat commission / referral amount from voucher financials. */
  paymentAmount?: number | null;
  rentRows: VoucherExcelRentRow[];
  brokers: VoucherExcelBrokerRow[];
  outsideBrokers: Array<{ name: string; amt: number }>;
  _debug?: Record<string, unknown>;
};

function repLabelFromId(id: number): string {
  const map: Record<number, string> = {
    1: "Buyer Rep",
    2: "Seller Rep",
    3: "Tenant Rep",
    4: "Landlord Rep",
    5: "Other / Referred Rep",
  };
  return map[id] ?? "Landlord Rep";
}

function normalizePropertyType(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes("industrial")) return "Industrial";
  if (v.includes("office")) return "Office";
  if (v.includes("retail")) return "Retail";
  if (v.includes("land")) return "Land";
  if (v.includes("multi")) return "Multi-Family";
  if (v.includes("medical")) return "Medical";
  if (v.trim()) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return "Industrial";
}

function suiteLabel(raw: unknown): string {
  const value = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  if (/^(suite|ste\.?|unit|#)\b/i.test(value)) return value.replace(/^ste\.?\b/i, "Ste");
  return `Ste ${value}`;
}

function propertyNameFromAddressSuite(address: unknown, suite: unknown): string {
  const cleanAddress = String(address ?? "").trim();
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

function g(rows: unknown[][], r: number, c: number): string {
  const row = rows[r];
  if (!row || row[c] == null) return "";
  const v = row[c];
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function gn(rows: unknown[][], r: number, c: number): number | null {
  const v = g(rows, r, c);
  if (!v) return null;
  const n = Number.parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function gb(rows: unknown[][], r: number, c: number): boolean {
  const v = g(rows, r, c).toUpperCase();
  return v === "Y" || v === "YES" || v === "TRUE";
}

function gd(rows: unknown[][], r: number, c: number): string | null {
  const v = g(rows, r, c);
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function readWorksheetCellStr(ws: WorkSheet, addr: string): string {
  const cell = ws[addr] as { v?: unknown; w?: string } | undefined;
  if (!cell) return "";
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return cell.v.toISOString().slice(0, 10);
  return String(cell.w ?? cell.v ?? "").trim();
}

function readWorksheetCellNum(ws: WorkSheet, addr: string): number | null {
  const s = readWorksheetCellStr(ws, addr);
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Value for a cell, resolving merges so the top-left master cell is used (Excel-style). */
function cellStrAtRC(ws: WorkSheet, r: number, c: number): string {
  const merges = ws["!merges"] ?? [];
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      return readWorksheetCellStr(ws, XLSX.utils.encode_cell(m.s));
    }
  }
  return readWorksheetCellStr(ws, XLSX.utils.encode_cell({ r, c }));
}

/** True when the workbook matches the rev 3/4/25+ voucher (A34 lease/sale band). */
export function isLeeVoucher431Template(rows: unknown[][]): boolean {
  return g(rows, 33, 0).toUpperCase().includes("LEASE TRANSACTION DETAILS");
}

function txRawFrom431(ws: WorkSheet, rows: unknown[][]): string {
  const fromMerge = cellStrAtRC(ws, 4, 1).toLowerCase(); // B5 inside A5:N5
  if (fromMerge) return fromMerge;
  return (g(rows, 3, 3) || g(rows, 4, 1) || g(rows, 3, 1) || "").toLowerCase();
}

function saleCommPctFrom431(ws: WorkSheet, rows: unknown[][]): number | null {
  const candidates = [
    gn(rows, 42, 12),
    gn(rows, 43, 12),
    readWorksheetCellNum(ws, "M43"),
    readWorksheetCellNum(ws, "N43"),
    readWorksheetCellNum(ws, "M42"),
    gn(rows, 41, 12),
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  return null;
}

function firstPositiveNumber(values: Array<number | null | undefined>): number | null {
  for (const n of values) {
    if (n != null && n > 0) return n;
  }
  return null;
}

// Voucher templates are at most ~100 rows / ~20 columns; a compressed .xlsx/.xlsm
// can still unzip into a far larger grid (zip-bomb style), so cap dimensions before
// materializing the full row matrix with sheet_to_json.
const MAX_VOUCHER_SHEET_ROWS = 5_000;
const MAX_VOUCHER_SHEET_COLS = 500;

function assertWorksheetWithinLimits(ws: WorkSheet): void {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  if (rowCount > MAX_VOUCHER_SHEET_ROWS || colCount > MAX_VOUCHER_SHEET_COLS) {
    throw new Error("Workbook sheet is too large to be a valid voucher template.");
  }
}

/** Parse first worksheet as row matrix (same as legacy `sheet_to_json(..., { header: 1 })`). */
export function readVoucherRowsFromExcelBuffer(buffer: Buffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("Workbook has no sheets.");
  const ws = wb.Sheets[name];
  if (!ws) throw new Error("Workbook first sheet is missing.");
  assertWorksheetWithinLimits(ws);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][];
}

function readFirstSheetRowsAndWorksheet(buffer: Buffer): { rows: unknown[][]; ws: WorkSheet } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("Workbook has no sheets.");
  const ws = wb.Sheets[name];
  if (!ws) throw new Error("Workbook first sheet is missing.");
  assertWorksheetWithinLimits(ws);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][];
  return { rows, ws };
}

type VoucherLayout = "legacy" | "v431";

/**
 * Port of `dxParseVoucher(rows)` from `tool.html` (grid coordinates are 0-based row/col),
 * with optional **v431** overrides for the current broker `.xlsm` template.
 */
function parseLeeVoucherGridInternal(rows: unknown[][], ws: WorkSheet | null, layout: VoucherLayout): ParsedLeeVoucherExcel {
  const v431 = layout === "v431";

  const txRaw = (v431 && ws ? txRawFrom431(ws, rows) : (g(rows, 3, 3) || g(rows, 4, 1) || g(rows, 3, 1) || "")).toLowerCase();
  const isReferral = txRaw.includes("referral") || txRaw.includes("referred") || txRaw.includes("referr");
  // The portal writes "Renewal" for a lease renewal. That word does not contain
  // "lease", and the official template value is "Lease Renewal". Either form is
  // still a lease: classifying it as a sale drops the rent schedule and records
  // the landlord and tenant as seller and buyer.
  const isRenewal = !isReferral && txRaw.includes("renew");
  const isLease = !isReferral && (txRaw.includes("lease") || isRenewal || txRaw === "");
  const isSale = !isReferral && (txRaw.includes("sale") || txRaw.includes("sold"));

  const listingHouse = (
    (v431 && ws ? cellStrAtRC(ws, 84, 2) : "") ||
    (v431 ? g(rows, 84, 2) : g(rows, 84, 2))
  ).toLowerCase();
  const procuringHouse = (
    (v431 && ws ? cellStrAtRC(ws, 84, 10) : "") ||
    (v431 ? g(rows, 84, 10) : g(rows, 84, 10))
  ).toLowerCase();
  const ourKeywords = ["newport", "lee & assoc", "lee and assoc"];
  const isListing = ourKeywords.some(k => listingHouse.includes(k));
  const isProcuring = ourKeywords.some(k => procuringHouse.includes(k));

  let fallbackSide = "";
  let hasListingBroker = false;
  let hasProcuringBroker = false;
  const brokerScanEnd = v431 ? 132 : 129;
  for (let r = 122; r <= brokerScanEnd; r++) {
    const side = g(rows, r, 3).toLowerCase();
    if (side.includes("listing")) {
      hasListingBroker = true;
      if (!fallbackSide) fallbackSide = "listing";
    }
    if (side.includes("procur")) {
      hasProcuringBroker = true;
      if (!fallbackSide) fallbackSide = "procuring";
    }
  }

  const representedBothSides = (isListing && isProcuring) || (hasListingBroker && hasProcuringBroker);
  const onListingSide = representedBothSides || isListing || (!isProcuring && fallbackSide === "listing");
  let repTypeID: number;
  if (isReferral) repTypeID = 5;
  else if (isLease) repTypeID = onListingSide ? 4 : 3;
  else repTypeID = onListingSide ? 2 : 1;

  const address = ws ? cellStrAtRC(ws, 8, 1) || g(rows, 8, 1) : g(rows, 8, 1);
  let city = ws ? cellStrAtRC(ws, 8, 10) || g(rows, 8, 10) : g(rows, 8, 10);
  if (!city || city.length <= 2 || /^\d+$/.test(city)) city = g(rows, 8, 9) || g(rows, 8, 11) || g(rows, 8, 12) || city;
  const zip = ws
    ? cellStrAtRC(ws, 8, 13) || cellStrAtRC(ws, 8, 14) || g(rows, 8, 13) || g(rows, 8, 14)
    : g(rows, 8, 13) || g(rows, 8, 14);

  const lessorName = ws ? cellStrAtRC(ws, 11, 2) || g(rows, 11, 2) : g(rows, 11, 2);
  const lesseeName = ws ? cellStrAtRC(ws, 11, 10) || g(rows, 11, 10) : g(rows, 11, 10);
  const clientCo = onListingSide ? lessorName : lesseeName;
  const oppositeCo = onListingSide ? lesseeName : lessorName;

  const propTypeRaw = g(rows, 3, 6) || "";
  const suite = g(rows, 21, 2);
  const sqft = v431 ? gn(rows, 35, 2) ?? gn(rows, 22, 1) ?? gn(rows, 22, 2) : gn(rows, 22, 2);
  const subType = g(rows, 22, 10) || propTypeRaw;
  const landSF = gn(rows, 22, 12);
  const totalBldgSF = v431 ? gn(rows, 23, 1) ?? gn(rows, 23, 2) : gn(rows, 23, 2);
  const indSF = gn(rows, 23, 4);
  const officeSF = gn(rows, 23, 10);
  const bldgClass = g(rows, 24, 2);
  const yearBuilt = gn(rows, 24, 4);
  const numFloors = gn(rows, 24, 6);
  const numParkingSpaces = gn(rows, 25, 4);
  const parkRatio = g(rows, 25, 6);
  const dhDoors = gn(rows, 27, 2);
  const glDoors = gn(rows, 27, 4);
  const clearHeight = gn(rows, 27, 6);
  const sprinklers = gb(rows, 27, 10);
  const ampsRaw = g(rows, 27, 12);
  const rail = g(rows, 28, 2);
  const bldgCond = g(rows, 28, 6);

  const lessorContact = g(rows, 12, 2);
  const lesseeContact = g(rows, 12, 10);
  const lessorEmail = g(rows, 13, 2);
  const lesseeEmail = g(rows, 13, 10);
  const lessorPhone = g(rows, 17, 2);
  const lesseePhone = g(rows, 17, 10);

  const startDate = gd(rows, 35, 4);
  const endDate = gd(rows, 35, 7);
  const occupancyDate = gd(rows, 37, 1);
  const termRaw = gn(rows, 37, 4) || gn(rows, 36, 4);
  const monthsOnMkt = gn(rows, 37, 10) || gn(rows, 36, 10);
  const propTaxes = gn(rows, 39, 5);
  const tiPerSF = gn(rows, 39, 7);
  const insurance = gn(rows, 40, 5);
  const askingRate = gn(rows, 41, 2);
  const totalNNN = gn(rows, 42, 5);
  const escalation = gn(rows, 43, 2);
  const opex = gn(rows, 26, 4);

  const totalConsideration = v431
    ? gn(rows, 35, 12) ?? gn(rows, 35, 13) ?? (ws ? readWorksheetCellNum(ws, "M36") : null)
    : gn(rows, 35, 12);

  const rentRows: VoucherExcelRentRow[] = [];
  const leaseCommissionRates: number[] = [];
  const rentEnd = v431 ? 70 : 66;
  for (let r = 52; r <= rentEnd; r++) {
    const rateLabel = g(rows, r, 10).toLowerCase();
    if (rateLabel.includes("comm due")) continue;

    const monthly = gn(rows, r, 0);
    let months = gn(rows, r, 3);
    const commissionRate = gn(rows, r, 10);
    if (commissionRate != null && commissionRate > 0) leaseCommissionRates.push(commissionRate);
    if (v431 && ws && monthly != null && monthly > 0 && (months == null || months <= 0)) {
      const fromCell = readWorksheetCellNum(ws, XLSX.utils.encode_cell({ r, c: 3 }));
      if (fromCell != null && fromCell > 0) months = fromCell;
    }
    if (months && months > 0) {
      const isFree = !monthly || monthly === 0;
      rentRows.push({ monthly: isFree ? 0 : monthly, months, free: isFree });
    }
  }
  const rentMonthSum = rentRows.reduce((s, r) => s + (r.months || 0), 0);
  const term = termRaw || (rentMonthSum > 0 ? rentMonthSum : null);
  const saleCommPct =
    firstPositiveNumber([
      v431 && ws ? saleCommPctFrom431(ws, rows) : gn(rows, 42, 12),
      ...leaseCommissionRates,
    ]) ?? null;
  const paymentAmount =
    isReferral
      ? firstPositiveNumber([
          gn(rows, 73, 11), // Consulting/Referral flat fee.
          gn(rows, 75, 11), // TOTAL INVOICE.
          gn(rows, 117, 11), // Commission distribution invoice total.
          gn(rows, 119, 11), // Gross dollars to distribute.
          gn(rows, 136, 1), // Summary invoice amount.
        ])
      : null;

  const brokers: VoucherExcelBrokerRow[] = [];
  for (let r = 123; r <= 129; r++) {
    const name = g(rows, r, 0);
    const side = g(rows, r, 3);
    let pct = gn(rows, r, 4);
    if (name && pct != null) {
      let frac = pct;
      if (frac > 1) frac = frac / 100;
      brokers.push({ name, side, pct: frac });
    }
  }

  const outsideBrokers: Array<{ name: string; amt: number }> = [];
  const lN = g(rows, 95, 2),
    lA = gn(rows, 95, 11);
  const pN = g(rows, 97, 2),
    pA = gn(rows, 97, 11);
  const eN = g(rows, 99, 1),
    eA = gn(rows, 99, 11);
  if (lN && lA != null) outsideBrokers.push({ name: lN, amt: lA });
  if (pN && pA != null) outsideBrokers.push({ name: pN, amt: pA });
  if (eN && eA != null) outsideBrokers.push({ name: eN, amt: eA });

  const txWord = isReferral ? "Referred" : isSale ? "Sold" : "Leased";
  const dealName = txWord + ": " + propertyNameFromAddressSuite(address, suite);

  const clientContact = onListingSide ? lessorContact : lesseeContact;
  const oppositeContact = onListingSide ? lesseeContact : lessorContact;
  const clientEmail = onListingSide ? lessorEmail : lesseeEmail;
  const oppositeEmail = onListingSide ? lesseeEmail : lessorEmail;
  const clientPhone = onListingSide ? lessorPhone : lesseePhone;
  const oppositePhone = onListingSide ? lesseePhone : lessorPhone;

  return {
    dealName,
    repTypeID,
    isLease,
    isSale,
    transactionType: isReferral ? "Referral" : isLease ? "Lease" : "Sale",
    representationType: repLabelFromId(repTypeID),
    address,
    city,
    zip,
    suite: suite || undefined,
    propertyType: normalizePropertyType(subType || propTypeRaw),
    sqft,
    dealSF: sqft,
    totalBldgSF,
    landSF,
    indSF,
    officeSF,
    clientCo: clientCo || undefined,
    oppositeCo: oppositeCo || undefined,
    lessorName: lessorName || undefined,
    lesseeName: lesseeName || undefined,
    clientContact: clientContact || undefined,
    oppositeContact: oppositeContact || undefined,
    clientEmail: clientEmail || undefined,
    oppositeEmail: oppositeEmail || undefined,
    clientPhone: clientPhone || undefined,
    oppositePhone: oppositePhone || undefined,
    startDate,
    endDate,
    occupancyDate,
    term,
    totalConsideration: totalConsideration ?? undefined,
    saleCommPct,
    paymentAmount,
    rentRows,
    brokers,
    outsideBrokers,
    _debug: {
      template: layout,
      listingHouse,
      procuringHouse,
      isListing,
      isProcuring,
      hasListingBroker,
      hasProcuringBroker,
      representedBothSides,
      fallbackSide,
      onListingSide,
      txRaw,
    },
  };
}

/** Port of `dxParseVoucher(rows)` — legacy grid only (tests, older files). */
export function parseLeeVoucherGrid(rows: unknown[][]): ParsedLeeVoucherExcel {
  return parseLeeVoucherGridInternal(rows, null, "legacy");
}

/** Maps parsed voucher grid into submission / Dealius-push payload fields. */
export function submissionPayloadPatchFromParsedVoucher(parsed: ParsedLeeVoucherExcel): Record<string, unknown> {
  const fee = parsed.saleCommPct != null && parsed.saleCommPct > 0 ? parsed.saleCommPct : null;
  const isReferral = parsed.repTypeID === 5;
  const brokersForApi = parsed.brokers.map(b => ({
    name: b.name,
    pct: b.pct,
    side: b.side,
  }));

  const patch: Record<string, unknown> = {
    dealName: parsed.dealName,
    repTypeID: parsed.repTypeID,
    txnType: parsed.transactionType,
    transactionType: parsed.transactionType,
    representationType: parsed.representationType,
    address: parsed.address,
    city: parsed.city,
    zip: parsed.zip,
    propertyAddress: [parsed.address, parsed.city, parsed.zip].filter(Boolean).join(", "),
    suite: parsed.suite,
    propertyType: parsed.propertyType,
    sqft: parsed.sqft,
    dealSF: parsed.dealSF,
    totalBldgSF: parsed.totalBldgSF,
    landSF: parsed.landSF,
    indSF: parsed.indSF,
    officeSF: parsed.officeSF,
    lessorName: parsed.lessorName,
    lesseeName: parsed.lesseeName,
    clientCo: parsed.clientCo,
    oppositeCo: parsed.oppositeCo,
    clientContactName: parsed.clientContact,
    oppositeContactName: parsed.oppositeContact,
    clientContactEmail: parsed.clientEmail,
    oppositeContactEmail: parsed.oppositeEmail,
    clientContactPhone: parsed.clientPhone,
    oppositeContactPhone: parsed.oppositePhone,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    occupancyDate: parsed.occupancyDate,
    term: parsed.term,
    totalConsideration: parsed.totalConsideration,
    paymentAmount: parsed.paymentAmount,
    commissionAmount: parsed.paymentAmount,
    saleCommPct: parsed.saleCommPct,
    commissionRate: fee != null ? String(fee) : undefined,
    feePercent: isReferral ? 100 : fee ?? undefined,
    internalFeePercent: isReferral ? 100 : fee ?? undefined,
    rentRows: parsed.rentRows,
    brokers: brokersForApi,
    outsideBrokers: parsed.outsideBrokers,
    excelImport: {
      importedAt: new Date().toISOString(),
      parser: parsed._debug?.template === "v431" ? "lee_voucher_excel_v431" : "lee_voucher_excel_v1",
      debug: parsed._debug ?? null,
    },
  };

  if (parsed.brokers.length > 0) {
    patch.listingAgentName = parsed.brokers[0].name;
  }

  return patch;
}

export function parseLeeVoucherExcelBuffer(buffer: Buffer): ParsedLeeVoucherExcel {
  const { rows, ws } = readFirstSheetRowsAndWorksheet(buffer);
  if (isLeeVoucher431Template(rows)) {
    return parseLeeVoucherGridInternal(rows, ws, "v431");
  }
  return parseLeeVoucherGridInternal(rows, ws, "legacy");
}
