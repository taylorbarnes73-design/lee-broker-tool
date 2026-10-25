import JSZip from "jszip";

const TEMPLATE_URL = "/templates/commission-voucher-template.xlsm";
const MIME = "application/vnd.ms-excel.sheet.macroEnabled.12";

export type RentRow = { monthly: number | null; months: number | null; commPct: string };
export type OutsideRow = { side: string; name: string; address: string; amount: string };
export type DistRow = { name: string; side: string; pct: string };
export type PaymentRow = { date1: string; amount1: string; date2: string; amount2: string };

export type VoucherExcelData = {
  txnType: string;
  propType: string;
  otherType: string;
  activeListing: string;
  closeListing: string;
  confidential: string;
  dateFilled: string;
  address: string;
  city: string;
  zip: string;
  suite: string;
  occType: string;
  dealType: string;
  priorLoc: string;
  dealSf: string;
  submarket: string;
  landSf: string;
  bldgSf: string;
  bldgClass: string;
  yearBuilt: string;
  lsCompany: string;
  lbCompany: string;
  lsContact: string;
  lbContact: string;
  lsEmail: string;
  lbEmail: string;
  lsAddress: string;
  lbAddress: string;
  lsCity: string;
  lbCity: string;
  lsState: string;
  lbState: string;
  lsZip: string;
  lbZip: string;
  lsPhone: string;
  lbPhone: string;
  lStart: string;
  lEnd: string;
  lOcc: string;
  lTerm: string;
  lRate: string;
  lRateType: string;
  lAskingRate: string;
  sPrice: string;
  sBuyerType: string;
  sAsking: string;
  sCap: string;
  sEscrow: string;
  sEscrowCheck: string;
  rentRows: RentRow[];
  commBonus: string;
  commConsulting: string;
  sCommPct: string;
  invoiceTo: string;
  invCompany: string;
  invAddress: string;
  invInstructions: string;
  paymentRows: PaymentRow[];
  sameAgent: boolean;
  laName: string;
  laHouse: string;
  laAddress: string;
  laCity: string;
  laState: string;
  laZip: string;
  laPhone: string;
  laPayFee: string;
  paName: string;
  paHouse: string;
  paAddress: string;
  paCity: string;
  paState: string;
  paZip: string;
  paPhone: string;
  paPayFee: string;
  outsideRows: OutsideRow[];
  distRows: DistRow[];
  notes: string;
};

type CellOp = { type: "text"; value: string } | { type: "number"; value: number } | { type: "clear" };

function dateSerial(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const epoch = new Date(1899, 11, 30);
  return (d.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000);
}

