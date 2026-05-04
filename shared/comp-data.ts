import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

export type CompRow = Record<string, unknown>;

export type LeaseCompRecord = {
  sourceSheet: string;
  id: number | null;
  office: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  market: string;
  subMarket: string;
  projectName: string;
  propertyType: string;
  propertySubType: string;
  buildingClass: string;
  spaceType: string;
  multiTenant: string;
  yearBuilt: number | null;
  constructionType: string;
  dhDoors: number | null;
  glDoors: number | null;
  clearHeight: number | null;
  amperage: number | null;
  parkingType: string;
  parkingRatio: string;
  sprinklers: string;
  rail: string;
  yard: string;
  pol: string;
  listBroker: string;
  procBroker: string;
  source: string;
  verifiedBy: string;
  lastUpdated: string;
  monthsOnMarket: number | null;
  transactionDate: string;
  occupancyDate: string;
  expirationDate: string;
  leasedSqFt: number | null;
  rentPerSqFt: number | null;
  rentType: string;
  askRentPerSqFt: number | null;
  askRentType: string;
  termInMonths: number | null;
  effectiveRent: number | null;
  freeRentMonths: number | null;
  rentAdjustments: string;
  options: string;
  tia: string;
  consideration: string;
  lessee: string;
  lesseeBusiness: string;
  lesseeContact: string;
  lesseePhone: string;
  lesseePriorLocation: string;
  lessor: string;
  comments: string;
  buildingSqFt: number | null;
  officeSqFt: number | null;
  nnnCharges: number | null;
  landSqFt: number | null;
  cam: string;
  confidential: string;
  expenseStop: string;
  rentUse: string;
  photo: string;
  listAgent1: string;
  listAgent2: string;
  procAgent1: string;
  procAgent2: string;
  verified: string;
  updatedBy: string;
  apn: string;
};

export type SaleCompRecord = {
  sourceSheet: string;
  id: number | null;
  office: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  market: string;
  subMarket: string;
  projectName: string;
  propertyType: string;
  propertySubType: string;
  buildingClass: string;
  yearBuilt: number | null;
  constructionType: string;
  dhDoors: number | null;
  glDoors: number | null;
  clearHeight: number | null;
  amperage: number | null;
  parkingType: string;
  parkingRatio: string;
  sprinklers: string;
  rail: string;
  yard: string;
  multiTenant: string;
  floors: number | null;
  passengerElevators: number | null;
  freightElevators: number | null;
  listBroker: string;
  procBroker: string;
  source: string;
  verifiedBy: string;
  lastUpdated: string;
  monthsOnMarket: number | null;
  transactionDate: string;
  buildingSqFt: number | null;
  landSqFt: number | null;
  officeSqFt: number | null;
  salePrice: number | null;
  salePricePerSqFt: number | null;
  capRate: number | null;
  transactionType: string;
  buyer: string;
  buyerBusiness: string;
  buyerContact: string;
  buyerPhone: string;
  buyerPriorLocation: string;
  seller: string;
  sellerContact: string;
  sellerPhone: string;
  comments: string;
  askingPrice: number | null;
  photo: string;
  listAgent1: string;
  listAgent2: string;
  procAgent1: string;
  procAgent2: string;
  verified: string;
  updatedBy: string;
  apn: string;
};

export type LeaseReportCard = {
  heading: string;
  addressLine: string;
  cityLine: string;
  submarketLine: string;
  listingBrokerLine: string;
  procuringBrokerLine: string;
  sourceLine: string;
  updatedLine: string;
  comments: string;
  photo: string;
  fields: Record<string, string>;
};

export type SaleReportCard = {
  heading: string;
  addressLine: string;
  cityLine: string;
  submarketLine: string;
  listingBrokerLine: string;
  procuringBrokerLine: string;
  sourceLine: string;
  updatedLine: string;
  comments: string;
  photo: string;
  fields: Record<string, string>;
};

