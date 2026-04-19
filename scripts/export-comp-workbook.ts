import fs from "node:fs";
import path from "node:path";
import {
  buildLeaseReportCard,
  buildSaleReportCard,
  parseCompWorkbook,
} from "../shared/comp-data";

const args = process.argv.slice(2).filter(arg => arg !== "--");
const inputPath = args[0];
const outputDir = args[1] || path.resolve("tmp", "comp-export");

if (!inputPath) {
  console.error("Usage: corepack pnpm comp:export -- <workbook-path> [output-dir]");
  process.exit(1);
}

const workbook = parseCompWorkbook(inputPath);
fs.mkdirSync(outputDir, { recursive: true });

const payload = {
  workbookName: workbook.workbookName,
  canonicalLeaseSheet: workbook.canonicalLeaseSheet,
  canonicalSaleSheet: workbook.canonicalSaleSheet,
  leaseCount: workbook.leaseRecords.length,
  saleCount: workbook.saleRecords.length,
  regionalLeaseSheets: workbook.regionalLeaseSheets,
};

fs.writeFileSync(
  path.join(outputDir, "workbook-summary.json"),
  JSON.stringify(payload, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "lease-comps.json"),
  JSON.stringify(workbook.leaseRecords, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "sale-comps.json"),
  JSON.stringify(workbook.saleRecords, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "lease-report-cards.sample.json"),
  JSON.stringify(workbook.leaseRecords.slice(0, 10).map(buildLeaseReportCard), null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "sale-report-cards.sample.json"),
  JSON.stringify(workbook.saleRecords.slice(0, 10).map(buildSaleReportCard), null, 2)
);

console.log(`Exported normalized comp data to ${outputDir}`);
