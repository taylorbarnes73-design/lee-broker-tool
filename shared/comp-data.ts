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
  cam: string;
  confidential: string;
  expenseStop: string;
  rentUse: string;
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

function joinAddress(parts: unknown[]): string {
  const streetCore = parts.map(cleanText).filter(Boolean).join(" ");
  return streetCore.replace(/\s+/g, " ").trim();
}

function getRowValue(row: CompRow, key: string): unknown {
  return row[key];
}

function formatNumber(value: number | null, decimals = 0): string {
  if (value === null) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value: number | null, decimals = 0): string {
  if (value === null) return "";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatCurrencyPerSf(value: number | null, suffix = ""): string {
  if (value === null) return "";
  const decimals = value % 1 === 0 ? 2 : 3;
  return `${formatCurrency(value, decimals)}${suffix}`;
}

function formatReportDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US");
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
    cam: cleanText(getRowValue(row, "CAM")),
    confidential: cleanFlag(getRowValue(row, "confidential")),
    expenseStop: cleanText(getRowValue(row, "expenseStop")),
    rentUse: cleanText(getRowValue(row, "rentUse")),
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
    listingBrokerLine: record.listBroker ? `List. Brkr: ${record.listBroker}` : "",
    procuringBrokerLine: record.procBroker ? `Proc. Brkr: ${record.procBroker}` : "",
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    fields: {
      "Space Leased": formatNumber(record.leasedSqFt),
      Office: formatNumber(record.officeSqFt),
      "Trans. Date": record.transactionDate,
      "Prop. Type": record.propertyType,
      "On Mrkt": record.monthsOnMarket !== null ? `${formatNumber(record.monthsOnMarket)} mos` : "",
      DH: formatNumber(record.dhDoors),
      Sprk: record.sprinklers,
      Lessee: record.lessee,
      "Rent/SqFt": [formatCurrencyPerSf(record.rentPerSqFt), record.rentType].filter(Boolean).join(" "),
      "TI Allow": record.tia,
      "Expir. Date": record.expirationDate,
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
      "Occ Date": record.occupancyDate,
      Parking: record.parkingRatio,
      "Yr Built": formatNumber(record.yearBuilt),
      HT: formatNumber(record.clearHeight),
      Land: "",
      "Options/Rent Adj": [record.options, record.rentAdjustments].filter(Boolean).join(" / "),
    },
  };
}

export function buildSaleReportCard(record: SaleCompRecord): SaleReportCard {
  return {
    heading: record.projectName || record.address,
    addressLine: record.address,
    cityLine: [record.city, record.state, record.zipCode].filter(Boolean).join(", "),
    submarketLine: [record.market, record.subMarket].filter(Boolean).join(" / "),
    listingBrokerLine: record.listBroker ? `List. Brkr: ${record.listBroker}` : "",
    procuringBrokerLine: record.procBroker ? `Proc. Brkr: ${record.procBroker}` : "",
    sourceLine: record.source ? `Source: ${record.source}` : "",
    updatedLine: buildUpdateLine(record.verifiedBy, record.lastUpdated, record.id),
    comments: record.comments,
    fields: {
      "Bldg. SqFt": formatNumber(record.buildingSqFt),
      "Sale Price": formatCurrency(record.salePrice),
      "Trans. Date": record.transactionDate,
      "Prop. Type": record.propertyType,
      "Yr Built": formatNumber(record.yearBuilt),
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
      "Trans. Type": record.transactionType,
      "Cap Rate": record.capRate !== null ? `${record.capRate}%` : "",
      "Bldg. Class": record.buildingClass,
      Amps: formatNumber(record.amperage),
      Clr: formatNumber(record.clearHeight),
      Yard: record.yard,
      "Buyer Previous Location": record.buyerPriorLocation,
    },
  };
}
