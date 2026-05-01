import fs from "fs";
import XLSX from "xlsx";
import { ENV } from "../_core/env";

export type DealiusDirectoryUser = {
  userId: number;
  name: string;
  email: string | null;
  roles: string;
  office: string;
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number.parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Same normalization as broker matching (duplicated to avoid import cycles). */
export function normDirName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip UI suffixes from Dealius "Name" column (e.g. Chris Barnett (Shareholder), John Collins*). */
export function stripDirectoryDisplayName(raw: string): string {
  return String(raw || "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\*\s*$/g, "")
    .trim();
}

/**
 * Parses the standard Dealius **Users** Excel export (sheet `Report`, header row containing `ID` + `Name`).
 */
export function parseDealiusUsersReportXlsx(buffer: Buffer): DealiusDirectoryUser[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (str(r[0]) === "ID" && str(r[1]) === "Name") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const out: DealiusDirectoryUser[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const userId = num(r[0]);
    const displayName = str(r[1]);
    if (userId == null || !displayName) continue;
    const emailRaw = str(r[4]);
    const email =
      emailRaw && !emailRaw.toLowerCase().includes("@example.com") && emailRaw.includes("@") ? emailRaw : null;
    out.push({
      userId,
      name: displayName,
      email,
      roles: str(r[2]),
      office: str(r[3]),
    });
  }
  return out;
}

function normalizeJsonRow(raw: Record<string, unknown>): DealiusDirectoryUser | null {
  const userId = num(raw.userId ?? raw.UserID ?? raw.id ?? raw.ID);
  const name = str(raw.name ?? raw.Name);
  if (userId == null || !name) return null;
  const emailRaw = str(raw.email ?? raw.Email ?? raw.emailAddress ?? raw["Email Address"]);
  const email =
    emailRaw && !emailRaw.toLowerCase().includes("@example.com") && emailRaw.includes("@") ? emailRaw : null;
  return {
    userId,
    name,
    email,
    roles: str(raw.roles ?? raw.Roles),
    office: str(raw.office ?? raw.Office),
  };
}

export function parseDealiusUsersDirectoryJson(text: string): DealiusDirectoryUser[] {
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) return [];
  const out: DealiusDirectoryUser[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const u = normalizeJsonRow(row as Record<string, unknown>);
    if (u) out.push(u);
  }
  return out;
}

export type BrokerDirectoryHints = {
  /** Extra `/brokers?SearchTerm=` strings (canonical names, work emails). */
  searchTerms: string[];
  /** Broker API rows whose email is in this set get a score boost. */
  boostEmails: Set<string>;
};

/**
 * Maps a voucher/agent string to Dealius directory users so we can search the broker API with richer terms
 * (e.g. `ARGUELLO, TIM` → also search `Tim Arguello`, `targuello@...`).
 */
export function directoryHintsForBrokerName(clean: string, directory: DealiusDirectoryUser[]): BrokerDirectoryHints {
  const searchTerms = new Set<string>();
  const boostEmails = new Set<string>();
  if (!clean.trim() || !directory.length) {
    return { searchTerms: [], boostEmails };
  }

  const needle = normDirName(clean);
  const commaParts = clean.split(",").map(s => s.trim()).filter(Boolean);
  const flippedInput =
    commaParts.length >= 2 ? `${commaParts.slice(1).join(" ")} ${commaParts[0]}`.trim() : "";
  const needleFlipInput = normDirName(flippedInput);

  for (const u of directory) {
    const display = stripDirectoryDisplayName(u.name);
    const n = normDirName(display);
    if (!n) continue;

    const parts = display.split(/\s+/).filter(Boolean);
    const flippedDisplay =
      parts.length >= 2 ? `${parts.slice(1).join(" ")} ${parts[0]}`.trim() : "";
    const nFlip = normDirName(flippedDisplay);

    const match =
      n === needle ||
      n === needleFlipInput ||
      needle === nFlip ||
      needleFlipInput === n ||
      (needle.length >= 4 && (n.includes(needle) || needle.includes(n)));

    if (match) {
      if (display && normDirName(display) !== needle) searchTerms.add(display);
      if (u.email) {
        searchTerms.add(u.email);
        boostEmails.add(u.email.toLowerCase());
      }
    }
  }

  return { searchTerms: Array.from(searchTerms), boostEmails };
}

let cachedPath: string | null = null;
let cachedList: DealiusDirectoryUser[] | null = null;

/** Test hook */
export function clearDealiusUserDirectoryCache() {
  cachedPath = null;
  cachedList = null;
}

/**
 * Optional roster from Dealius **Users** export (.xlsx) or JSON array, for better broker resolution on deals.
 * Set `DEALIUS_USERS_DIRECTORY` to an absolute or cwd-relative path.
 */
export function getDealiusUserDirectory(): DealiusDirectoryUser[] {
  const p = ENV.dealiusUsersDirectory.trim();
  if (!p) return [];
  if (cachedList != null && cachedPath === p) return cachedList;

  try {
    if (!fs.existsSync(p)) {
      cachedPath = p;
      cachedList = [];
      return [];
    }
    const buf = fs.readFileSync(p);
    const lower = p.toLowerCase();
    const list = lower.endsWith(".json")
      ? parseDealiusUsersDirectoryJson(buf.toString("utf8"))
      : parseDealiusUsersReportXlsx(buf);
    cachedPath = p;
    cachedList = list;
    return list;
  } catch {
    cachedPath = p;
    cachedList = [];
    return [];
  }
}
