#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import { dealiusFetch, getDealiusConfig } from "../lib/dealius/client";

type LookupItem = { id?: number | string; name?: string; [k: string]: unknown };

type CallResult = {
  path: string;
  url: string;
  status: number;
  ok: boolean;
  error?: string;
  body?: unknown;
  count?: number;
};

const LOOKUP_PATHS = [
  "/api/lookup/listingtypes",
  "/api/lookup/listingstatuses",
  "/api/lookup/listingsources",
  "/api/lookup/listingorigins",
  "/api/lookup/listingcommissiontypes",
  "/api/lookup/leasetypes",
  "/api/lookup/additionalleasetypes",
  "/api/lookup/transactionconditions",
  "/api/lookup/reprenewaltypes",
  "/api/lookup/rentpersftypes",
];

const EXTRA_PATHS = [
  "/api/account",
  "/api/brokers?page=1&pageSize=50",
  "/api/companies?pageSize=20",
];

const OUTPUT_FILE = "/tmp/dealius_lookups.json";

function previewBody(body: unknown): string {
  try {
    const s = JSON.stringify(body);
    if (s.length <= 240) return s;
    return s.slice(0, 240) + "…";
  } catch {
    return String(body);
  }
}

async function call(path: string): Promise<CallResult> {
  const cfg = await getDealiusConfig();
  const url = `${cfg.baseUrl}${path}`;
  try {
    const r = await dealiusFetch(path, { configOverride: cfg });
    const text = await r.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    const count = Array.isArray(body) ? body.length : undefined;
    return { path, url, status: r.status, ok: r.ok, body, count };
  } catch (e) {
    return {
      path,
      url,
      status: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function formatLookupTable(name: string, items: unknown): string {
  if (!Array.isArray(items)) return `  (not an array — got ${typeof items})`;
  const rows: string[] = [];
  rows.push(`  ${name} (${items.length} rows):`);
  for (const it of items as LookupItem[]) {
    const id = it && typeof it === "object" ? (it.id ?? "?") : "?";
    const label =
      (it && typeof it === "object" && (it.name as string)) ||
      (it && typeof it === "object" && ((it as any).displayName as string)) ||
      (it && typeof it === "object" && ((it as any).description as string)) ||
      "(no name)";
    rows.push(`    ${String(id).padEnd(6)} ${label}`);
  }
  return rows.join("\n");
}

async function main() {
  console.log("=== Dealius API Exploration ===");
  const cfg = await getDealiusConfig();
  console.log(`baseUrl: ${cfg.baseUrl}`);
  console.log(`enabled: ${cfg.enabled}`);
  console.log(`apiKey set: ${cfg.apiKey ? "yes" : "NO — aborting"}`);
  if (!cfg.apiKey) {
    console.error("ERROR: Dealius API key is not configured. Save it in admin Settings first.");
    process.exit(1);
  }
  if (!cfg.enabled) {
    console.warn(
      "WARNING: Dealius API integration is currently disabled in Settings. dealiusFetch will refuse — flip the toggle on first."
    );
    process.exit(1);
  }

  const results: Record<string, CallResult> = {};

  for (const path of [...LOOKUP_PATHS, ...EXTRA_PATHS]) {
    process.stdout.write(`→ GET ${path} ... `);
    const r = await call(path);
    results[path] = r;
    if (r.ok) {
      console.log(`${r.status} OK${r.count !== undefined ? ` (${r.count} items)` : ""}`);
      console.log(`   ${previewBody(r.body)}`);
    } else {
      console.log(`${r.status} FAIL${r.error ? ` — ${r.error}` : ""}`);
      if (r.status === 404) {
        console.log("   (endpoint not available on this tenant — skipping)");
      } else if (r.body !== undefined) {
        console.log(`   ${previewBody(r.body)}`);
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nFull results written to ${OUTPUT_FILE}`);

  console.log("\n=== Lookup Tables (id → name) ===");
  const lookupSummaryPaths = [
    "/api/lookup/listingtypes",
    "/api/lookup/listingstatuses",
    "/api/lookup/listingsources",
    "/api/lookup/listingcommissiontypes",
    "/api/lookup/listingorigins",
    "/api/lookup/transactionconditions",
  ];
  for (const p of lookupSummaryPaths) {
    const r = results[p];
    if (!r || !r.ok) {
      console.log(`\n${p}: (no data — status ${r?.status ?? "n/a"})`);
      continue;
    }
    console.log("");
    console.log(formatLookupTable(p, r.body));
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
