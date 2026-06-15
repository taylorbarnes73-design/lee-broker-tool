import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { Button, Card, Field, Input, Select, Icons } from "@/design/index.jsx";
import { buildSectionedPdf } from "@/lib/formPdf";
import { buildVoucherExcel } from "@/lib/voucherExcel";
import type { VoucherExcelData, RentRow, OutsideRow, DistRow, PaymentRow } from "@/lib/voucherExcel";

// ── Constants ──────────────────────────────────────────────────────────────

const TXN_TYPES = ["Lease", "Sale", "Referral", "Sublease", "Renewal", "Other"] as const;
const PROP_TYPES = ["Industrial", "Office", "Retail", "Land", "Medical", "Multi-Family", "Other"] as const;
const REP_TYPES = ["Tenant Rep", "Landlord Rep", "Buyer Rep", "Seller Rep", "Other"] as const;
const DEAL_TYPES = ["New", "Renewal", "Expansion", "Relocation", "Blend & Extend", "Other"] as const;
const RATE_TYPES = ["NNN", "FSG", "MG", "G/Gross"] as const;
const BUYER_TYPES = ["User", "Investor", "Developer", "Other"] as const;
const OCC_TYPES = ["Direct", "Sublease", "Renewal", "Expansion"] as const;
const BLDG_CLASSES = ["A", "B", "C"] as const;
const DIST_SIDES = ["Listing", "Procuring", "Both", "Referring", "Outside", "Other"] as const;
const OUTSIDE_SIDES = ["listing", "procuring", "other"] as const;

const EMPTY_RENT_ROW: RentRow = { monthly: null, months: null, commPct: "" };
const EMPTY_OUTSIDE: OutsideRow = { side: "listing", name: "", address: "", amount: "" };
const EMPTY_DIST: DistRow = { name: "", side: "Listing", pct: "" };
const EMPTY_PAYMENT: PaymentRow = { date1: "", amount1: "", date2: "", amount2: "" };

// ── Helpers ────────────────────────────────────────────────────────────────

