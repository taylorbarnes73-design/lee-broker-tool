export type PrefillBroker = {
  name: string;
  side: string;
  pct: string;
  lead: boolean;
};

function str(raw: unknown): string {
  return String(raw ?? "").trim();
}

function num(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Excel imports store shares as fractions (`0.5` = 50). Typed points stay points, and `1` stays a full share. */
function feePercentFrom(raw: unknown): string {
  const n = num(raw);
  if (n == null || n <= 0) return "";
  return String(n <= 1 ? n * 100 : n);
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlaceholderBroker(name: string): boolean {
  const value = name.trim().toLowerCase();
  if (!value) return true;
  if (/^\(.*\)$/.test(value)) return true;
  return value === "same as listing" || value === "(same as listing)";
}

/** "Jane Doe — Lee & Associates" and "Jane Doe" are the same person. */
function personKey(name: string): string {
  const trimmed = name.trim();
  if (isPlaceholderBroker(trimmed)) return "";
  const withoutHouse = trimmed.split(/\s+[—–-]\s+/)[0]?.trim() ?? trimmed;
  return withoutHouse.toLowerCase().replace(/\s+/g, " ");
}

function displayName(name: string): string {
  return name.trim().split(/\s+[—–-]\s+/)[0]?.trim() ?? name.trim();
}

function evenPercents(count: number): string[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  let remainder = 100 - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    return String(base + extra);
  });
}

function brokersFromRows(raw: unknown): PrefillBroker[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((row: { name?: unknown; brokerName?: unknown; fullName?: unknown; side?: unknown; pct?: unknown; percent?: unknown; commissionPct?: unknown; lead?: unknown }, index) => ({
      name: str(row?.name || row?.brokerName || row?.fullName),
      side: str(row?.side),
      pct: feePercentFrom(row?.pct ?? row?.percent ?? row?.commissionPct),
      lead: Boolean(row?.lead) || index === 0,
    }))
    .filter(row => row.name);
}

function brokersFromDistribution(sections: unknown): PrefillBroker[] {
  if (!Array.isArray(sections)) return [];
  const section = sections.find(item => {
    if (!item || typeof item !== "object") return false;
    return normalizeLabel(str((item as { title?: unknown }).title)) === "commissiondistribution";
  }) as { fields?: unknown } | undefined;
  if (!section || !Array.isArray(section.fields)) return [];

  const rows: PrefillBroker[] = [];
  for (const field of section.fields) {
    if (!field || typeof field !== "object") continue;
    const label = str((field as { label?: unknown }).label);
    const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const name = (match?.[1] ?? label).trim();
    const side = match?.[2]?.trim() ?? "";
    if (!personKey(name)) continue;
    const points = num((field as { value?: unknown }).value);
    rows.push({
      name,
      side,
      pct: points != null && points > 0 ? String(points) : "",
      lead: rows.length === 0,
    });
  }
  return rows;
}

function brokersFromAgentNames(names: unknown[]): PrefillBroker[] {
  const people: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = str(raw);
    const key = personKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    people.push(displayName(name));
  }
  const percents = evenPercents(people.length);
  return people.map((name, index) => ({
    name,
    side: "",
    pct: percents[index] ?? "",
    lead: index === 0,
  }));
}

/**
 * Broker rows for a Dealius deal push.
 * An explicit broker list wins. Otherwise the voucher's commission-distribution
 * section is used. Agent names are the last resort, and the account that
 * submitted the form is included only when no agent was named — otherwise that
 * person is added again at 50% and the split exceeds 100%.
 */
export function prefillDealBrokers(input: {
  brokers?: unknown;
  agents?: unknown;
  listingAgentName?: unknown;
  procuringAgentName?: unknown;
  laName?: unknown;
  paName?: unknown;
  sections?: unknown;
  submittedBy?: unknown;
}): PrefillBroker[] {
  const explicit = brokersFromRows(input.brokers);
  if (explicit.length) return explicit;
  const fromAgentsList = brokersFromRows(input.agents);
  if (fromAgentsList.length) return fromAgentsList;

  const distributed = brokersFromDistribution(input.sections);
  if (distributed.length) return distributed;

  const agentNames = [
    input.listingAgentName,
    input.procuringAgentName,
    input.laName,
    input.paName,
    fieldValue(input.sections, ["Agent 1 Name", "Listing Agent"]),
    fieldValue(input.sections, ["Agent 2 Name", "Procuring Agent"]),
  ];
  const agents = brokersFromAgentNames(agentNames);
  if (agents.length) return agents;
  return brokersFromAgentNames([input.submittedBy]);
}

function fieldValue(sections: unknown, labels: string[]): string {
  if (!Array.isArray(sections)) return "";
  const wanted = new Set(labels.map(normalizeLabel));
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const fields = (section as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const label = str((field as { label?: unknown }).label);
      if (wanted.has(normalizeLabel(label))) return str((field as { value?: unknown }).value);
    }
  }
  return "";
}