function parseNum(s: string): number | null {
  if (!s) return null;
  const n = Number.parseFloat(s.replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parsePct(s: string): number | null {
  const n = parseNum(s);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

function yesNo(v: string): string {
  const l = v.toLowerCase();
  if (l === "yes" || l === "y" || l === "true") return "Y";
  if (l === "no" || l === "n" || l === "false") return "N";
  return "";
}

function distSide(s: string): string {
  const v = s.toLowerCase();
  if (v === "procuring") return "Procurring"; // template uses double-r
  if (v === "both") return "Both";
  if (v === "other") return "Other";
  if (v === "referring") return "Referring";
  if (v === "outside") return "Outside";
  if (v === "listing") return "Listing";
  return "";
}

function resolveInvoiceTarget(d: VoucherExcelData): { company: string; address: string } {
  const sel = d.invoiceTo;
  if (sel === "third_party" || (!sel && (d.invCompany || d.invAddress))) {
    return { company: d.invCompany, address: d.invAddress };
  }
  const partyAddr = (pCity: string, pState: string, pZip: string, pStreet: string) =>
    [[pStreet].filter(Boolean).join(""), [pCity, pState, pZip].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  if (sel === "lessor") return { company: d.lsCompany || d.lsContact || "Lessor / Seller", address: partyAddr(d.lsCity, d.lsState, d.lsZip, d.lsAddress) };
  if (sel === "lessee") return { company: d.lbCompany || d.lbContact || "Lessee / Buyer", address: partyAddr(d.lbCity, d.lbState, d.lbZip, d.lbAddress) };
  if (sel === "listing_agent") return { company: [d.laHouse, d.laName].filter(Boolean).join(" - ") || "Listing Agent", address: partyAddr(d.laCity, d.laState, d.laZip, d.laAddress) };
  if (sel === "procuring_agent") return { company: [d.paHouse, d.paName].filter(Boolean).join(" - ") || "Procuring Agent", address: partyAddr(d.paCity, d.paState, d.paZip, d.paAddress) };
  return { company: "", address: "" };
}

function buildCellOps(d: VoucherExcelData): Record<string, CellOp> {
  const ops: Record<string, CellOp> = {};

  function setText(addr: string, v: string) {
    const s = String(v ?? "").trim();
    ops[addr] = s ? { type: "text", value: s } : { type: "clear" };
  }
  function setNum(addr: string, v: string | number | null) {
    const n = typeof v === "number" ? v : parseNum(String(v ?? ""));
    ops[addr] = n != null ? { type: "number", value: n } : { type: "clear" };
  }
  function setPct(addr: string, v: string) {
    const p = parsePct(v);
    ops[addr] = p != null ? { type: "number", value: p } : { type: "clear" };
  }
  function setDate(addr: string, v: string) {
    const s = dateSerial(v);
    ops[addr] = s != null ? { type: "number", value: s } : { type: "clear" };
  }

  const invoiceTarget = resolveInvoiceTarget(d);

  setText("D4", d.txnType);
  setText("G4", d.propType);
  setText("K4", yesNo(d.activeListing));
  setText("N4", yesNo(d.closeListing));
  setText("L1", yesNo(d.confidential));
  setDate("N2", d.dateFilled);
  setText("E6", d.propType.toLowerCase() === "other" ? d.otherType : "");

  setText("B9", d.address);
  setText("K9", d.city);
  setText("N9", d.zip);

  setText("C12", d.lsCompany);
  setText("K12", d.lbCompany);
  setText("C13", d.lsContact);
  setText("K13", d.lbContact);
  setText("C14", d.lsEmail);
  setText("K14", d.lbEmail);
  setText("C15", d.lsAddress);
  setText("K15", d.lbAddress);
  setText("C16", d.lsCity);
  setText("K16", d.lbCity);
  setText("C17", d.lsState);
  setText("E17", d.lsZip);
  setText("K17", d.lbState);
  setText("M17", d.lbZip);
  setText("C18", d.lsPhone);
  setText("K18", d.lbPhone);

  setText("C22", d.suite);
  setText("E22", d.occType);
  setText("G22", d.dealType);
  setText("L22", d.priorLoc);
  setNum("C23", d.dealSf);
  setText("E23", d.submarket);
  // K23 is Sub-type (Low Rise, Whse/Dist, …). Prop Type is G4, written above.
  setNum("M23", d.landSf);
  setNum("C24", d.bldgSf);
  setText("C25", d.bldgClass);
  setNum("E25", d.yearBuilt);

  setDate("E36", d.lStart);
  setDate("H36", d.lEnd);
  setNum("M36", d.sPrice);
  setDate("B38", d.lOcc);
  setNum("E38", d.lTerm);
  setNum("C40", d.lRate);
  setText("C41", d.lRateType);
  setText("M40", d.sBuyerType);
  setNum("M41", d.sAsking);
  setPct("M42", d.sCap);
  setPct("M43", d.sCommPct);
  setText("M45", d.sEscrow);
  setText("N46", yesNo(d.sEscrowCheck));

  for (let r = 53; r <= 67; r++) {
    ops[`A${r}`] = { type: "clear" };
    ops[`D${r}`] = { type: "clear" };
    ops[`K${r}`] = { type: "clear" };
  }
  d.rentRows.slice(0, 15).forEach((row, i) => {
    const r = 53 + i;
    setNum(`A${r}`, row.monthly);
    setNum(`D${r}`, row.months);
    setPct(`K${r}`, row.commPct);
  });

  setNum("L70", d.commBonus);
  setNum("L74", d.commConsulting);

  setText("J80", yesNo(d.sameAgent ? "yes" : "no"));
  setText("C85", d.laHouse);
  setText("K85", d.paHouse);
  setText("C86", d.laName);
  setText("K86", d.paName);
  setText("C87", d.laAddress);
  setText("K87", d.paAddress);
  setText("C88", d.laCity);
  setText("K88", d.paCity);
  setText("C89", d.laState);
  setText("E89", d.laZip);
  setText("K89", d.paState);
  setText("M89", d.paZip);
  setText("C90", d.laPhone);
  setText("K90", d.paPhone);
  setText("E92", yesNo(d.laPayFee));
  setText("L92", yesNo(d.paPayFee));

  const listingOutside = d.outsideRows.find(r => r.side === "listing") ?? null;
  const procuringOutside = d.outsideRows.find(r => r.side === "procuring") ?? null;
  const extraOutside = d.outsideRows.filter(r => r !== listingOutside && r !== procuringOutside);
  const firstExtra = extraOutside[0] ?? null;

  setText("C96", listingOutside?.name ?? "");
  setNum("L96", listingOutside?.amount ?? "");
  setText("C98", procuringOutside?.name ?? "");
  setNum("L98", procuringOutside?.amount ?? "");
  setText("C100", firstExtra?.name ?? "");
  setText("C101", firstExtra?.address ?? "");
  setNum("L100", firstExtra?.amount ?? "");

  setText("G109", invoiceTarget.company);
  setText("G110", invoiceTarget.address);
  setText("A113", d.invInstructions);

  for (const a of ["K113","L113","M113","N113","K114","L114","M114","N114"]) ops[a] = { type: "clear" };
  d.paymentRows.slice(0, 2).forEach((row, i) => {
    const r = 113 + i;
    setDate(`K${r}`, row.date1);
    setNum(`L${r}`, row.amount1);
    setDate(`M${r}`, row.date2);
    setNum(`N${r}`, row.amount2);
  });

  for (let r = 124; r <= 130; r++) {
    ops[`A${r}`] = { type: "clear" };
    ops[`D${r}`] = { type: "clear" };
    ops[`E${r}`] = { type: "clear" };
  }
  d.distRows.slice(0, 7).forEach((row, i) => {
    const r = 124 + i;
    setText(`A${r}`, row.name);
    setText(`D${r}`, distSide(row.side));
    setPct(`E${r}`, row.pct);
  });

  const overflowOutside = extraOutside.slice(firstExtra ? 1 : 0);
  const overflowPayments = d.paymentRows.slice(2);
  const overflowRent = d.rentRows.slice(15);
  const notes: string[] = [];
  if (d.notes) notes.push(d.notes);
  if (overflowOutside.length) notes.push("Additional Outside Agents: " + overflowOutside.map(r => [r.side, r.name, r.address, r.amount ? `$${r.amount}` : ""].filter(Boolean).join(" — ")).join(" | "));
  if (overflowPayments.length) notes.push("Additional Payments: " + overflowPayments.map(r => [r.date1 ? `${r.date1}/$${r.amount1}` : "", r.date2 ? `${r.date2}/$${r.amount2}` : ""].filter(Boolean).join("; ")).join(" | "));
  if (overflowRent.length) notes.push("Additional Rent Rows: " + overflowRent.map(r => `$${r.monthly} × ${r.months}mo`).join(" | "));
  setText("A133", notes.join("\n"));

  return ops;
}

function applyOpsToSheetXml(sheetXml: string, ops: Record<string, CellOp>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, "application/xml");
  const ns = doc.documentElement.namespaceURI ?? "";

  const sheetData = doc.getElementsByTagNameNS(ns, "sheetData")[0];
  if (!sheetData) return sheetXml;

  const rowElements: Record<string, Element> = {};
  for (const rowEl of Array.from(sheetData.getElementsByTagNameNS(ns, "row"))) {
    const r = rowEl.getAttribute("r");
    if (r) rowElements[r] = rowEl;
  }

  for (const [addr, op] of Object.entries(ops)) {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const [, , rowNum] = m;

    let rowEl = rowElements[rowNum];
    if (!rowEl) {
      rowEl = doc.createElementNS(ns, "row");
      rowEl.setAttribute("r", rowNum);
      sheetData.appendChild(rowEl);
      rowElements[rowNum] = rowEl;
    }

    let cellEl: Element | null = null;
    for (const c of Array.from(rowEl.getElementsByTagNameNS(ns, "c"))) {
      if (c.getAttribute("r") === addr) { cellEl = c; break; }
    }
    if (!cellEl) {
      cellEl = doc.createElementNS(ns, "c");
      cellEl.setAttribute("r", addr);
      rowEl.appendChild(cellEl);
    }

    const existingV = cellEl.getElementsByTagNameNS(ns, "v")[0];
    const existingF = cellEl.getElementsByTagNameNS(ns, "f")[0];
    const existingIs = cellEl.getElementsByTagNameNS(ns, "is")[0];
    if (existingV) cellEl.removeChild(existingV);
    if (existingF) cellEl.removeChild(existingF);
    if (existingIs) cellEl.removeChild(existingIs);

    if (op.type === "clear") {
      cellEl.removeAttribute("t");
    } else if (op.type === "text") {
      cellEl.setAttribute("t", "inlineStr");
      const isEl = doc.createElementNS(ns, "is");
      const tEl = doc.createElementNS(ns, "t");
      tEl.textContent = op.value;
      isEl.appendChild(tEl);
      cellEl.appendChild(isEl);
    } else if (op.type === "number") {
      cellEl.removeAttribute("t");
      const vEl = doc.createElementNS(ns, "v");
      vEl.textContent = String(op.value);
      cellEl.appendChild(vEl);
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

export async function buildVoucherExcel(data: VoucherExcelData): Promise<{ blob: Blob; filename: string; base64Data: string }> {
  const response = await fetch(TEMPLATE_URL, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to load the voucher template. Please refresh and try again.");

  const templateBuffer = await response.arrayBuffer();
  const header = new Uint8Array(templateBuffer.slice(0, 2));
  if (header[0] !== 0x50 || header[1] !== 0x4b) throw new Error("Voucher template is not a valid ZIP/Excel file.");

  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error("Voucher template is missing its worksheet.");

  const sheetXml = await sheetFile.async("string");
  const ops = buildCellOps(data);
  const modifiedXml = applyOpsToSheetXml(sheetXml, ops);
  zip.file(sheetPath, modifiedXml);

  const blob = await zip.generateAsync({ type: "blob", mimeType: MIME, compression: "DEFLATE", compressionOptions: { level: 6 } });

  const safeAddr = (data.address || "Voucher").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `Commission_Voucher_${safeAddr}.xlsm`;

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64Data = btoa(binary);

  return { blob, filename, base64Data };
}