export type ParsedCompWorkbook = {
  workbookName: string;
  canonicalLeaseSheet: string;
  canonicalSaleSheet: string;
  leaseRecords: LeaseCompRecord[];
  saleRecords: SaleCompRecord[];
  regionalLeaseSheets: Array<{ sheetName: string; rowCount: number }>;
};

export const PROPERTY_TYPE_LABEL_ALIASES: Record<string, string> = {
  off: "Office",
  office: "Office",
  ind: "Industrial",
  indust: "Industrial",
  industrial: "Industrial",
  ret: "Retail",
  retail: "Retail",
  lnd: "Land",
  land: "Land",
  flx: "Flex",
  flex: "Flex",
  "r&d": "R&D",
  "r&d/flex": "R&D/Flex",
  "rd/flex": "R&D/Flex",
};

export function normalizePropertyTypeLabel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  return PROPERTY_TYPE_LABEL_ALIASES[key] ?? raw;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text.toUpperCase() === "NULL") return "";
  return text;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = cleanText(value).replace(/[$,%]/g, "").replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDate(value: unknown): string {
  const fromExcelSerial = (serial: number): string => {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (!parsed || !parsed.y || parsed.y < 1900 || parsed.y > 2100) return "";
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${month}-${day}`;
  };

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelDate = fromExcelSerial(value);
    if (excelDate) return excelDate;
  }
  const text = cleanText(value);
  if (!text) return "";
  const numericText = Number(text);
  if (Number.isFinite(numericText)) {
    const excelDate = fromExcelSerial(numericText);
    if (excelDate) return excelDate;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  const year = parsed.getUTCFullYear();
  if (year < 1900 || year > 2100) return "";
  return parsed.toISOString().slice(0, 10);
}

function cleanFlag(value: unknown): string {
  const text = cleanText(value).toUpperCase();
  if (text === "Y" || text === "YES" || text === "TRUE") return "Yes";
  if (text === "N" || text === "NO" || text === "FALSE") return "No";
  return cleanText(value);
}

const STREET_NUMBER_TOKEN = /^\d+[A-Za-z]?$/;

function joinAddress(parts: unknown[]): string {
  const cleaned = parts.map(cleanText).filter(Boolean);
  if (!cleaned.length) return "";
  let head = cleaned;
  if (
    cleaned.length >= 2 &&
    STREET_NUMBER_TOKEN.test(cleaned[0]!) &&
    STREET_NUMBER_TOKEN.test(cleaned[1]!)
  ) {
    head = [`${cleaned[0]}-${cleaned[1]}`, ...cleaned.slice(2)];
  }
  return head.join(" ").replace(/\s+/g, " ").trim();
}

function getRowValue(row: CompRow, key: string): unknown {
  return row[key];
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Year built and similar: no thousands grouping (avoids "2,005" style glitches). */
function formatPlainInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(Math.round(value));
}

function formatCurrency(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatCurrencyPerSf(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const decimals = value % 1 === 0 ? 2 : 3;
  return `${formatCurrency(value, decimals)}${suffix}`;
}

function formatReportDate(value: string): string {
  if (!value) return "";
  const isoDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    return `${m}/${d}/${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  const yyyy = parsed.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Parking ratio: normalize to one decimal before the colon (e.g. 2/1000 → 2.0:1,000). */
export function formatParkingRatioDisplay(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const norm = t.replace(/\s+/g, "");
  const m = norm.match(/^(\d+(?:\.\d+)?)[:/](\d+(?:,\d{3})*|\d+)$/);
  if (!m) return t;
  const left = Number(m[1]);
  const right = Number(String(m[2]).replace(/,/g, ""));
  if (!Number.isFinite(left) || !Number.isFinite(right)) return t;
  return `${left.toFixed(1)}:${right.toLocaleString("en-US")}`;
}

/** Sale comp report: spell out User vs Investment (per broker admin spec). */
export function formatSaleTransactionTypeDisplay(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const compact = t.toLowerCase().replace(/[\s/_-]+/g, "");
  if (compact.includes("owner") && compact.includes("user")) return "User";
  if (compact === "investor" || compact === "investment") return "Investment";
  if (compact === "developer") return "Developer";
  if (compact.includes("saleleaseback")) return "Sale-Leaseback";
  if (compact.includes("partial")) return "Partial Interest";
  return t;
}

const RENT_TYPE_ABBREV_RULES: Array<{ match: RegExp; abbrev: string }> = [
  { match: /\bnnn\b/i, abbrev: "NNN" },
  { match: /\bmodified\s+gross\b/i, abbrev: "MG" },
  { match: /\bindustrial\s+gross\b/i, abbrev: "IG" },
  { match: /\bfull\s+service\s+gross\b/i, abbrev: "FSG" },
  { match: /\bfull\s+service\b/i, abbrev: "FS" },
  { match: /\bgross\b/i, abbrev: "G" },
  { match: /\bfs\b/i, abbrev: "FS" },
  { match: /\bfsg\b/i, abbrev: "FSG" },
  { match: /\bmg\b/i, abbrev: "MG" },
  { match: /\big\b/i, abbrev: "IG" },
];

export function abbreviateRentTypeForReport(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^(G|IG|MG|NNN|FS|FSG|NN)$/i.test(t)) return t.toUpperCase();
  for (const { match, abbrev } of RENT_TYPE_ABBREV_RULES) {
    if (match.test(t)) return abbrev;
  }
  return t;
}

/**
 * Rent adjustment / escalation: show percentages as X.X% instead of decimals like 0.03.
 */
export function formatRentAdjustmentsDisplay(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const onlyNum = t.replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(onlyNum);
  if (Number.isFinite(n) && n > 0 && n < 1 && !/%/.test(t)) {
    return `${(n * 100).toFixed(1)}%`;
  }
  return t.replace(/\b0\.\d+\b/g, match => {
    const v = Number(match);
    if (!Number.isFinite(v) || v <= 0 || v >= 1) return match;
    return `${(v * 100).toFixed(1)}%`;
  });
}

function buildBrokerLine(kind: "List" | "Proc", brokerage: string, agents: string[]): string {
  const namedAgents = agents.map(a => (a ?? "").trim()).filter(Boolean);
  if (!brokerage && namedAgents.length === 0) return "";
  const label = kind === "List" ? "List. Brkr" : "Proc. Brkr";
  const agentText = namedAgents.length ? namedAgents.join(" & ") : "";
  if (brokerage && agentText) return `${label}: ${agentText} (${brokerage})`;
  if (brokerage) return `${label}: ${brokerage}`;
  return `${label}: ${agentText}`;
}

function buildUpdateLine(_verifiedBy: string, lastUpdated: string, id: number | null): string {
  const parts: string[] = [];
  if (lastUpdated) parts.push(`Updated: ${formatReportDate(lastUpdated)}`);
  if (id !== null) parts.push(`#${id}`);
  return parts.join(" ");
}

export function normalizeLeaseCompRecord(row: CompRow, sourceSheet: string): LeaseCompRecord {
  return {
    sourceSheet,
    id: cleanNumber(getRowValue(row, "ihlcID")),
    office: cleanText(getRowValue(row, "office")),
    address: joinAddress([
      getRowValue(row, "streetNumber1"),
      getRowValue(row, "streetNumber2"),
      getRowValue(row, "streetDirection"),
      getRowValue(row, "streetName"),
      getRowValue(row, "streetSuffix"),
      getRowValue(row, "suite"),
    ]),
    city: cleanText(getRowValue(row, "city")),
    state: cleanText(getRowValue(row, "state")),
    zipCode: cleanText(getRowValue(row, "zipCode")),
    market: cleanText(getRowValue(row, "market")),
    subMarket: cleanText(getRowValue(row, "subMarket")),
    projectName: cleanText(getRowValue(row, "projectName")),
    propertyType: cleanText(getRowValue(row, "propertyType")),
    propertySubType: cleanText(getRowValue(row, "propertySubType")),
    buildingClass: cleanText(getRowValue(row, "buildingClass")),
    spaceType: cleanText(getRowValue(row, "spaceType")),
    multiTenant: cleanFlag(getRowValue(row, "multiTenant")),
    yearBuilt: cleanNumber(getRowValue(row, "yearBuilt")),
    constructionType: cleanText(getRowValue(row, "constructionType")),
    dhDoors: cleanNumber(getRowValue(row, "dhDoors")),
    glDoors: cleanNumber(getRowValue(row, "glDoors")),
    clearHeight: cleanNumber(getRowValue(row, "clearHeight")),
    amperage: cleanNumber(getRowValue(row, "amperage")),
    parkingType: cleanText(getRowValue(row, "parkingType")),
    parkingRatio: cleanText(getRowValue(row, "parkingRatio")),
    sprinklers: cleanFlag(getRowValue(row, "sprinklers")),
    rail: cleanFlag(getRowValue(row, "rail")),
    yard: cleanFlag(getRowValue(row, "yard")),
    pol: cleanFlag(getRowValue(row, "POL")),
    listBroker: cleanText(getRowValue(row, "listBroker")),
    procBroker: cleanText(getRowValue(row, "procBroker")),
    source: cleanText(getRowValue(row, "source")),
    verifiedBy: cleanText(getRowValue(row, "verifiedBy")),
    lastUpdated: cleanDate(getRowValue(row, "lastUpdated")),
    monthsOnMarket: cleanNumber(getRowValue(row, "monthsOnMarket")),
    transactionDate: cleanDate(getRowValue(row, "transactionDate")),
    occupancyDate: cleanDate(getRowValue(row, "occupancyDate")),
    expirationDate: cleanDate(getRowValue(row, "expirationDate")),
    leasedSqFt: cleanNumber(getRowValue(row, "leasedSqFt")),
    rentPerSqFt: cleanNumber(getRowValue(row, "rentPerSqFt")),
    rentType: cleanText(getRowValue(row, "rentType")),
    askRentPerSqFt: cleanNumber(getRowValue(row, "askRentPerSqFt")),
    askRentType: cleanText(getRowValue(row, "askRentType")),
    termInMonths: cleanNumber(getRowValue(row, "termInMonths")),
    effectiveRent: cleanNumber(getRowValue(row, "effectiveRent")),
    freeRentMonths: cleanNumber(getRowValue(row, "freeRentMonths")),
    rentAdjustments: cleanText(getRowValue(row, "rentAdjustments")),
    options: cleanText(getRowValue(row, "options")),
    tia: cleanText(getRowValue(row, "tia")),
    consideration: cleanText(getRowValue(row, "consideration")),
    lessee: cleanText(getRowValue(row, "lessee")),
    lesseeBusiness: cleanText(getRowValue(row, "lesseeBusiness")),
    lesseeContact: cleanText(getRowValue(row, "lesseeContact")),
    lesseePhone: cleanText(getRowValue(row, "lesseePhone")),
    lesseePriorLocation: cleanText(getRowValue(row, "lesseePriorLocation")),
    lessor: cleanText(getRowValue(row, "lessor")),
    comments: cleanText(getRowValue(row, "comments")),
    buildingSqFt: cleanNumber(getRowValue(row, "buildingSqFt")),
    officeSqFt: cleanNumber(getRowValue(row, "officeSqFt")),
    nnnCharges: cleanNumber(getRowValue(row, "NNNCharges")),
    landSqFt: cleanNumber(getRowValue(row, "landSqFt")),
    cam: cleanText(getRowValue(row, "CAM")),
    confidential: cleanFlag(getRowValue(row, "confidential")),
    expenseStop: cleanText(getRowValue(row, "expenseStop")),
    rentUse: cleanText(getRowValue(row, "rentUse")),
    photo: cleanText(getRowValue(row, "photo")),
    listAgent1: [cleanText(getRowValue(row, "listAgent1First")), cleanText(getRowValue(row, "listAgent1Last"))].filter(Boolean).join(" "),
    listAgent2: [cleanText(getRowValue(row, "listAgent2First")), cleanText(getRowValue(row, "listAgent2Last"))].filter(Boolean).join(" "),
    procAgent1: [cleanText(getRowValue(row, "procAgent1First")), cleanText(getRowValue(row, "procAgent1Last"))].filter(Boolean).join(" "),
    procAgent2: [cleanText(getRowValue(row, "procAgent2First")), cleanText(getRowValue(row, "procAgent2Last"))].filter(Boolean).join(" "),
    verified: cleanFlag(getRowValue(row, "verified")),
    updatedBy: cleanText(getRowValue(row, "updatedBy")),
    apn: cleanText(getRowValue(row, "APN")),
  };
}

export function normalizeSaleCompRecord(row: CompRow, sourceSheet: string): SaleCompRecord {
  return {
    sourceSheet,
    id: cleanNumber(getRowValue(row, "ihscID")),
    office: cleanText(getRowValue(row, "office")),
    address: joinAddress([
      getRowValue(row, "streetNumber1"),
      getRowValue(row, "streetNumber2"),
      getRowValue(row, "streetDirection"),
      getRowValue(row, "streetName"),
      getRowValue(row, "streetSuffix"),
      getRowValue(row, "suite"),
    ]),
    city: cleanText(getRowValue(row, "city")),
    state: cleanText(getRowValue(row, "state")),
    zipCode: cleanText(getRowValue(row, "zipCode")),
    market: cleanText(getRowValue(row, "market")),
    subMarket: cleanText(getRowValue(row, "subMarket")),
    projectName: cleanText(getRowValue(row, "projectName")),
    propertyType: cleanText(getRowValue(row, "propertyType")),
    propertySubType: cleanText(getRowValue(row, "propertySubType")),
    buildingClass: cleanText(getRowValue(row, "buildingClass")),
    yearBuilt: cleanNumber(getRowValue(row, "yearBuilt")),
    constructionType: cleanText(getRowValue(row, "constructionType")),
    dhDoors: cleanNumber(getRowValue(row, "dhDoors")),
    glDoors: cleanNumber(getRowValue(row, "glDoors")),
    clearHeight: cleanNumber(getRowValue(row, "clearHeight")),
    amperage: cleanNumber(getRowValue(row, "amperage")),
    parkingType: cleanText(getRowValue(row, "parkingType")),
    parkingRatio: cleanText(getRowValue(row, "parkingRatio")),
    sprinklers: cleanFlag(getRowValue(row, "sprinklers")),
    rail: cleanFlag(getRowValue(row, "rail")),
    yard: cleanFlag(getRowValue(row, "yard")),
    multiTenant: cleanFlag(getRowValue(row, "multiTenant")),
    floors: cleanNumber(getRowValue(row, "floors")),
    passengerElevators: cleanNumber(getRowValue(row, "passengerElevators")),
    freightElevators: cleanNumber(getRowValue(row, "freightElevators")),
    listBroker: cleanText(getRowValue(row, "listBroker")),
    procBroker: cleanText(getRowValue(row, "procBroker")),
    source: cleanText(getRowValue(row, "source")),
    verifiedBy: cleanText(getRowValue(row, "verifiedBy")),
    lastUpdated: cleanDate(getRowValue(row, "lastUpdated")),
    monthsOnMarket: cleanNumber(getRowValue(row, "monthsOnMarket")),
    transactionDate: cleanDate(getRowValue(row, "transactionDate")),
    buildingSqFt: cleanNumber(getRowValue(row, "buildingSqFt")),
    landSqFt: cleanNumber(getRowValue(row, "landSqFt")),
    officeSqFt: cleanNumber(getRowValue(row, "officeSqFt")),
    salePrice: cleanNumber(getRowValue(row, "salePrice")),
    salePricePerSqFt: cleanNumber(getRowValue(row, "salePricePerSqFt")),
    capRate: cleanNumber(getRowValue(row, "capRate")),
    transactionType: cleanText(getRowValue(row, "transactionType")),
    buyer: cleanText(getRowValue(row, "buyer")),
    buyerBusiness: cleanText(getRowValue(row, "buyerBusiness")),
    buyerContact: cleanText(getRowValue(row, "buyerContact")),
    buyerPhone: cleanText(getRowValue(row, "buyerPhone")),
    buyerPriorLocation: cleanText(getRowValue(row, "buyerPriorLocation")),
    seller: cleanText(getRowValue(row, "seller")),
    sellerContact: cleanText(getRowValue(row, "sellerContact")),
    sellerPhone: cleanText(getRowValue(row, "sellerPhone")),
    comments: cleanText(getRowValue(row, "comments")),
    askingPrice: cleanNumber(getRowValue(row, "askingPrice")),
    photo: cleanText(getRowValue(row, "photo")),
    listAgent1: [cleanText(getRowValue(row, "listAgent1First")), cleanText(getRowValue(row, "listAgent1Last"))].filter(Boolean).join(" "),
    listAgent2: [cleanText(getRowValue(row, "listAgent2First")), cleanText(getRowValue(row, "listAgent2Last"))].filter(Boolean).join(" "),
    procAgent1: [cleanText(getRowValue(row, "procAgent1First")), cleanText(getRowValue(row, "procAgent1Last"))].filter(Boolean).join(" "),
    procAgent2: [cleanText(getRowValue(row, "procAgent2First")), cleanText(getRowValue(row, "procAgent2Last"))].filter(Boolean).join(" "),
    verified: cleanFlag(getRowValue(row, "verified")),
    updatedBy: cleanText(getRowValue(row, "updatedBy")),
    apn: cleanText(getRowValue(row, "APN")),
  };
}

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): CompRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<CompRow>(sheet, {
    raw: true,
    defval: "",
  });
}

