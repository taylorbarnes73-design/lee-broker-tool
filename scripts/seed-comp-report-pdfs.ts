import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import XLSX from "xlsx";
import { getDb } from "../server/db";
import { seedDirectRecords } from "../server/services/compData";
import {
  normalizeLeaseCompRecord,
  normalizeSaleCompRecord,
  type CompRow,
  type LeaseCompRecord,
  type SaleCompRecord,
} from "../shared/comp-data";

const userHome = process.env.USERPROFILE || process.env.HOME || "";
const defaultWorkbookPath =
  process.env.BROKER_TOOL_COMP_WORKBOOK ||
  path.join(userHome, "OneDrive - Lee & Associates", "LeeIrvine_Metropolis_CompData.xlsx");
const defaultUploadsRoot = path.join(process.cwd(), "Lee Broker Tool (2)", "uploads");
const defaultLeaseReportPath = path.join(defaultUploadsRoot, "Lease Comp Report - Jan - March 2026.pdf");
const defaultSaleReportPath = path.join(defaultUploadsRoot, "Sale Comp Report - Jan - March 2026.pdf");

type ParsedArgs = {
  dryRun: boolean;
  workbookPath: string;
  leaseReportPath: string;
  saleReportPath: string;
};

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const valueAfter = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
  };

  return {
    dryRun: args.includes("--dry-run"),
    workbookPath: path.resolve(valueAfter("--workbook", defaultWorkbookPath)),
    leaseReportPath: path.resolve(valueAfter("--lease-report", defaultLeaseReportPath)),
    saleReportPath: path.resolve(valueAfter("--sale-report", defaultSaleReportPath)),
  };
}

