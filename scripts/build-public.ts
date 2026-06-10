import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "client", "public");
const outDir = path.join(repoRoot, "dist", "public");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyRecursive(params: { from: string; to: string }) {
  await ensureDir(params.to);
  const entries = await fs.readdir(params.from, { withFileTypes: true });
  for (const ent of entries) {
    const fromPath = path.join(params.from, ent.name);
    const toPath = path.join(params.to, ent.name);
    if (ent.isDirectory()) {
      await copyRecursive({ from: fromPath, to: toPath });
      continue;
    }
    if (ent.isFile()) {
      await fs.copyFile(fromPath, toPath);
    }
  }
}

async function main() {
  await ensureDir(outDir);
  await copyRecursive({ from: srcDir, to: outDir });
  // eslint-disable-next-line no-console
  console.log(`Copied public assets → ${path.relative(repoRoot, outDir)}`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
