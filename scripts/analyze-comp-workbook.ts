import { parseCompWorkbook } from "../shared/comp-data";

function minDate(values: string[]): string {
  return [...values].sort()[0] || "";
}

function maxDate(values: string[]): string {
  return [...values].sort().at(-1) || "";
}

function isPlausibleReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1950 && year <= 2100;
}

function topCounts(values: string[], limit = 8): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const args = process.argv.slice(2).filter(arg => arg !== "--");
const inputPath = args[0];

if (!inputPath) {
  console.error("Usage: corepack pnpm comp:analyze -- <workbook-path>");
  process.exit(1);
}

const workbook = parseCompWorkbook(inputPath);

const leaseDates = workbook.leaseRecords
  .map(record => record.transactionDate)
  .filter(isPlausibleReportDate);
const saleDates = workbook.saleRecords
  .map(record => record.transactionDate)
  .filter(isPlausibleReportDate);

console.log(`Workbook: ${workbook.workbookName}`);
console.log(`Lease sheet: ${workbook.canonicalLeaseSheet} (${workbook.leaseRecords.length.toLocaleString()} rows)`);
console.log(`Sale sheet: ${workbook.canonicalSaleSheet} (${workbook.saleRecords.length.toLocaleString()} rows)`);
console.log("");

console.log("Lease overview");
console.log(`- Date range: ${minDate(leaseDates)} to ${maxDate(leaseDates)}`);
console.log(`- Top markets: ${JSON.stringify(topCounts(workbook.leaseRecords.map(record => record.market)))}`);
console.log(`- Top submarkets: ${JSON.stringify(topCounts(workbook.leaseRecords.map(record => record.subMarket)))}`);
console.log(`- Top property types: ${JSON.stringify(topCounts(workbook.leaseRecords.map(record => record.propertyType)))}`);
console.log("");

console.log("Sale overview");
console.log(`- Date range: ${minDate(saleDates)} to ${maxDate(saleDates)}`);
console.log(`- Top markets: ${JSON.stringify(topCounts(workbook.saleRecords.map(record => record.market)))}`);
console.log(`- Top submarkets: ${JSON.stringify(topCounts(workbook.saleRecords.map(record => record.subMarket)))}`);
console.log(`- Top property types: ${JSON.stringify(topCounts(workbook.saleRecords.map(record => record.propertyType)))}`);
console.log("");

console.log("Regional lease sheets");
for (const sheet of workbook.regionalLeaseSheets) {
  console.log(`- ${sheet.sheetName}: ${sheet.rowCount.toLocaleString()} rows`);
}