function parseWorkbook(workbook: XLSX.WorkBook, workbookName: string): ParsedCompWorkbook {
  const canonicalLeaseSheet = workbook.SheetNames.includes("LeeIrvine_LeaseComps")
    ? "LeeIrvine_LeaseComps"
    : workbook.SheetNames.find(name => name.toLowerCase().includes("lease")) || "";
  const canonicalSaleSheet = workbook.SheetNames.includes("LeeIrvine_SalesComps")
    ? "LeeIrvine_SalesComps"
    : workbook.SheetNames.find(name => name.toLowerCase().includes("sale")) || "";

  if (!canonicalLeaseSheet || !canonicalSaleSheet) {
    throw new Error("Could not identify the canonical lease and sale comp sheets.");
  }

  const leaseRows = sheetToRows(workbook, canonicalLeaseSheet);
  const saleRows = sheetToRows(workbook, canonicalSaleSheet);

  const regionalLeaseSheets = workbook.SheetNames.filter(
    name => name.startsWith("Lease_") && name !== canonicalLeaseSheet
  ).map(sheetName => ({
    sheetName,
    rowCount: sheetToRows(workbook, sheetName).length,
  }));

  return {
    workbookName,
    canonicalLeaseSheet,
    canonicalSaleSheet,
    leaseRecords: leaseRows.map(row => normalizeLeaseCompRecord(row, canonicalLeaseSheet)),
    saleRecords: saleRows.map(row => normalizeSaleCompRecord(row, canonicalSaleSheet)),
    regionalLeaseSheets,
  };
}

