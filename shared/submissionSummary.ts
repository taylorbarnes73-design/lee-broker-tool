export type SubmissionSummaryField = {
  label: string;
  value: string;
};

function parsePayload(payload: unknown): Record<string, unknown> {
  if (!payload) return {};
  if (typeof payload === "object" && payload !== null) return payload as Record<string, unknown>;
  if (typeof payload !== "string") return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function formatAddress(record: Record<string, unknown>): string | null {
  const line =
    pickString(record, ["propertyAddress", "address"]) ||
    [pickString(record, ["address"]), pickString(record, ["city"]), pickString(record, ["state"]), pickString(record, ["zip"])]
      .filter(Boolean)
      .join(", ");
  return line || null;
}

function fieldsFromSections(record: Record<string, unknown>, maxFields: number): SubmissionSummaryField[] {
  const sections = record.sections;
  if (!Array.isArray(sections)) return [];

  const out: SubmissionSummaryField[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const title = pickString(section as Record<string, unknown>, ["title"]) ?? "Details";
    const fields = (section as Record<string, unknown>).fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const label = pickString(field as Record<string, unknown>, ["label"]);
      const value = pickString(field as Record<string, unknown>, ["value"]);
      if (!label || !value) continue;
      out.push({ label: `${title} · ${label}`, value });
      if (out.length >= maxFields) return out;
    }
  }
  return out;
}

/**
 * Builds human-readable summary rows for portal display (not exhaustive).
 */
export function buildSubmissionSummaryFields(
  formType: string,
  payload: unknown,
  reference?: string | null
): SubmissionSummaryField[] {
  const record = parsePayload(payload);
  const fromSections = fieldsFromSections(record, 14);
  if (fromSections.length > 0) return fromSections;

  const rows: SubmissionSummaryField[] = [];
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value });
  };

  push("Reference", reference?.trim() || null);
  push("Property", formatAddress(record));
  push("Broker", pickString(record, ["brokerName", "submittedBy", "onBehalfOf", "clientName"]));
  push("Email", pickString(record, ["brokerEmail", "submittedByEmail", "senderEmail"]));
  push("Transaction", pickString(record, ["transactionType", "txnType", "dealType"]));
  push("Property type", pickString(record, ["propertyType", "propType"]));
  push("Deal SF", pickString(record, ["dealSF", "sizeSF", "dealSf", "bldgSF"]));
  push("Lease rate", pickString(record, ["leaseRate", "lRate", "rate"]));
  push("Sale price", pickString(record, ["salePrice", "sPrice", "price"]));
  push("Suite", pickString(record, ["suite", "piSuite", "suiteNumber"]));
  push("Representation", pickString(record, ["representationType", "repType"]));
  push("Notes", pickString(record, ["notes", "body", "adminNotes"]));

  if (rows.length === 0 && formType) {
    push("Form", formType);
  }

  return rows.slice(0, 16);
}
