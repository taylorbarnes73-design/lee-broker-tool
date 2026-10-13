export type PortalRentRow = { months: string; monthly: string; free: boolean };

export type PortalVoucherDealFields = {
  address: string;
  suite: string;
  city: string;
  zip: string;
  dealSf: string;
  startDate: string;
  endDate: string;
  occupancyDate: string;
  term: string;
  askingRate: string;
  feePercent: string;
  salePrice: string;
  repTypeID: string;
  clientCo: string;
  oppositeCo: string;
  rentRows: PortalRentRow[];
  /** True when this payload is a portal voucher, so an empty schedule must stay empty. */
  hasPortalRentSource: boolean;
};

const EMPTY_PORTAL_FIELDS: PortalVoucherDealFields = {
  address: "",
  suite: "",
  city: "",
  zip: "",
  dealSf: "",
  startDate: "",
  endDate: "",
  occupancyDate: "",
  term: "",
  askingRate: "",
  feePercent: "",
  salePrice: "",
  repTypeID: "",
  clientCo: "",
  oppositeCo: "",
  rentRows: [],
  hasPortalRentSource: false,
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

function compact(raw: unknown): string {
  const n = num(raw);
  return n == null ? "" : String(n);
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function fieldValue(payload: Record<string, unknown>, labels: string[]): string {
  const wanted = new Set(labels.map(normalizeLabel));
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  for (const section of sections) {
    const fields = Array.isArray(record(section).fields) ? (record(section).fields as unknown[]) : [];
    for (const field of fields) {
      const row = record(field);
      if (wanted.has(normalizeLabel(str(row.label)))) return str(row.value);
    }
  }
  return "";
}

function repTypeIdFromLabel(raw: unknown): string {
  const value = str(raw).toLowerCase();
  if (!value) return "";
  if (/^[1-5]$/.test(value)) return value;
  if (value.includes("tenant")) return "3";
  if (value.includes("landlord")) return "4";
  if (value.includes("buyer")) return "1";
  if (value.includes("seller")) return "2";
  if (value.includes("referr") || value.includes("other")) return "5";
  return "";
}

function companyOnly(raw: string): string {
  const splitAt = raw.indexOf(" / ");
  return (splitAt >= 0 ? raw.slice(0, splitAt) : raw).trim();
}

function rentRowsFromStructured(raw: unknown): PortalRentRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: PortalRentRow[] = [];
  for (const row of raw) {
    const recordRow = record(row);
    const months = num(recordRow.months);
    if (months == null || months <= 0) continue;
    const monthly = num(recordRow.monthly);
    rows.push({
      months: String(months),
      monthly: monthly == null ? "" : String(monthly),
      free: monthly === 0,
    });
  }
  return rows;
}

function rentRowsFromSections(payload: Record<string, unknown>): PortalRentRow[] {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const rows: PortalRentRow[] = [];
  for (const section of sections) {
    const sectionRecord = record(section);
    if (normalizeLabel(str(sectionRecord.title)) !== "rentschedule") continue;
    const fields = Array.isArray(sectionRecord.fields) ? sectionRecord.fields : [];
    for (const field of fields) {
      const value = str(record(field).value);
      const match = value.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*[×x]\s*([\d,]+(?:\.\d+)?)\s*months/i);
      if (!match) continue;
      const monthly = num(match[1]);
      const months = num(match[2]);
      if (months == null || months <= 0) continue;
      rows.push({
        months: String(months),
        monthly: monthly == null ? "" : String(monthly),
        free: monthly === 0,
      });
    }
  }
  return rows;
}

/**
 * Fields a portal commission voucher already stored, but under formData and
 * section labels the Dealius workspace did not read.
 */
export function portalVoucherDealFields(payload: unknown): PortalVoucherDealFields {
  const root = record(payload);
  const form = record(root.formData);
  if (!Object.keys(form).length && !Array.isArray(root.sections)) return EMPTY_PORTAL_FIELDS;

  const txn = str(form.txnType || fieldValue(root, ["Transaction Type"]));
  const isSale = txn.toLowerCase().includes("sale") && !txn.toLowerCase().includes("lease");
  const repTypeID = repTypeIdFromLabel(form.repType || fieldValue(root, ["Representation"]));
  const sellerSide = str(form.lsCompany) || companyOnly(fieldValue(root, ["Lessor", "Seller"]));
  const buyerSide = str(form.lbCompany) || companyOnly(fieldValue(root, ["Lessee", "Buyer"]));
  const representedBuyerSide = repTypeID === "3" || repTypeID === "1";
  const leaseFee = compact(form.lCommRate) || compact(fieldValue(root, ["Commission Rate"]));
  const saleFee = compact(form.sCommPct) || compact(fieldValue(root, ["Sale Commission %"]));
  const structuredRent = rentRowsFromStructured(form.rentRows);
  const scheduleText = rentRowsFromSections(root);
  const hasPortalRentSource = Object.keys(form).length > 0 || scheduleText.length > 0 || rentScheduleSectionExists(root);

  return {
    address: str(form.address),
    suite: str(form.suite),
    city: str(form.city),
    zip: str(form.zip),
    dealSf: compact(form.dealSf),
    startDate: str(form.lStart || fieldValue(root, ["Start Date", "Commencement Date"])).slice(0, 10),
    endDate: str(form.lEnd || fieldValue(root, ["End Date", "Expiration Date"])).slice(0, 10),
    occupancyDate: str(form.lOcc || fieldValue(root, ["Occupancy Date"])).slice(0, 10),
    term: compact(form.lTerm || fieldValue(root, ["Term (months)", "Lease Term (months)", "Lease Term"])),
    askingRate: compact(form.lRate || fieldValue(root, ["Rate/SF/Mo"])),
    feePercent: isSale ? saleFee || leaseFee : leaseFee || saleFee,
    salePrice: compact(form.sPrice || fieldValue(root, ["Sale Price"])),
    repTypeID,
    clientCo: representedBuyerSide ? buyerSide : sellerSide,
    oppositeCo: representedBuyerSide ? sellerSide : buyerSide,
    rentRows: structuredRent.length ? structuredRent : scheduleText,
    hasPortalRentSource,
  };
}

function rentScheduleSectionExists(payload: Record<string, unknown>): boolean {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  return sections.some(section => normalizeLabel(str(record(section).title)) === "rentschedule");
}