function n(s: string): number | null {
  if (!s.trim()) return null;
  const v = Number.parseFloat(s.replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(v: number | null): string {
  if (v == null) return "";
  return "$" + fmt(v);
}

function isLeaseTxn(txnType: string): boolean {
  return ["lease", "sublease", "renewal"].includes(txnType.toLowerCase());
}

// ── Main Form ──────────────────────────────────────────────────────────────

export default function PortalVoucherFullForm() {
  const { user } = useAuth();

  // ── Core deal fields ────────────────────────────────────────────────────
  const [txnType, setTxnType] = useState("Lease");
  const [repType, setRepType] = useState("Tenant Rep");
  const [propType, setPropType] = useState("Industrial");
  const [otherType, setOtherType] = useState("");
  const [dealType, setDealType] = useState("New");
  const [address, setAddress] = useState("");
  const [suite, setSuite] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [dealSf, setDealSf] = useState("");
  const [submarket, setSubmarket] = useState("");
  const [priorLoc, setPriorLoc] = useState("");
  const [activeListing, setActiveListing] = useState("no");
  const [closeListing, setCloseListing] = useState("");
  const [confidential, setConfidential] = useState("no");
  const [dateFilled, setDateFilled] = useState(new Date().toISOString().slice(0, 10));
  const [apn, setApn] = useState("");

  // ── Agents ──────────────────────────────────────────────────────────────
  const [sameAgent, setSameAgent] = useState(false);
  const [laName, setLaName] = useState("");
  const [laHouse, setLaHouse] = useState("Lee & Associates Newport Beach");
  const [laAddress, setLaAddress] = useState("");
  const [laCity, setLaCity] = useState("");
  const [laState, setLaState] = useState("CA");
  const [laZip, setLaZip] = useState("");
  const [laPhone, setLaPhone] = useState("");
  const [laPayFee, setLaPayFee] = useState("no");
  const [paName, setPaName] = useState("");
  const [paHouse, setPaHouse] = useState("Lee & Associates Newport Beach");
  const [paAddress, setPaAddress] = useState("");
  const [paCity, setPaCity] = useState("");
  const [paState, setPaState] = useState("CA");
  const [paZip, setPaZip] = useState("");
  const [paPhone, setPaPhone] = useState("");
  const [paPayFee, setPaPayFee] = useState("no");

  // ── Lessor/Seller (ls) ──────────────────────────────────────────────────
  const [lsCompany, setLsCompany] = useState("");
  const [lsContact, setLsContact] = useState("");
  const [lsEmail, setLsEmail] = useState("");
  const [lsPhone, setLsPhone] = useState("");
  const [lsAddress, setLsAddress] = useState("");
  const [lsCity, setLsCity] = useState("");
  const [lsState, setLsState] = useState("CA");
  const [lsZip, setLsZip] = useState("");

  // ── Lessee/Buyer (lb) ───────────────────────────────────────────────────
  const [lbCompany, setLbCompany] = useState("");
  const [lbContact, setLbContact] = useState("");
  const [lbEmail, setLbEmail] = useState("");
  const [lbPhone, setLbPhone] = useState("");
  const [lbAddress, setLbAddress] = useState("");
  const [lbCity, setLbCity] = useState("");
  const [lbState, setLbState] = useState("CA");
  const [lbZip, setLbZip] = useState("");

  // ── Property details ────────────────────────────────────────────────────
  const [occType, setOccType] = useState("Direct");
  const [landSf, setLandSf] = useState("");
  const [bldgSf, setBldgSf] = useState("");
  const [bldgClass, setBldgClass] = useState("A");
  const [yearBuilt, setYearBuilt] = useState("");
  const [floors, setFloors] = useState("");
  const [parkingType, setParkingType] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [parkRatio, setParkRatio] = useState("");

  // ── Lease terms ─────────────────────────────────────────────────────────
  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");
  const [lOcc, setLOcc] = useState("");
  const [lTerm, setLTerm] = useState("");
  const [lRate, setLRate] = useState("");
  const [lRateType, setLRateType] = useState("NNN");
  const [lAskingRate, setLAskingRate] = useState("");
  const [lTaxes, setLTaxes] = useState("");
  const [lInsurance, setLInsurance] = useState("");
  const [lMisc, setLMisc] = useState("");
  const [lTiSf, setLTiSf] = useState("");
  const [lEscalations, setLEscalations] = useState("");
  const [lOptions, setLOptions] = useState("");
  const [leaseComments, setLeaseComments] = useState("");

  // ── Sale terms ──────────────────────────────────────────────────────────
  const [sPrice, setSPrice] = useState("");
  const [sBuyerType, setSBuyerType] = useState("User");
  const [sAsking, setSAsking] = useState("");
  const [sCap, setSCap] = useState("");
  const [sEscrow, setSEscrow] = useState("");
  const [sEscrowCheck, setSEscrowCheck] = useState("no");
  const [sMktMonths, setSMktMonths] = useState("");

  // ── Rent schedule ───────────────────────────────────────────────────────
  const [lEscPct, setLEscPct] = useState("");
  const [lFreeMonths, setLFreeMonths] = useState("");
  const [lCommRate, setLCommRate] = useState("");
  const [rentRows, setRentRows] = useState<RentRow[]>([{ ...EMPTY_RENT_ROW }]);

  // ── Commission ──────────────────────────────────────────────────────────
  const [commBonus, setCommBonus] = useState("");
  const [commConsulting, setCommConsulting] = useState("");
  const [sCommPct, setSCommPct] = useState("");
  const [invoiceTo, setInvoiceTo] = useState("lessor");
  const [invCompany, setInvCompany] = useState("");
  const [invAddress, setInvAddress] = useState("");
  const [invInstructions, setInvInstructions] = useState("");
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([{ ...EMPTY_PAYMENT }]);

  // ── Outside agents ──────────────────────────────────────────────────────
  const [hasOutside, setHasOutside] = useState(false);
  const [outsideRows, setOutsideRows] = useState<OutsideRow[]>([{ ...EMPTY_OUTSIDE }]);

  // ── Distribution ────────────────────────────────────────────────────────
  const [distRows, setDistRows] = useState<DistRow[]>([{ ...EMPTY_DIST }]);
  const [notes, setNotes] = useState("");

  // ── AI / file upload ────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiWorking, setAiWorking] = useState(false);
  const uploadMut = trpc.files.upload.useMutation();
  const extractMut = trpc.aiAssist.extractVoucherDocument.useMutation();
  const sendMut = trpc.email.sendToAdmin.useMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Broker roster for agent name datalist ───────────────────────────────
  const { data: brokers } = trpc.brokers.list.useQuery(undefined, { staleTime: 60_000 });

  // ── Derived calculations ─────────────────────────────────────────────────
  const isLease = isLeaseTxn(txnType);

  const totalConsideration = useMemo(() => {
    let total = 0;
    for (const row of rentRows) {
      if (row.monthly != null && row.months != null) total += row.monthly * row.months;
    }
    return total > 0 ? total : null;
  }, [rentRows]);

  const leaseCommDue = useMemo(() => {
    const tc = totalConsideration;
    const rate = n(lCommRate);
    if (tc == null || rate == null) return null;
    const r = rate > 1 ? rate / 100 : rate;
    return tc * r;
  }, [totalConsideration, lCommRate]);

  const totalInvoice = useMemo(() => {
    const base = isLease ? (leaseCommDue ?? 0) : (n(sPrice) ?? 0) * ((n(sCommPct) ?? 0) > 1 ? (n(sCommPct)! / 100) : (n(sCommPct) ?? 0));
    return base + (n(commBonus) ?? 0) + (n(commConsulting) ?? 0) || null;
  }, [isLease, leaseCommDue, sPrice, sCommPct, commBonus, commConsulting]);

  const saleCommDue = useMemo(() => {
    const p = n(sPrice);
    const r = n(sCommPct);
    if (p == null || r == null) return null;
    return p * (r > 1 ? r / 100 : r);
  }, [sPrice, sCommPct]);

  const salePriceSf = useMemo(() => {
    const p = n(sPrice);
    const b = n(bldgSf);
    if (p == null || !b) return null;
    return p / b;
  }, [sPrice, bldgSf]);

  const nnnTotal = useMemo(() => {
    const t = n(lTaxes);
    const ins = n(lInsurance);
    const m = n(lMisc);
    if (t == null && ins == null && m == null) return null;
    return (t ?? 0) + (ins ?? 0) + (m ?? 0);
  }, [lTaxes, lInsurance, lMisc]);

  const outsideTotal = useMemo(() => {
    if (!hasOutside) return null;
    let s = 0;
    for (const r of outsideRows) { const v = n(r.amount); if (v != null) s += v; }
    return s > 0 ? s : null;
  }, [hasOutside, outsideRows]);

  // ── Rent schedule auto-generate ─────────────────────────────────────────
  // Mirrors legacy generateVoucherRentSchedule(): monthly rent = rate/SF/Mo ×
  // deal SF, escalated annually. With no escalation, a single row spans the
  // entire remaining term (NOT capped at 12 months).
  function autoGenerateRentSchedule() {
    const termMonths = n(lTerm);
    const rateSf = n(lRate);
    const sf = n(dealSf) ?? 0;
    const escPct = n(lEscPct) ?? 0;
    const freeMonths = n(lFreeMonths) ?? 0;
    const commRate = lCommRate;
    if (!termMonths || !rateSf) { toast.error("Enter term and rate/SF/Mo first."); return; }
    if (sf <= 0) { toast.error("Enter deal SF first — monthly rent is rate × SF."); return; }

    const baseMonthly = rateSf * sf;
    const rows: RentRow[] = [];

    let usedMonths = 0;
    if (freeMonths > 0) {
      const fm = Math.min(freeMonths, termMonths);
      rows.push({ monthly: 0, months: fm, commPct: commRate });
      usedMonths += fm;
    }

    let remaining = termMonths - usedMonths;
    let yearIndex = 0;
    while (remaining > 0) {
      const periodMonths = escPct > 0 ? Math.min(12, remaining) : remaining;
      const escalatedMonthly = escPct > 0 ? baseMonthly * Math.pow(1 + escPct / 100, yearIndex) : baseMonthly;
      rows.push({ monthly: escalatedMonthly > 0 ? Number(escalatedMonthly.toFixed(2)) : 0, months: periodMonths, commPct: commRate });
      remaining -= periodMonths;
      if (escPct > 0) yearIndex += 1;
    }

    setRentRows(rows.length ? rows : [{ ...EMPTY_RENT_ROW }]);
  }

  // ── AI document prefill ─────────────────────────────────────────────────
  async function handleAiFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAiWorking(true);
    try {
      const mimeType = (file.type || "application/pdf") as "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
      const base64Data = await toBase64(file);
      const uploadResult = await uploadMut.mutateAsync({ filename: file.name, mimeType, base64Data, category: "brochure", reference: "voucher" });
      const extracted = await extractMut.mutateAsync({ fileUrl: uploadResult.url, mimeType });
      if (!extracted?.success || !extracted.fields) return;
      const f = extracted.fields as Record<string, string>;
      if (f.address) setAddress(f.address);
      if (f.city) setCity(f.city);
      if (f.state) setState(f.state);
      if (f.zip) setZip(f.zip);
      if (f.suite) setSuite(f.suite);
      if (f.transactionType) setTxnType(f.transactionType);
      if (f.representationType) setRepType(f.representationType);
      if (f.propertyType) setPropType(f.propertyType);
      if (f.buildingSf) setBldgSf(f.buildingSf);
      if (f.dealSf) setDealSf(f.dealSf);
      if (f.commencementDate) setLStart(f.commencementDate);
      if (f.expirationDate) setLEnd(f.expirationDate);
      if (f.occupancyDate) setLOcc(f.occupancyDate);
      if (f.term) setLTerm(f.term);
      if (f.rateSfMo) setLRate(f.rateSfMo);
      if (f.leaseType) setLRateType(f.leaseType);
      if (f.commissionRate) setLCommRate(f.commissionRate);
      if (f.annualEscalationPct) setLEscPct(f.annualEscalationPct);
      if (f.lessorName) setLsCompany(f.lessorName);
      if (f.lesseeName) setLbCompany(f.lesseeName);
      if (f.listingAgentName) setLaName(f.listingAgentName);
      if (f.procuringAgentName) setPaName(f.procuringAgentName);
      if (f.totalConsideration || f.salePrice) setSPrice(f.totalConsideration ?? f.salePrice ?? "");
      if (f.notes) setNotes(f.notes);
      toast.success("Document analyzed — review prefilled fields.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI analysis failed. Enter fields manually.");
    } finally {
      setAiWorking(false);
    }
  }

  // ── Build sections for PDF + submission ─────────────────────────────────
  function buildSections() {
    const propertyAddress = [address, suite, city, state, zip].filter(Boolean).join(", ");
    return [
      {
        title: "Deal Information",
        fields: [
          { label: "Transaction Type", value: txnType },
          { label: "Representation", value: repType },
          { label: "Property Type", value: propType + (propType === "Other" ? ` (${otherType})` : "") },
          { label: "Deal Type", value: dealType },
          { label: "Address", value: propertyAddress },
          { label: "Deal SF", value: dealSf },
          { label: "Date Filled", value: dateFilled },
          { label: "Active Listing", value: activeListing },
          { label: "Close Listing", value: closeListing },
          { label: "Confidential", value: confidential },
          { label: "APN", value: apn },
        ],
      },
      {
        title: "Agents",
        fields: [
          { label: "Listing Agent", value: [laName, laHouse].filter(Boolean).join(" — ") },
          { label: "Listing Agent Phone", value: laPhone },
          { label: "Procuring Agent", value: sameAgent ? "(same as listing)" : [paName, paHouse].filter(Boolean).join(" — ") },
          { label: "Procuring Agent Phone", value: sameAgent ? "" : paPhone },
        ],
      },
      {
        title: isLease ? "Lessor & Lessee" : "Seller & Buyer",
        fields: [
          { label: isLease ? "Lessor" : "Seller", value: [lsCompany, lsContact].filter(Boolean).join(" / ") },
          { label: "Lessor Email", value: lsEmail },
          { label: "Lessor Phone", value: lsPhone },
          { label: isLease ? "Lessee" : "Buyer", value: [lbCompany, lbContact].filter(Boolean).join(" / ") },
          { label: "Lessee Email", value: lbEmail },
          { label: "Lessee Phone", value: lbPhone },
        ],
      },
      isLease
        ? {
            title: "Lease Terms",
            fields: [
              { label: "Start Date", value: lStart },
              { label: "End Date", value: lEnd },
              { label: "Occupancy Date", value: lOcc },
              { label: "Term (months)", value: lTerm },
              { label: "Rate/SF/Mo", value: lRate ? `$${lRate}` : "" },
              { label: "Rate Type", value: lRateType },
              { label: "Total Consideration", value: totalConsideration ? fmtCurrency(totalConsideration) : "" },
              { label: "NNN/Mo/SF", value: nnnTotal ? fmt(nnnTotal) : "" },
              { label: "TI/SF", value: lTiSf },
              { label: "Escalations", value: lEscalations },
              { label: "Options", value: lOptions },
            ],
          }
        : {
            title: "Sale Terms",
            fields: [
              { label: "Sale Price", value: sPrice ? fmtCurrency(n(sPrice)) : "" },
              { label: "Price/SF", value: salePriceSf ? fmtCurrency(salePriceSf) : "" },
              { label: "Buyer Type", value: sBuyerType },
              { label: "Asking Price", value: sAsking ? fmtCurrency(n(sAsking)) : "" },
              { label: "CAP Rate", value: sCap ? `${sCap}%` : "" },
              { label: "Escrow Company", value: sEscrow },
            ],
          },
      {
        title: "Rent Schedule",
        fields: rentRows
          .filter(r => r.monthly != null || r.months != null)
          .map((r, i) => ({ label: `Row ${i + 1}`, value: `$${fmt(r.monthly)} × ${r.months} months${r.commPct ? ` @ ${r.commPct}%` : ""}` })),
      },
      {
        title: "Commission & Invoice",
        fields: [
          { label: "Commission Rate", value: lCommRate ? `${lCommRate}%` : "" },
          { label: "Commission Due", value: leaseCommDue ? fmtCurrency(leaseCommDue) : "" },
          { label: "Sale Commission %", value: sCommPct ? `${sCommPct}%` : "" },
          { label: "Sale Commission Due", value: saleCommDue ? fmtCurrency(saleCommDue) : "" },
          { label: "Adjustment/Bonus", value: commBonus ? fmtCurrency(n(commBonus)) : "" },
          { label: "Consulting/Referral Fee", value: commConsulting ? fmtCurrency(n(commConsulting)) : "" },
          { label: "Total Invoice", value: totalInvoice ? fmtCurrency(totalInvoice) : "" },
          { label: "Invoice To", value: invoiceTo },
          { label: "Invoice Instructions", value: invInstructions },
        ],
      },
      ...(hasOutside
        ? [{
            title: "Outside Agents",
            fields: outsideRows.filter(r => r.name).map(r => ({ label: `${r.side} — ${r.name}`, value: r.amount ? fmtCurrency(n(r.amount)) : "" })),
          }]
        : []),
      {
        title: "Commission Distribution",
        fields: distRows.filter(r => r.name).map(r => ({ label: `${r.name} (${r.side})`, value: r.pct ? `${r.pct}%` : "" })),
      },
      ...(notes ? [{ title: "Notes", fields: [{ label: "Notes", value: notes }] }] : []),
    ];
  }

  function buildExcelData(): VoucherExcelData {
    return {
      txnType, propType, otherType, activeListing, closeListing, confidential, dateFilled,
      address, city, zip, suite, occType, dealType, priorLoc, dealSf, submarket, landSf, bldgSf, bldgClass, yearBuilt,
      lsCompany, lbCompany, lsContact, lbContact, lsEmail, lbEmail,
      lsAddress, lbAddress, lsCity, lbCity, lsState, lbState, lsZip, lbZip, lsPhone, lbPhone,
      lStart, lEnd, lOcc, lTerm, lRate, lRateType, lAskingRate,
      sPrice, sBuyerType, sAsking, sCap, sEscrow, sEscrowCheck,
      rentRows, commBonus, commConsulting, sCommPct,
      invoiceTo, invCompany, invAddress, invInstructions, paymentRows,
      sameAgent, laName, laHouse, laAddress, laCity, laState, laZip, laPhone, laPayFee,
      paName: sameAgent ? laName : paName,
      paHouse: sameAgent ? laHouse : paHouse,
      paAddress: sameAgent ? laAddress : paAddress,
      paCity: sameAgent ? laCity : paCity,
      paState: sameAgent ? laState : paState,
      paZip: sameAgent ? laZip : paZip,
      paPhone: sameAgent ? laPhone : paPhone,
      paPayFee: sameAgent ? laPayFee : paPayFee,
      outsideRows: hasOutside ? outsideRows : [],
      distRows, notes,
    };
  }

  function validate(): string | null {
    if (!address.trim()) return "Property address is required.";
    if (!city.trim()) return "City is required.";
    if (!laName.trim()) return "Listing agent name is required.";
    return null;
  }

  async function handleDownloadExcel() {
    try {
      const { blob, filename } = await buildVoucherExcel(buildExcelData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Excel generation failed.");
    }
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setSubmitError(err); return; }
    setSubmitError(null);

    const propertyAddress = [address, suite, city, state, zip].filter(Boolean).join(", ");
    const sections = buildSections();
    const brokerName = user?.name ?? "";

    toast.loading("Building voucher…");

    try {
      const [pdfResult, excelResult] = await Promise.all([
        buildSectionedPdf({ title: "COMMISSION VOUCHER", sections, propertyAddress, filenamePrefix: "Commission_Voucher" }),
        buildVoucherExcel(buildExcelData()),
      ]);

      toast.dismiss();
      toast.loading("Submitting to admin…");

      await sendMut.mutateAsync({
        formType: "voucher",
        brokerName,
        propertyAddress,
        sections,
        senderEmail: user?.email ?? undefined,
        pdfAttachment: {
          filename: pdfResult.filename,
          mimeType: "application/pdf",
          base64Data: pdfResult.base64Data,
        },
        excelAttachment: {
          filename: excelResult.filename,
          mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
          base64Data: excelResult.base64Data,
        },
        supportingFiles: [],
        formData: {
          txnType, repType, propType, address, suite, city, state, zip: zip,
          dealSf, laName, paName: sameAgent ? laName : paName,
          lsCompany, lbCompany, lStart, lEnd, lTerm, lRate, lRateType, sPrice, sCommPct,
        },
      });

      toast.dismiss();
      toast.success("Commission voucher submitted to admin queue.");
      setSubmitted(true);
    } catch (err) {
      toast.dismiss();
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setSubmitError(msg);
    }
  }

  if (submitted) {
    return (
      <AdminPortalShell section="forms" eyebrow="Submitted" title="Commission Voucher" description="">
        <Card padding="lg" style={{ maxWidth: 580, marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", marginBottom: 8 }}>Voucher submitted</div>
          <div style={{ fontSize: 13, color: "var(--ink-600)", marginBottom: 18, lineHeight: 1.55 }}>
            Your commission voucher and Excel template have been sent to the admin queue. You'll receive an email update as it's processed.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => { setSubmitted(false); setAddress(""); setCity(""); }}>Submit another</Button>
            <LinkButton href="/portal/submissions" variant="secondary">View my submissions</LinkButton>
          </div>
        </Card>
      </AdminPortalShell>
    );
  }

  // ── Shared sub-components ─────────────────────────────────────────────
  const BrokerDatalist = () => (
    <datalist id="broker-roster">
      {(brokers ?? []).map((b: any) => <option key={b.email ?? b.name} value={b.name} />)}
    </datalist>
  );

  const YesNoSelect = ({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--ink-300)", borderRadius: 6, fontSize: 13 }}>
      <option value="">—</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );

  const sectionCard = (title: string, content: React.ReactNode) => (
    <Card padding="lg" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 14 }}>{title}</div>
      {content}
    </Card>
  );

  const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 } as const;
  const grid3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 } as const;
  const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 } as const;

  function agentFields(
    which: "la" | "pa",
    nameV: string, setName: (v: string) => void,
    houseV: string, setHouse: (v: string) => void,
    phoneV: string, setPhone: (v: string) => void,
    payFeeV: string, setPayFee: (v: string) => void,
    addrV: string, setAddr: (v: string) => void,
    aCityV: string, setACity: (v: string) => void,
    aStateV: string, setAState: (v: string) => void,
    aZipV: string, setAZip: (v: string) => void,
  ) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={grid2}>
          <Field label="Agent name">
            <input list="broker-roster" value={nameV} onChange={e => setName(e.target.value)} placeholder="Agent name" style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--ink-300)", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </Field>
          <Field label="Company / House">
            <Input value={houseV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHouse(e.target.value)} placeholder="Lee & Associates Newport Beach" />
          </Field>
        </div>
        <div style={grid2}>
          <Field label="Phone">
            <Input value={phoneV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="(949) 000-0000" />
          </Field>
          <Field label="Fee paid from commission">
            <YesNoSelect value={payFeeV} onChange={setPayFee} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <Field label="Address"><Input value={addrV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddr(e.target.value)} placeholder="Street address" /></Field>
          <Field label="City"><Input value={aCityV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setACity(e.target.value)} placeholder="City" /></Field>
          <Field label="State / Zip">
            <div style={{ display: "flex", gap: 6 }}>
              <Input value={aStateV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAState(e.target.value)} placeholder="CA" style={{ width: 48 }} />
              <Input value={aZipV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAZip(e.target.value)} placeholder="Zip" />
            </div>
          </Field>
        </div>
      </div>
    );
  }

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Commission"
      title="Commission Voucher"
      description="Submit a closed deal. The voucher PDF and Excel template go to the admin queue for Dealius processing."
      actions={<LinkButton href="/portal/workspace" variant="secondary">Back to workspace</LinkButton>}
    >
      <BrokerDatalist />
      <div style={{ marginTop: 14, display: "grid", gap: 0, maxWidth: 900 }}>

        {/* AI prefill banner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(152,0,46,.2)", background: "rgba(152,0,46,.04)", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.45 }}>
            <strong>Got a signed lease or agreement?</strong> Upload it and AI will prefill the form.
          </div>
          <button
            type="button"
            disabled={aiWorking}
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--lee-red)", background: "none", border: "none", cursor: aiWorking ? "wait" : "pointer", whiteSpace: "nowrap" }}
          >
            {aiWorking ? "Analyzing…" : <><Icons.Sparkles size={12} /> Analyze &amp; prefill</>}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleAiFile} />
        </div>

        {/* Deal Basics */}
        {sectionCard("Deal basics", (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={grid2}>
              <Field label="Transaction type">
                <Select value={txnType} onChange={e => setTxnType(e.target.value)} options={[...TXN_TYPES]} />
              </Field>
              <Field label="Representation">
                <Select value={repType} onChange={e => setRepType(e.target.value)} options={[...REP_TYPES]} />
              </Field>
            </div>
            <div style={grid3}>
              <Field label="Property type">
                <Select value={propType} onChange={e => setPropType(e.target.value)} options={[...PROP_TYPES]} />
              </Field>
              {propType === "Other" && <Field label="Property type (describe)"><Input value={otherType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtherType(e.target.value)} placeholder="e.g. Self-Storage" /></Field>}
              <Field label="Deal type">
                <Select value={dealType} onChange={e => setDealType(e.target.value)} options={[...DEAL_TYPES]} />
              </Field>
            </div>
            <Field label="Property address">
              <AddressAutocompleteInput value={address} onChange={setAddress} onSelect={s => { setAddress(s.address); if (s.city) setCity(s.city); if (s.state) setState(s.state); if (s.zip) setZip(s.zip); }} placeholder="123 Industrial Dr" />
            </Field>
            <div style={grid4}>
              <Field label="Suite"><Input value={suite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSuite(e.target.value)} placeholder="Ste 200" /></Field>
              <Field label="City"><Input value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} placeholder={city || "Irvine"} /></Field>
              <Field label="State"><Input value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} placeholder="CA" /></Field>
              <Field label="Zip"><Input value={zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZip(e.target.value)} placeholder="92618" /></Field>
              <Field label="Deal SF"><Input value={dealSf} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDealSf(e.target.value)} placeholder="12,500" inputMode="numeric" /></Field>
            </div>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ink-600)", fontWeight: 600, marginBottom: 6 }}>Compliance & details</summary>
              <div style={{ ...grid4, marginTop: 10 }}>
                <Field label="Active listing"><YesNoSelect value={activeListing} onChange={setActiveListing} /></Field>
                <Field label="Close listing"><YesNoSelect value={closeListing} onChange={setCloseListing} /></Field>
                <Field label="Confidential"><YesNoSelect value={confidential} onChange={setConfidential} /></Field>
                <Field label="Date filled"><Input type="date" value={dateFilled} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFilled(e.target.value)} /></Field>
                <Field label="APN / Parcel"><Input value={apn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApn(e.target.value)} placeholder="123-456-789" /></Field>
                <Field label="Submarket"><Input value={submarket} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubmarket(e.target.value)} placeholder="Airport Area" /></Field>
                <Field label="Prior location"><Input value={priorLoc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPriorLoc(e.target.value)} placeholder="Previous tenant address" /></Field>
                <Field label="Occupancy type">
                  <Select value={occType} onChange={e => setOccType(e.target.value)} options={[...OCC_TYPES]} />
                </Field>
              </div>
            </details>
          </div>
        ))}

        {/* Agents */}
        {sectionCard("Agents", (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-700)", marginBottom: 8 }}>Listing Agent</div>
              {agentFields("la", laName, setLaName, laHouse, setLaHouse, laPhone, setLaPhone, laPayFee, setLaPayFee, laAddress, setLaAddress, laCity, setLaCity, laState, setLaState, laZip, setLaZip)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <input type="checkbox" id="same-agent" checked={sameAgent} onChange={e => setSameAgent(e.target.checked)} />
              <label htmlFor="same-agent" style={{ fontSize: 13, color: "var(--ink-700)", cursor: "pointer" }}>Same agent on both sides (dual agency)</label>
            </div>
            {!sameAgent && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-700)", marginBottom: 8 }}>Procuring Agent</div>
                {agentFields("pa", paName, setPaName, paHouse, setPaHouse, paPhone, setPaPhone, paPayFee, setPaPayFee, paAddress, setPaAddress, paCity, setPaCity, paState, setPaState, paZip, setPaZip)}
              </div>
            )}
          </div>
        ))}

        {/* Parties */}
        {sectionCard(isLease ? "Lessor & Lessee" : "Seller & Buyer", (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {[
              { label: isLease ? "Lessor / Seller" : "Seller", company: lsCompany, setCompany: setLsCompany, contact: lsContact, setContact: setLsContact, email: lsEmail, setEmail: setLsEmail, phone: lsPhone, setPhone: setLsPhone },
              { label: isLease ? "Lessee / Buyer" : "Buyer", company: lbCompany, setCompany: setLbCompany, contact: lbContact, setContact: setLbContact, email: lbEmail, setEmail: setLbEmail, phone: lbPhone, setPhone: setLbPhone },
            ].map(p => (
              <div key={p.label} style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-700)" }}>{p.label}</div>
                <Field label="Company"><Input value={p.company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => p.setCompany(e.target.value)} placeholder="Entity name" /></Field>
                <Field label="Contact"><Input value={p.contact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => p.setContact(e.target.value)} placeholder="Contact name" /></Field>
                <Field label="Email"><Input type="email" value={p.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => p.setEmail(e.target.value)} placeholder="email@example.com" /></Field>
                <Field label="Phone"><Input value={p.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => p.setPhone(e.target.value)} placeholder="(949) 000-0000" /></Field>
              </div>
            ))}
          </div>
        ))}

        {/* Lease OR Sale terms */}
        {isLease ? sectionCard("Lease terms", (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={grid4}>
              <Field label="Start date"><Input type="date" value={lStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLStart(e.target.value)} /></Field>
              <Field label="End date"><Input type="date" value={lEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLEnd(e.target.value)} /></Field>
              <Field label="Occupancy date"><Input type="date" value={lOcc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLOcc(e.target.value)} /></Field>
              <Field label="Term (months)"><Input value={lTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLTerm(e.target.value)} placeholder="60" inputMode="numeric" /></Field>
            </div>
            <div style={grid3}>
              <Field label="Rate / SF / Mo"><Input value={lRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLRate(e.target.value)} placeholder="1.25" inputMode="decimal" prefix={<span style={{ fontSize: 12, color: "var(--ink-500)" }}>$</span>} /></Field>
              <Field label="Rate type">
                <Select value={lRateType} onChange={e => setLRateType(e.target.value)} options={[...RATE_TYPES]} />
              </Field>
              <Field label="Asking rate / SF / Mo"><Input value={lAskingRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLAskingRate(e.target.value)} placeholder="1.35" inputMode="decimal" /></Field>
            </div>
            {lRateType === "NNN" && (
              <div style={grid3}>
                <Field label="NNN — Taxes / SF / Mo"><Input value={lTaxes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLTaxes(e.target.value)} placeholder="0.10" inputMode="decimal" /></Field>
                <Field label="NNN — Insurance / SF / Mo"><Input value={lInsurance} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLInsurance(e.target.value)} placeholder="0.03" inputMode="decimal" /></Field>
                <Field label="NNN — Misc / SF / Mo"><Input value={lMisc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLMisc(e.target.value)} placeholder="0.02" inputMode="decimal" /></Field>
                {nnnTotal != null && <div style={{ fontSize: 12.5, color: "var(--ink-600)", gridColumn: "1/-1" }}>Total NNN: <strong>${fmt(nnnTotal)}/SF/Mo</strong></div>}
              </div>
            )}
            <div style={grid2}>
              <Field label="TI Allowance / SF"><Input value={lTiSf} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLTiSf(e.target.value)} placeholder="15.00" inputMode="decimal" /></Field>
              <Field label="Escalations"><Input value={lEscalations} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLEscalations(e.target.value)} placeholder="3% annual" /></Field>
            </div>
            <Field label="Options"><Input value={lOptions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLOptions(e.target.value)} placeholder="2 × 5yr options" /></Field>
            {totalConsideration != null && (
              <div style={{ fontSize: 13, color: "var(--ink-700)", background: "var(--ink-100)", borderRadius: 8, padding: "8px 12px" }}>
                Total consideration: <strong>{fmtCurrency(totalConsideration)}</strong>
              </div>
            )}
            <Field label="Lease comments"><textarea value={leaseComments} onChange={e => setLeaseComments(e.target.value)} rows={2} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--ink-300)", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} placeholder="Additional lease details…" /></Field>
          </div>
        )) : sectionCard("Sale terms", (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={grid3}>
              <Field label="Sale price">
                <Input value={sPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSPrice(e.target.value)} placeholder="2,500,000" inputMode="numeric" prefix={<span style={{ fontSize: 12, color: "var(--ink-500)" }}>$</span>} />
              </Field>
              <Field label="Price / SF (calc)">
                <Input value={salePriceSf ? fmt(salePriceSf) : ""} readOnly placeholder="auto" style={{ background: "var(--ink-50)" }} />
              </Field>
              <Field label="Buyer type">
                <Select value={sBuyerType} onChange={e => setSBuyerType(e.target.value)} options={[...BUYER_TYPES]} />
              </Field>
            </div>
            <div style={grid4}>
              <Field label="Asking price"><Input value={sAsking} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSAsking(e.target.value)} placeholder="2,700,000" inputMode="numeric" /></Field>
              <Field label="CAP rate %"><Input value={sCap} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSCap(e.target.value)} placeholder="5.5" inputMode="decimal" /></Field>
              <Field label="Escrow company"><Input value={sEscrow} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSEscrow(e.target.value)} placeholder="Escrow company name" /></Field>
              <Field label="Check from escrow"><YesNoSelect value={sEscrowCheck} onChange={setSEscrowCheck} /></Field>
              <Field label="Months on market"><Input value={sMktMonths} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSMktMonths(e.target.value)} placeholder="6" inputMode="numeric" /></Field>
            </div>
          </div>
        ))}

        {/* Rent Schedule */}
        {sectionCard("Rent schedule", (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ ...grid4, alignItems: "end" }}>
              <Field label="Annual increase %"><Input value={lEscPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLEscPct(e.target.value)} placeholder="3" inputMode="decimal" /></Field>
              <Field label="Free rent (months)"><Input value={lFreeMonths} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLFreeMonths(e.target.value)} placeholder="0" inputMode="numeric" /></Field>
              <Field label="Commission rate %"><Input value={lCommRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLCommRate(e.target.value)} placeholder="4.0" inputMode="decimal" /></Field>
              <Button variant="secondary" onClick={autoGenerateRentSchedule}>Generate schedule</Button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Monthly Rent", "Months", "Comm %", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--ink-200)", color: "var(--ink-600)", fontSize: 11.5, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" value={row.monthly ?? ""} onChange={e => { const v = [...rentRows]; v[i] = { ...v[i], monthly: e.target.value === "" ? null : Number(e.target.value) }; setRentRows(v); }} placeholder="0.00" step="0.01" style={{ width: "100%", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="number" value={row.months ?? ""} onChange={e => { const v = [...rentRows]; v[i] = { ...v[i], months: e.target.value === "" ? null : Number(e.target.value) }; setRentRows(v); }} placeholder="12" style={{ width: "80px", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <input type="text" value={row.commPct} onChange={e => { const v = [...rentRows]; v[i] = { ...v[i], commPct: e.target.value }; setRentRows(v); }} placeholder="4.0" style={{ width: "70px", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "3px 4px" }}>
                      <button type="button" onClick={() => setRentRows(rentRows.filter((_, j) => j !== i))} style={{ color: "var(--ink-400)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="Remove row">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setRentRows([...rentRows, { ...EMPTY_RENT_ROW }])} style={{ fontSize: 12.5, color: "var(--lee-red)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>+ Add rent row</button>
            {totalConsideration != null && leaseCommDue != null && (
              <div style={{ fontSize: 13, color: "var(--ink-700)", background: "var(--ink-100)", borderRadius: 8, padding: "8px 12px" }}>
                Total consideration: <strong>{fmtCurrency(totalConsideration)}</strong> · Commission @ {lCommRate}%: <strong>{fmtCurrency(leaseCommDue)}</strong>
              </div>
            )}
          </div>
        ))}

        {/* Commission & Invoice */}
        {sectionCard("Commission & invoice", (
          <div style={{ display: "grid", gap: 12 }}>
            {!isLease && (
              <div style={grid2}>
                <Field label="Sale commission %"><Input value={sCommPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSCommPct(e.target.value)} placeholder="4.0" inputMode="decimal" /></Field>
                {saleCommDue != null && <Field label="Sale commission due (calc)"><Input value={fmtCurrency(saleCommDue)} readOnly style={{ background: "var(--ink-50)" }} /></Field>}
              </div>
            )}
            <div style={grid2}>
              <Field label="Adjustment / Bonus"><Input value={commBonus} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommBonus(e.target.value)} placeholder="0.00" inputMode="decimal" /></Field>
              <Field label="Consulting / Referral / Flat Fee"><Input value={commConsulting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommConsulting(e.target.value)} placeholder="0.00" inputMode="decimal" /></Field>
            </div>
            {totalInvoice != null && (
              <div style={{ fontSize: 13, color: "var(--ink-700)", background: "var(--ink-100)", borderRadius: 8, padding: "8px 12px" }}>
                Total invoice: <strong>{fmtCurrency(totalInvoice)}</strong>
              </div>
            )}
            <div style={grid2}>
              <Field label="Invoice to">
                <Select value={invoiceTo} onChange={e => setInvoiceTo(e.target.value)} options={["lessor", "lessee", "listing_agent", "procuring_agent", "third_party"]} />
              </Field>
            </div>
            {invoiceTo === "third_party" && (
              <div style={grid2}>
                <Field label="Invoice company"><Input value={invCompany} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvCompany(e.target.value)} placeholder="Company name" /></Field>
                <Field label="Invoice address"><Input value={invAddress} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvAddress(e.target.value)} placeholder="Address" /></Field>
              </div>
            )}
            <Field label="Special invoice instructions">
              <textarea value={invInstructions} onChange={e => setInvInstructions(e.target.value)} rows={2} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--ink-300)", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} placeholder="Any special invoicing notes…" />
            </Field>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-600)", marginBottom: 8 }}>Payment Schedule (optional)</div>
              {paymentRows.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 6 }}>
                  <Field label="Date 1"><Input type="date" value={row.date1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = [...paymentRows]; v[i] = { ...v[i], date1: e.target.value }; setPaymentRows(v); }} /></Field>
                  <Field label="Amount 1"><Input value={row.amount1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = [...paymentRows]; v[i] = { ...v[i], amount1: e.target.value }; setPaymentRows(v); }} placeholder="0.00" /></Field>
                  <Field label="Date 2"><Input type="date" value={row.date2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = [...paymentRows]; v[i] = { ...v[i], date2: e.target.value }; setPaymentRows(v); }} /></Field>
                  <Field label="Amount 2"><Input value={row.amount2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = [...paymentRows]; v[i] = { ...v[i], amount2: e.target.value }; setPaymentRows(v); }} placeholder="0.00" /></Field>
                  <button type="button" onClick={() => setPaymentRows(paymentRows.filter((_, j) => j !== i))} style={{ marginTop: 20, color: "var(--ink-400)", background: "none", border: "none", cursor: "pointer" }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setPaymentRows([...paymentRows, { ...EMPTY_PAYMENT }])} style={{ fontSize: 12.5, color: "var(--lee-red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add payment row</button>
            </div>
          </div>
        ))}

        {/* Outside Agents */}
        {sectionCard("Outside agents", (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="has-outside" checked={hasOutside} onChange={e => setHasOutside(e.target.checked)} />
              <label htmlFor="has-outside" style={{ fontSize: 13, color: "var(--ink-700)", cursor: "pointer" }}>Outside agents involved</label>
            </div>
            {hasOutside && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Side", "Agent name", "Address", "Amount to pay", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--ink-200)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-600)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {outsideRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: "3px 4px" }}>
                          <select value={row.side} onChange={e => { const v = [...outsideRows]; v[i] = { ...v[i], side: e.target.value }; setOutsideRows(v); }} style={{ padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }}>
                            {OUTSIDE_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "3px 4px" }}><input value={row.name} onChange={e => { const v = [...outsideRows]; v[i] = { ...v[i], name: e.target.value }; setOutsideRows(v); }} placeholder="Agent name" style={{ width: "100%", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} /></td>
                        <td style={{ padding: "3px 4px" }}><input value={row.address} onChange={e => { const v = [...outsideRows]; v[i] = { ...v[i], address: e.target.value }; setOutsideRows(v); }} placeholder="Address (optional)" style={{ width: "100%", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} /></td>
                        <td style={{ padding: "3px 4px" }}><input value={row.amount} onChange={e => { const v = [...outsideRows]; v[i] = { ...v[i], amount: e.target.value }; setOutsideRows(v); }} placeholder="0.00" style={{ width: "90px", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} /></td>
                        <td style={{ padding: "3px 4px" }}><button type="button" onClick={() => setOutsideRows(outsideRows.filter((_, j) => j !== i))} style={{ color: "var(--ink-400)", background: "none", border: "none", cursor: "pointer" }}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {outsideTotal != null && <div style={{ fontSize: 13, color: "var(--ink-700)" }}>Total to outside agents: <strong>{fmtCurrency(outsideTotal)}</strong></div>}
                <button type="button" onClick={() => setOutsideRows([...outsideRows, { ...EMPTY_OUTSIDE }])} style={{ fontSize: 12.5, color: "var(--lee-red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add outside agent</button>
              </>
            )}
          </div>
        ))}

        {/* Commission Distribution */}
        {sectionCard("Commission distribution", (
          <div style={{ display: "grid", gap: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Agent name", "Side", "Gross %", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--ink-200)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-600)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {distRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "3px 4px" }}><input list="broker-roster" value={row.name} onChange={e => { const v = [...distRows]; v[i] = { ...v[i], name: e.target.value }; setDistRows(v); }} placeholder="Agent name" style={{ width: "100%", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} /></td>
                    <td style={{ padding: "3px 4px" }}>
                      <select value={row.side} onChange={e => { const v = [...distRows]; v[i] = { ...v[i], side: e.target.value }; setDistRows(v); }} style={{ padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }}>
                        {DIST_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "3px 4px" }}><input value={row.pct} onChange={e => { const v = [...distRows]; v[i] = { ...v[i], pct: e.target.value }; setDistRows(v); }} placeholder="50" style={{ width: "70px", padding: "4px 6px", border: "1px solid var(--ink-300)", borderRadius: 5, fontSize: 13 }} /></td>
                    <td style={{ padding: "3px 4px" }}><button type="button" onClick={() => setDistRows(distRows.filter((_, j) => j !== i))} style={{ color: "var(--ink-400)", background: "none", border: "none", cursor: "pointer" }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setDistRows([...distRows, { ...EMPTY_DIST }])} style={{ fontSize: 12.5, color: "var(--lee-red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add agent</button>
          </div>
        ))}

        {/* Optional property details */}
        <Card padding="lg" style={{ marginBottom: 16 }}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 0 }}>Optional property details</summary>
            <div style={{ ...grid4, marginTop: 14 }}>
              <Field label="Building SF"><Input value={bldgSf} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBldgSf(e.target.value)} placeholder="50,000" inputMode="numeric" /></Field>
              <Field label="Land SF"><Input value={landSf} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLandSf(e.target.value)} placeholder="100,000" inputMode="numeric" /></Field>
              <Field label="Building class">
                <Select value={bldgClass} onChange={e => setBldgClass(e.target.value)} options={[...BLDG_CLASSES]} />
              </Field>
              <Field label="Year built"><Input value={yearBuilt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYearBuilt(e.target.value)} placeholder="2002" inputMode="numeric" /></Field>
              <Field label="Floors"><Input value={floors} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFloors(e.target.value)} placeholder="2" inputMode="numeric" /></Field>
              <Field label="Parking type"><Input value={parkingType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParkingType(e.target.value)} placeholder="Surface" /></Field>
              <Field label="Parking spaces"><Input value={parkingSpaces} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParkingSpaces(e.target.value)} placeholder="100" inputMode="numeric" /></Field>
              <Field label="Park ratio"><Input value={parkRatio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParkRatio(e.target.value)} placeholder="3.5/1000" /></Field>
            </div>
          </details>
        </Card>

        {/* Notes */}
        <Card padding="lg" style={{ marginBottom: 16 }}>
          <Field label="Notes / additional info">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--ink-300)", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} placeholder="Any additional information for the admin team…" />
          </Field>
        </Card>

        {/* Actions */}
        <Card padding="lg">
          {submitError && (
            <div role="alert" style={{ color: "var(--err-700)", fontSize: 13, marginBottom: 12 }}>{submitError}</div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button onClick={handleSubmit} disabled={sendMut.isPending}>
              {sendMut.isPending ? "Submitting…" : "Submit voucher to admin"}
            </Button>
            <Button variant="secondary" onClick={handleDownloadExcel}>
              Download Excel (.xlsm)
            </Button>
            {user?.name && <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Signed in as {user.name}</span>}
          </div>
        </Card>
      </div>
    </AdminPortalShell>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