async function assertReadable(filePath: string) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Required source file not found: ${filePath}`);
  }
}

async function extractReportIds(filePath: string) {
  await assertReadable(filePath);
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  const result = await parser.getText();
  await parser.destroy?.();

  const ids = Array.from(result.text.matchAll(/#(\d{4,})/g), (match) => Number(match[1]));
  return Array.from(new Set(ids));
}

async function extractReportEntries(filePath: string) {
  await assertReadable(filePath);
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  const result = await parser.getText();
  await parser.destroy?.();

  const text = result.text.replace(/\r/g, "");
  const entries = new Map<number, string>();
  const matches = Array.from(text.matchAll(/(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s+|\n-- \d+ of \d+ --|$)/g));
  for (const match of matches) {
    const idMatches = Array.from(match[2].matchAll(/#(\d{4,})/g));
    const idMatch = idMatches[idMatches.length - 1];
    if (idMatch) entries.set(Number(idMatch[1]), match[2].trim());
  }
  return entries;
}

function splitColumns(line = "") {
  return line.split("\t").map((part) => part.trim()).filter(Boolean);
}

function numericValue(value = "") {
  const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanTextValue(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function reportDate(value = "") {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return "";
  const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function rentParts(value = "") {
  const amount = numericValue(value);
  const rentType = value.replace(/\$?\d+(?:,\d{3})*(?:\.\d+)?/g, "").trim();
  return { amount, rentType };
}

function nonHeaderLines(entry: string) {
  return entry
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Space Leased"))
    .filter((line) => !line.startsWith("Rent/SqFt"))
    .filter((line) => !line.startsWith("Eff. Rent"))
    .filter((line) => !line.startsWith("Bldg. SqFt"))
    .filter((line) => !line.startsWith("Office SqFt"))
    .filter((line) => !line.startsWith("Land Size"))
    .filter((line) => !line.startsWith("LEASE COMPARABLES"))
    .filter((line) => !line.startsWith("SALE COMPARABLES"))
    .filter((line) => !line.startsWith("Metropolis"))
    .filter((line) => !line.startsWith("Industrial"))
    .filter((line) => !line.startsWith("Thursday"))
    .filter((line) => !line.startsWith("Page "))
    .filter((line) => !line.startsWith("This information"))
    .filter((line) => line !== "(No Photo Available)");
}

function extractLineValue(entry: string, label: string) {
  const match = entry.match(new RegExp(`${label}:\\s*([^\\n]+)`));
  return cleanTextValue(match?.[1] ?? "");
}

function baseLeaseRecord(id: number): LeaseCompRecord {
  return {
    sourceSheet: "Lease Comp Report - Jan - March 2026",
    id,
    office: "",
    address: "",
    city: "",
    state: "CA",
    zipCode: "",
    market: "",
    subMarket: "",
    projectName: "",
    propertyType: "",
    propertySubType: "",
    buildingClass: "",
    spaceType: "",
    multiTenant: "",
    yearBuilt: null,
    constructionType: "",
    dhDoors: null,
    glDoors: null,
    clearHeight: null,
    amperage: null,
    parkingType: "",
    parkingRatio: "",
    sprinklers: "",
    rail: "",
    yard: "",
    pol: "",
    listBroker: "",
    procBroker: "",
    source: "",
    verifiedBy: "",
    lastUpdated: "",
    monthsOnMarket: null,
    transactionDate: "",
    occupancyDate: "",
    expirationDate: "",
    leasedSqFt: null,
    rentPerSqFt: null,
    rentType: "",
    askRentPerSqFt: null,
    askRentType: "",
    termInMonths: null,
    effectiveRent: null,
    freeRentMonths: null,
    rentAdjustments: "",
    options: "",
    tia: "",
    consideration: "",
    lessee: "",
    lesseeBusiness: "",
    lesseeContact: "",
    lesseePhone: "",
    lesseePriorLocation: "",
    lessor: "",
    comments: "",
    buildingSqFt: null,
    officeSqFt: null,
    nnnCharges: null,
    landSqFt: null,
    cam: "",
    confidential: "",
    expenseStop: "",
    rentUse: "",
    photo: "",
    listAgent1: "",
    listAgent2: "",
    procAgent1: "",
    procAgent2: "",
    verified: "",
    updatedBy: "",
    apn: "",
  };
}

function baseSaleRecord(id: number): SaleCompRecord {
  return {
    sourceSheet: "Sale Comp Report - Jan - March 2026",
    id,
    office: "",
    address: "",
    city: "",
    state: "CA",
    zipCode: "",
    market: "",
    subMarket: "",
    projectName: "",
    propertyType: "",
    propertySubType: "",
    buildingClass: "",
    yearBuilt: null,
    constructionType: "",
    dhDoors: null,
    glDoors: null,
    clearHeight: null,
    amperage: null,
    parkingType: "",
    parkingRatio: "",
    sprinklers: "",
    rail: "",
    yard: "",
    multiTenant: "",
    floors: null,
    passengerElevators: null,
    freightElevators: null,
    listBroker: "",
    procBroker: "",
    source: "",
    verifiedBy: "",
    lastUpdated: "",
    monthsOnMarket: null,
    transactionDate: "",
    buildingSqFt: null,
    landSqFt: null,
    officeSqFt: null,
    salePrice: null,
    salePricePerSqFt: null,
    capRate: null,
    transactionType: "",
    buyer: "",
    buyerBusiness: "",
    buyerContact: "",
    buyerPhone: "",
    buyerPriorLocation: "",
    seller: "",
    sellerContact: "",
    sellerPhone: "",
    comments: "",
    askingPrice: null,
    photo: "",
    listAgent1: "",
    listAgent2: "",
    procAgent1: "",
    procAgent2: "",
    verified: "",
    updatedBy: "",
    apn: "",
  };
}

function parseLeaseEntry(id: number, entry: string): LeaseCompRecord {
  const record = baseLeaseRecord(id);
  const lines = nonHeaderLines(entry);
  const first = splitColumns(lines[0]);
  const second = splitColumns(lines[1]);
  const third = splitColumns(lines[2]);
  const fourth = splitColumns(lines[3]);
  const fourthOffset = /^Submarket:|^Mrkt:/i.test(fourth[0] ?? "") ? 1 : 0;
  const firstMarketLine = [third[0], fourth[0]].find((line) => /^Submarket:|^Mrkt:/i.test(line ?? "")) ?? "";
  const marketMatch = firstMarketLine.match(/Mrkt:\s*([^/]+)(?:\/\s*Submrkt:\s*(.+))?/i);
  const submarketMatch = firstMarketLine.match(/Submarket:\s*(.+)/i);
  const brokerText = entry.replace(/\n/g, " ");
  const procBrokerMatch = brokerText.match(/Proc\. Brkr:\s*(.*?)(?=\s+List\. Brkr:|\s+Comments:|\s+Source:|\s+Updt:|$)/);
  const listBrokerMatch = brokerText.match(/List\. Brkr:\s*(.*?)(?=\s+Proc\. Brkr:|\s+Comments:|\s+Source:|\s+Updt:|$)/);
  const commentsMatch = brokerText.match(/Comments:\s*(.*?)(?=\s+Source:|\s+Updt:|$)/);
  const updateMatch = brokerText.match(/Updt:\s*([0-9/]+)/);
  const rent = rentParts(second[1]);

  record.projectName = cleanTextValue(first[0]);
  record.leasedSqFt = numericValue(first[1]);
  record.officeSqFt = numericValue(first[2]);
  record.transactionDate = reportDate(first[3]);
  record.propertyType = cleanTextValue(first[4]);
  record.monthsOnMarket = numericValue(first[5]);
  record.dhDoors = numericValue(first[6]);
  record.sprinklers = cleanTextValue(first[7]);
  record.lessee = cleanTextValue(first.slice(8).join(" "));
  record.address = cleanTextValue(second[0]);
  record.rentPerSqFt = rent.amount;
  record.rentType = rent.rentType;
  record.tia = cleanTextValue(second[2]);
  record.expirationDate = reportDate(second[3]);
  record.propertySubType = cleanTextValue(second[4]);
  record.amperage = numericValue(second[5]);
  record.glDoors = numericValue(second[6]);
  record.rail = cleanTextValue(second[7]);
  record.lessor = cleanTextValue(second.slice(8).join(" "));
  record.city = cleanTextValue(third[0].replace(/, CA.*/i, ""));
  record.effectiveRent = numericValue(third[1]);
  record.freeRentMonths = numericValue(third[2]);
  record.termInMonths = numericValue(third[3]);
  record.buildingClass = cleanTextValue(third[4]);
  record.multiTenant = cleanTextValue(third[5]);
  record.pol = cleanTextValue(third[6]);
  record.yard = cleanTextValue(third[7]);
  record.spaceType = cleanTextValue(third.slice(8).join(" "));
  record.market = cleanTextValue(marketMatch?.[1] ?? "");
  record.subMarket = cleanTextValue(marketMatch?.[2] ?? submarketMatch?.[1] ?? "");
  record.buildingSqFt = numericValue(fourth[fourthOffset]);
  record.nnnCharges = numericValue(fourth[fourthOffset + 1]);
  record.occupancyDate = reportDate(fourth[fourthOffset + 2]);
  record.parkingRatio = cleanTextValue(fourth[fourthOffset + 3]);
  record.yearBuilt = numericValue(fourth[fourthOffset + 4]);
  record.clearHeight = numericValue(fourth[fourthOffset + 5]);
  record.landSqFt = numericValue(fourth[fourthOffset + 6]);
  const optionParts = cleanTextValue(fourth.slice(fourthOffset + 7).join(" ")).split("/");
  record.options = cleanTextValue(optionParts[0] ?? "");
  record.rentAdjustments = cleanTextValue(optionParts.slice(1).join(" / "));
  record.procBroker = cleanTextValue(procBrokerMatch?.[1] ?? "");
  record.listBroker = cleanTextValue(listBrokerMatch?.[1] ?? "");
  record.comments = cleanTextValue(commentsMatch?.[1] ?? "");
  record.source = extractLineValue(entry, "Source");
  record.lastUpdated = reportDate(updateMatch?.[1] ?? "");
  return record;
}

function parseSaleEntry(id: number, entry: string): SaleCompRecord {
  const record = baseSaleRecord(id);
  const lines = nonHeaderLines(entry);
  const first = splitColumns(lines[0]);
  const second = splitColumns(lines[1]);
  const third = splitColumns(lines[2]);
  const brokerText = entry.replace(/\n/g, " ");
  const procBrokerMatch = brokerText.match(/Proc\. Brkr:\s*(.*?)(?=\s+List\. Brkr:|\s+Comments:|\s+Updated:|$)/);
  const listBrokerMatch = brokerText.match(/List\. Brkr:\s*(.*?)(?=\s+Proc\. Brkr:|\s+Comments:|\s+Updated:|$)/);
  const commentsMatch = brokerText.match(/Comments:\s*(.*?)(?=\s+Updated:|$)/);
  const updateMatch = brokerText.match(/Updated:\s*([0-9/]+)/);
  const submarketMatch = (third[0] ?? "").match(/Submarket:\s*(.+)/i);

  record.projectName = cleanTextValue(first[0]);
  record.address = cleanTextValue(first[0]);
  record.buildingSqFt = numericValue(first[1]);
  record.salePrice = numericValue(first[2]);
  record.transactionDate = reportDate(first[3]);
  record.propertyType = cleanTextValue(first[4]);
  record.yearBuilt = numericValue(first[5]);
  record.dhDoors = numericValue(first[6]);
  record.sprinklers = cleanTextValue(first[7]);
  record.buyer = cleanTextValue(first.slice(8).join(" "));
  record.city = cleanTextValue((second[0] ?? "").replace(/, CA.*/i, ""));
  record.officeSqFt = numericValue(second[1]);
  record.salePricePerSqFt = numericValue(second[2]);
  record.monthsOnMarket = numericValue(second[3]);
  record.propertySubType = cleanTextValue(second[4]);
  record.multiTenant = cleanTextValue(second[5]);
  record.glDoors = numericValue(second[6]);
  record.rail = cleanTextValue(second[7]);
  record.seller = cleanTextValue(second.slice(8).join(" "));
  record.subMarket = cleanTextValue(submarketMatch?.[1] ?? "");
  record.landSqFt = numericValue(third[1]);
  record.transactionType = cleanTextValue(third[2]);
  record.capRate = numericValue(third[3]);
  record.buildingClass = cleanTextValue(third[4]);
  record.amperage = numericValue(third[5]);
  record.clearHeight = numericValue(third[6]);
  record.yard = cleanTextValue(third[7]);
  record.procBroker = cleanTextValue(procBrokerMatch?.[1] ?? "");
  record.listBroker = cleanTextValue(listBrokerMatch?.[1] ?? "");
  record.comments = cleanTextValue(commentsMatch?.[1] ?? "");
  record.lastUpdated = reportDate(updateMatch?.[1] ?? "");
  record.source = "Metropolis";
  return record;
}

function requireRecords<T extends { id: number | null }>(
  label: string,
  ids: number[],
  records: T[],
  fallbackEntries: Map<number, string>,
  parseFallback: (id: number, entry: string) => T
) {
  const byId = new Map(records.filter((record) => record.id !== null).map((record) => [record.id as number, record]));
  const missing: number[] = [];
  const selected = ids.flatMap((id) => {
    const record = byId.get(id);
    if (record) {
      return [record];
    }
    const fallback = fallbackEntries.get(id);
    if (fallback) {
      return [parseFallback(id, fallback)];
    }
    {
      missing.push(id);
      return [];
    }
  });

  if (missing.length) {
    throw new Error(`${label} report IDs missing from workbook: ${missing.join(", ")}`);
  }

  return selected;
}

function workbookRows(workbook: XLSX.WorkBook, sheetName: string): CompRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<CompRow>(sheet, { raw: true, defval: "" });
}

function parseAllWorkbookRecords(workbookPath: string) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const leaseSheetNames = workbook.SheetNames.filter((name) => /lease/i.test(name));
  const saleSheetNames = workbook.SheetNames.filter((name) => /sale|sales/i.test(name));

  return {
    leaseRecords: leaseSheetNames.flatMap((sheetName) =>
      workbookRows(workbook, sheetName).map((row) => normalizeLeaseCompRecord(row, sheetName))
    ),
    saleRecords: saleSheetNames.flatMap((sheetName) =>
      workbookRows(workbook, sheetName).map((row) => normalizeSaleCompRecord(row, sheetName))
    ),
    leaseSheetCount: leaseSheetNames.length,
    saleSheetCount: saleSheetNames.length,
  };
}

async function main() {
  const args = parseArgs();
  await Promise.all([
    assertReadable(args.workbookPath),
    assertReadable(args.leaseReportPath),
    assertReadable(args.saleReportPath),
  ]);

  const [leaseIds, saleIds, leaseEntries, saleEntries] = await Promise.all([
    extractReportIds(args.leaseReportPath),
    extractReportIds(args.saleReportPath),
    extractReportEntries(args.leaseReportPath),
    extractReportEntries(args.saleReportPath),
  ]);

  console.log(`Lease report IDs: ${leaseIds.length}`);
  console.log(`Sale report IDs: ${saleIds.length}`);

  const workbook = parseAllWorkbookRecords(args.workbookPath);
  const leaseRecords = requireRecords("Lease", leaseIds, workbook.leaseRecords, leaseEntries, parseLeaseEntry);
  const saleRecords = requireRecords("Sale", saleIds, workbook.saleRecords, saleEntries, parseSaleEntry);

  const summary = {
    workbook: path.basename(args.workbookPath),
    leaseReport: path.basename(args.leaseReportPath),
    saleReport: path.basename(args.saleReportPath),
    leaseSheetsScanned: workbook.leaseSheetCount,
    saleSheetsScanned: workbook.saleSheetCount,
    leaseCount: leaseRecords.length,
    saleCount: saleRecords.length,
    firstLeaseId: leaseRecords[0]?.id ?? null,
    firstSaleId: saleRecords[0]?.id ?? null,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (args.dryRun) {
    console.log("Dry run complete. No database changes were made.");
    return;
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable. Set DATABASE_URL before seeding comp report PDFs.");
  }

  const result = await seedDirectRecords({
    db,
    workbookName: "Metropolis Q1 2026 Report Comps",
    sourceFilename: `${path.basename(args.leaseReportPath)}; ${path.basename(args.saleReportPath)}`,
    canonicalLeaseSheet: "Lease Comp Report - Jan - March 2026",
    canonicalSaleSheet: "Sale Comp Report - Jan - March 2026",
    leaseRecords,
    saleRecords,
  });

  console.log("Comp report PDF seed complete.");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Comp report PDF seed failed.");
    console.error(error);
    process.exit(1);
  });