export function parseCompWorkbookBuffer(buffer: Buffer | Uint8Array, workbookName: string): ParsedCompWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return parseWorkbook(workbook, workbookName);
}

export function parseCompWorkbook(filePath: string): ParsedCompWorkbook {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Workbook not found: ${resolvedPath}`);
  }

  const workbook = XLSX.readFile(resolvedPath, { cellDates: true });
  return parseWorkbook(workbook, path.basename(resolvedPath));
}

export function buildLeaseReportCard(record: LeaseCompRecord): LeaseReportCard {
  return {
    heading: record.projectName || record.address,
    addressLine: record.address,
    cityLine: [record.city, record.state, record.zipCode].filter(Boolean).join(", "),
    submarketLine: [record.market, record.subMarket].filter(Boolean).join(" / "),
    listingBrokerLine: buildBrokerLine("List", record.listBroker, [record.listAgent1, record.listAgent2]),
    procuringBrokerLine: buildBrokerLine("Proc", record.procBroker, [record.procAgent1, record.procAgent2]),
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    photo: record.photo,
    fields: {
      "Space Leased": formatNumber(record.leasedSqFt),
      Office: formatNumber(record.officeSqFt),
      "Trans. Date": formatReportDate(record.transactionDate),
      "Prop. Type": record.propertyType,
      "On Mrkt": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Lessee: record.lessee,
      "Rent/SqFt": [formatCurrencyPerSf(record.rentPerSqFt), abbreviateRentTypeForReport(record.rentType)]
        .filter(Boolean)
        .join(" "),
      "TI Allow": record.tia,
      "Expir. Date": formatReportDate(record.expirationDate),
      Subtype: record.propertySubType,
      Amps: formatNumber(record.amperage),
      GL: formatNumber(record.glDoors),
      Rail: record.rail,
      Lessor: record.lessor,
      "Eff. Rent": formatCurrencyPerSf(record.effectiveRent),
      "Free Rent": record.freeRentMonths !== null ? `${formatNumber(record.freeRentMonths)} mos` : "",
      Term: record.termInMonths !== null ? `${formatNumber(record.termInMonths)} mos` : "",
      "Bldg. Class": record.buildingClass,
      "Mul-Ten": record.multiTenant,
      POL: record.pol,
      Yrd: record.yard,
      "Space Type": record.spaceType,
      "Bldg SqFt": formatNumber(record.buildingSqFt),
      "NNN Chgs": formatCurrencyPerSf(record.nnnCharges),
      "Occ Date": formatReportDate(record.occupancyDate),
      Parking: formatParkingRatioDisplay(record.parkingRatio),
      "Yr Built": formatPlainInteger(record.yearBuilt),
      HT: formatNumber(record.clearHeight),
      Land: formatNumber(record.landSqFt),
      "Options/Rent Adj": [record.options, formatRentAdjustmentsDisplay(record.rentAdjustments)]
        .filter(Boolean)
        .join(" / "),
    },
  };
}

export function buildSaleReportCard(record: SaleCompRecord): SaleReportCard {
  return {
    heading: record.projectName || record.address,
    addressLine: record.address,
    cityLine: [record.city, record.state, record.zipCode].filter(Boolean).join(", "),
    submarketLine: [record.market, record.subMarket].filter(Boolean).join(" / "),
    listingBrokerLine: buildBrokerLine("List", record.listBroker, [record.listAgent1, record.listAgent2]),
    procuringBrokerLine: buildBrokerLine("Proc", record.procBroker, [record.procAgent1, record.procAgent2]),
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    photo: record.photo,
    fields: {
      "Bldg. SqFt": formatNumber(record.buildingSqFt),
      "Sale Price": formatCurrency(record.salePrice),
      "Trans. Date": formatReportDate(record.transactionDate),
      "Prop. Type": record.propertyType,
      "Yr Built": formatPlainInteger(record.yearBuilt),
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Buyer: record.buyer,
      "Office SqFt": formatNumber(record.officeSqFt),
      "Sale $/SF": formatCurrencyPerSf(record.salePricePerSqFt),
      "On Market": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      Subtype: record.propertySubType,
      "Mul-Tnt": record.multiTenant,
      GL: formatNumber(record.glDoors),
      RR: record.rail,
      Seller: record.seller,
      "Land Size": formatNumber(record.landSqFt),
      "Trans. Type": formatSaleTransactionTypeDisplay(record.transactionType),
      "Cap Rate": record.capRate !== null ? `${record.capRate}%` : "",
      "Bldg. Class": record.buildingClass,
      Amps: formatNumber(record.amperage),
      Clr: formatNumber(record.clearHeight),
      Yard: record.yard,
      "Buyer Previous Location": record.buyerPriorLocation,
    },
  };
}
