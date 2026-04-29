import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { uploads, compImports } from "../drizzle/schema";
import { getDb } from "../server/db";
import { storagePut } from "../server/storage";
import { importCompWorkbookBuffer } from "../server/services/compData";

type EmbeddedDocument = {
  filename: string;
  category: string;
  reference: string;
};

const userHome = process.env.USERPROFILE || process.env.HOME || "";
const blankFormsRoot =
  process.env.BROKER_TOOL_BLANK_FORMS_ROOT ||
  path.join(userHome, "OneDrive - Lee & Associates", "TB ONEDRIVE", "Blank Forms");
const compWorkbookPath =
  process.env.BROKER_TOOL_COMP_WORKBOOK ||
  path.join(userHome, "OneDrive - Lee & Associates", "LeeIrvine_Metropolis_CompData.xlsx");

const documents: EmbeddedDocument[] = [
  { filename: "Avery5164ShippingLabels.doc", category: "sign_order", reference: "Avery shipping labels" },
  { filename: "COMMERCIAL-PSA.pdf", category: "purchase_sale", reference: "Commercial purchase and sale" },
  { filename: "Deal-Listing Submission checklists.pdf", category: "office_form", reference: "Deal and listing checklists" },
  { filename: "Draft - Exclusive Right and Schedule of Commisions.pdf", category: "listing_agreement", reference: "Exclusive right and commission schedule" },
  { filename: "Exclusive-Right-To-Represnt-Owner-For-Sale-or-Lease.pdf", category: "listing_agreement", reference: "Owner sale or lease representation" },
  { filename: "LANB Letterhead copy.doc", category: "office_form", reference: "LANB letterhead" },
  { filename: "LANB Letterhead.doc", category: "office_form", reference: "LANB letterhead" },
  { filename: "LANB Wiring Instructions Rev. 10.09.2024.pdf", category: "office_form", reference: "Wiring instructions" },
  { filename: "Listings.zip", category: "listing_agreement", reference: "Listing forms archive" },
  { filename: "Overnight_Parking_Form.pdf", category: "office_form", reference: "Overnight parking" },
  { filename: "PR Request Form.pdf", category: "marketing_pr", reference: "PR request" },
  { filename: "Propertry-Information-Sheet.pdf", category: "listing_agreement", reference: "Property information sheet" },
  { filename: "PSA.pdf", category: "purchase_sale", reference: "Purchase and sale agreement" },
  { filename: "Schedule of Commissions- Blank.doc", category: "commission_agreement", reference: "Schedule of commissions" },
  { filename: "Schedule of Commissions.docx", category: "commission_agreement", reference: "Schedule of commissions" },
  { filename: "Schedule of Commissions.pdf", category: "commission_agreement", reference: "Schedule of commissions" },
  { filename: "Sign Request Form.pdf", category: "sign_order", reference: "Sign request" },
  { filename: "Updated Voucher (3.4.26).xlsm", category: "voucher_doc", reference: "Commission voucher" },
  { filename: "Updated Voucher (4.3.26).xlsm", category: "voucher_doc", reference: "Commission voucher" },
];

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".csv": "text/csv",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
    ".xls": "application/vnd.ms-excel",
    ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
  };
  return types[ext] ?? "application/octet-stream";
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function assertReadable(filePath: string) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Missing required source file: ${filePath}`);
  }
}

async function embedDocument(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, doc: EmbeddedDocument) {
  const sourcePath = path.join(blankFormsRoot, doc.filename);
  await assertReadable(sourcePath);

  const data = await fs.readFile(sourcePath);
  const fileKey = `broker-docs/${doc.category}/embedded-${safeStorageName(doc.filename)}`;
  const stored = await storagePut(fileKey, data, contentTypeFor(doc.filename));
  const existing = await db.select().from(uploads).where(eq(uploads.filename, doc.filename)).limit(1);
  const values = {
    fileKey: stored.key,
    url: stored.url,
    filename: doc.filename,
    mimeType: contentTypeFor(doc.filename),
    fileSize: data.length,
    category: doc.category,
    reference: doc.reference,
    uploaderName: "Lee & Associates Newport Beach",
    uploaderOpenId: null,
    createdAt: new Date(),
  };

  if (existing[0]) {
    await db.update(uploads).set(values).where(eq(uploads.id, existing[0].id));
    return { action: "updated", filename: doc.filename, category: doc.category, bytes: data.length };
  }

  await db.insert(uploads).values(values);
  return { action: "inserted", filename: doc.filename, category: doc.category, bytes: data.length };
}

async function embedCompWorkbook(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, force: boolean) {
  await assertReadable(compWorkbookPath);
  const filename = path.basename(compWorkbookPath);
  const latest = await db
    .select()
    .from(compImports)
    .where(eq(compImports.status, "active"))
    .orderBy(desc(compImports.createdAt))
    .limit(1);

  if (!force && latest[0]?.sourceFilename === filename) {
    return { action: "skipped", filename, reason: "latest active import already uses this workbook" };
  }

  const data = await fs.readFile(compWorkbookPath);
  const fileKey = `broker-docs/comp_workbook/embedded-${safeStorageName(filename)}`;
  const stored = await storagePut(fileKey, data, contentTypeFor(filename));
  const existing = await db.select().from(uploads).where(eq(uploads.filename, filename)).limit(1);
  const uploadValues = {
    fileKey: stored.key,
    url: stored.url,
    filename,
    mimeType: contentTypeFor(filename),
    fileSize: data.length,
    category: "comp_workbook",
    reference: "Lee Irvine Metropolis comp data",
    uploaderName: "Lee & Associates Newport Beach",
    uploaderOpenId: null,
    createdAt: new Date(),
  };

  if (existing[0]) {
    await db.update(uploads).set(uploadValues).where(eq(uploads.id, existing[0].id));
  } else {
    await db.insert(uploads).values(uploadValues);
  }

  const imported = await importCompWorkbookBuffer({
    db,
    buffer: data,
    workbookName: filename,
    sourceFilename: filename,
    sourceFileKey: stored.key,
    sourceUrl: stored.url,
    importedByEmail: "embedded-assets@lee-associates.local",
  });

  return { action: "imported", filename, bytes: data.length, ...imported };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const docsOnly = args.has("--docs-only");
  const compOnly = args.has("--comp-only");
  const forceComp = args.has("--force-comp");

  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable. Set DATABASE_URL before embedding tool assets.");
  }

  console.log(`Blank forms root: ${blankFormsRoot}`);
  console.log(`Comp workbook: ${compWorkbookPath}`);

  if (!compOnly) {
    const results: Awaited<ReturnType<typeof embedDocument>>[] = [];
    for (const doc of documents) {
      const result = await embedDocument(db, doc);
      results.push(result);
      console.log(`${result.action}: ${result.filename} (${result.category}, ${result.bytes} bytes)`);
    }
    console.log(`Document embedding complete: ${results.length} files.`);
  }

  if (!docsOnly) {
    const result = await embedCompWorkbook(db, forceComp);
    console.log(`Comp workbook ${result.action}: ${result.filename}`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Asset embedding failed.");
    console.error(error);
    process.exit(1);
  });
