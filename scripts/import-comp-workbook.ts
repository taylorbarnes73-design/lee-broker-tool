import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../server/db";
import { importCompWorkbookBuffer } from "../server/services/compData";

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== "--");
  const inputPath = args[0];

  if (!inputPath) {
    throw new Error("Usage: corepack pnpm comp:import -- <workbook-path>");
  }

  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Workbook not found: ${resolvedPath}`);
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable. Set DATABASE_URL before importing comp data.");
  }

  const buffer = await fs.promises.readFile(resolvedPath);
  const result = await importCompWorkbookBuffer({
    db,
    buffer,
    workbookName: path.basename(resolvedPath),
    sourceFilename: path.basename(resolvedPath),
  });

  console.log("Comp workbook import complete.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error("Comp workbook import failed.");
  console.error(error);
  process.exit(1);
});
