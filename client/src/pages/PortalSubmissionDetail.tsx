import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AdminPortalShell from "@/components/AdminPortalShell";

type SubmissionDetail = {
  id: number;
  formType: string;
  status: string;
  reference: string | null;
  submittedBy: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  payload: unknown;
  queuePosition?: number | null;
};

export default function PortalSubmissionDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/submissions/:id");
  const id = Number(params?.id);
  const [activeTab, setActiveTab] = useState<"summary" | "deal" | "documents" | "payload">("summary");
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [queueMeta, setQueueMeta] = useState<{ position: number | null; totalActive: number; aheadOfYou: number | null } | null>(null);
  const [feeOverride, setFeeOverride] = useState<string>("");
  const [contractType, setContractType] = useState<string>("Lease Agreement");
  const [extracting, setExtracting] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = trpc.files.upload.useMutation();
  const extractContract = trpc.contracts.extractContract.useMutation();

  const derivedFee = useMemo(() => deriveFeePercent(item?.payload), [item?.payload]);

  function str(raw: unknown) {
    return String(raw ?? "").trim();
  }

  function getRentRows(payload: any): Array<{ months?: unknown; monthly?: unknown; free?: unknown }> {
    if (!payload || typeof payload !== "object") return [];
    const rows = (payload.rentRows ?? payload.rentSchedule) as any;
    return Array.isArray(rows) ? rows : [];
  }

  function getBrokers(payload: any): Array<{ name?: unknown }> {
    if (!payload || typeof payload !== "object") return [];
    const rows = (payload.brokers ?? payload.internalBrokers ?? payload.commissionBrokers) as any;
    if (Array.isArray(rows) && rows.some((b: any) => str(b?.name).length > 0)) return rows;
    return [payload.listingAgentName, payload.procuringAgentName, payload.brokerName]
      .filter(n => str(n).length > 0)
      .map(n => ({ name: n }));
  }

  function isLeaseLike(payload: any): boolean {
    const txn = str(payload?.transactionType ?? payload?.txnType ?? "").toLowerCase();
    if (txn.includes("lease") || txn.includes("leasing")) return true;
    const rep = str(payload?.representationType ?? "").toLowerCase();
    if (rep.includes("tenant") || rep.includes("landlord")) return true;
    return false;
  }

  function deriveAddressFields(payload: any) {
    const address = str(payload?.address ?? payload?.propertyAddress ?? "");
    const city = str(payload?.city ?? "");
    const zip = str(payload?.zip ?? payload?.zipCode ?? "");
    return { address, city, zip };
  }

  const dealiusChecklist = useMemo(() => {
    const payload: any = item?.payload as any;
    const { address, city, zip } = deriveAddressFields(payload);
    const fee = feePercentFrom(feeOverride) ?? deriveFeePercent(payload);
    const lease = isLeaseLike(payload);
    const rentRows = getRentRows(payload).filter(r => (num(r?.months) ?? 0) > 0);
    const brokers = getBrokers(payload).filter(b => str(b?.name).length > 0);

    const items = [
      {
        key: "address",
        label: "Property address",
        ok: Boolean(address),
        detail: address || "Missing (address / propertyAddress)",
      },
      {
        key: "city",
        label: "City",
        ok: Boolean(city),
        detail: city || "Missing (city)",
      },
      {
        key: "zip",
        label: "Zip",
        ok: Boolean(zip),
        detail: zip || "Missing (zip / zipCode)",
      },
      {
        key: "fee",
        label: "Fee %",
        ok: fee != null && fee > 0,
        detail: fee != null ? `${fee.toFixed(4)}%` : "Missing (feePercent / commissionRate / override)",
      },
      {
        key: "leaseOrSale",
        label: "Deal type",
        ok: true,
        detail: lease ? "Lease" : "Sale / Other",
      },
      {
        key: "rent",
        label: "Rent schedule",
        ok: !lease || rentRows.length > 0,
        detail: lease ? `${rentRows.length} period(s)` : "Not required for sale",
      },
      {
        key: "brokers",
        label: "Brokers",
        ok: brokers.length > 0,
        detail: brokers.length ? `${brokers.length} broker(s)` : "Missing (brokers list or agent name fields)",
      },
    ];

    const blockingKeys = new Set(["address", "city", "zip", "fee", "rent"]);
    const blockingMissing = items.filter(i => blockingKeys.has(i.key) && !i.ok);
    const canPush = blockingMissing.length === 0;
    return { items, canPush, blockingMissing };
  }, [feeOverride, item?.payload]);

  function num(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const normalized = String(raw).replace(/[$,%]/g, "").replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function feePercentFrom(raw: unknown): number | null {
    const n = num(raw);
    if (n == null || n <= 0) return null;
    return n <= 1 ? n * 100 : n;
  }

  function deriveFeePercent(payload: any): number | null {
    if (!payload || typeof payload !== "object") return null;
    const candidates: unknown[] = [
      payload.feePercent,
      payload.feePct,
      payload.clientRepFee,
      payload.oppositeSideRepFee,
      payload.commissionRate,
      payload.commissionPct,
      payload.commRate,
      payload.commPct,
      payload.saleCommPct,
      payload.dx_saleCommPct,
      payload.totalCommissionPct,
    ];
    for (const c of candidates) {
      const pct = feePercentFrom(c);
      if (pct != null) return pct;
    }
    return null;
  }

  function feePercentFromCommAmount(raw: unknown): number | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!m) return null;
    return feePercentFrom(m[1]);
  }

  function mergeVoucherFromContractExtraction(params: {
    payload: any;
    contract: any;
    pdf?: { url?: string; fileKey?: string; filename?: string } | null;
    contractType: string;
  }) {
    const { payload, contract, pdf, contractType } = params;
    const next: any = { ...(payload || {}) };
    const safeContract = contract && typeof contract === "object" ? contract : {};

    const propAddress = String(safeContract.propAddress ?? "").trim();
    const propCity = String(safeContract.propCity ?? "").trim();
    const propState = String(safeContract.propState ?? "").trim();
    const propZip = String(safeContract.propZip ?? "").trim();

    // Populate common voucher fields used by Dealius push.
    if (propAddress) next.address = next.address ?? propAddress;
    if (propCity) next.city = next.city ?? propCity;
    if (propState) next.state = next.state ?? propState;
    if (propZip) next.zip = next.zip ?? propZip;

    // Also set propertyAddress for legacy payloads if it's absent.
    if (!next.propertyAddress && (propAddress || propCity || propState || propZip)) {
      const addr = [propAddress, propCity, propState].filter(Boolean).join(", ");
      next.propertyAddress = addr + (propZip ? ` ${propZip}` : "");
    }

    // Parties
    const lessor = String(safeContract.mlLessor ?? safeContract.party1Name ?? "").trim();
    const lessee = String(safeContract.mlLessee ?? "").trim();
    if (lessor) next.lessorName = next.lessorName ?? lessor;
    if (lessee) next.lesseeName = next.lesseeName ?? lessee;

    // Term dates
    if (safeContract.termStart) next.commencementDate = next.commencementDate ?? String(safeContract.termStart);
    if (safeContract.termEnd) next.expirationDate = next.expirationDate ?? String(safeContract.termEnd);

    // Commission percent
    const pct = feePercentFromCommAmount(safeContract.commAmount);
    if (pct != null && next.feePercent == null && next.commissionRate == null) {
      next.feePercent = pct;
      next.commissionRate = String(pct);
    }

    // Keep full extraction payload for audit/debugging.
    next.aiExtract = {
      ...(next.aiExtract || {}),
      contract: {
        extractedAt: new Date().toISOString(),
        contractType,
        pdf: pdf ?? null,
        data: safeContract,
      },
    };

    return next;
  }

  async function handleImportVoucherExcel(file: File) {
    if (!item) return;
    if (user?.role !== "admin") return;
    if (item.formType !== "voucher") return;
    setImportingExcel(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          const comma = dataUrl.indexOf(",");
          if (comma === -1) return reject(new Error("Could not read file"));
          resolve(dataUrl.slice(comma + 1));
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });

      const r = await fetch(`/api/submissions/${item.id}/import-voucher-excel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, filename: file.name }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b?.error ?? "Excel import failed");

      const r2 = await fetch(`/api/submissions/${item.id}`, { credentials: "include" });
      const b2 = await r2.json().catch(() => ({}));
      if (r2.ok) setItem(b2?.data ?? null);

      const d = b?.data;
      toast.success(
        d
          ? `Imported voucher: ${d.dealName ?? "OK"} (${d.rentRowCount ?? 0} rent period(s), ${d.brokerCount ?? 0} broker(s))`
          : "Excel voucher imported."
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Excel import failed");
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleExtractFile(file: File) {
    if (!item) return;
    if (user?.role !== "admin") return;
    setExtracting(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          const comma = dataUrl.indexOf(",");
          if (comma === -1) return reject(new Error("Could not read file"));
          resolve(dataUrl.slice(comma + 1));
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });

      const up = await uploadFile.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
        category: "submissions/contracts",
        reference: item.reference || String(item.id),
        uploaderName: user?.name || undefined,
      });
      if (!up?.success || !up?.url) throw new Error("Upload failed");

      const ex = await extractContract.mutateAsync({ pdfUrl: up.url, contractType });
      if (!ex?.success || !ex?.data) throw new Error(ex?.error || "AI extraction failed");

      const currentPayload: any = item.payload as any;
      const nextPayload = mergeVoucherFromContractExtraction({
        payload: currentPayload,
        contract: ex.data,
        pdf: { url: up.url, fileKey: up.fileKey, filename: up.filename },
        contractType,
      });

      const put = await fetch(`/api/submissions/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: nextPayload }),
      });
      const putBody = await put.json().catch(() => ({}));
      if (!put.ok) throw new Error(putBody?.error ?? "Failed to save extracted fields");

      // Refresh
      const r2 = await fetch(`/api/submissions/${item.id}`, { credentials: "include" });
      const b2 = await r2.json().catch(() => ({}));
      if (r2.ok) setItem(b2?.data ?? null);

      toast.success("AI extracted fields and saved to submission.");
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setError(null);
    setItem(null);
    setQueueMeta(null);
    fetch(`/api/submissions/${id}`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) throw new Error(b?.error ?? "Failed to load submission");
        const next = b?.data ?? null;
        setItem(next);
        const derived = deriveFeePercent(next?.payload);
        setFeeOverride(derived != null ? String(Number(derived.toFixed(4))) : "");
      })
      .catch(e => {
        if (!alive) return;
        setError(e.message ?? "Failed to load");
      });

    fetch(`/api/submissions/${id}/queue`, { credentials: "include" })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!alive) return;
        if (!ok) return;
        setQueueMeta(b?.data ?? null);
      })
      .catch(() => {
        // ignore queue failures; detail still renders
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function pushToDealius() {
    if (!item) return;
    setPushing(true);
    setPushError(null);
    try {
      const feePercent = feePercentFrom(feeOverride);
      const r = await fetch(`/api/submissions/${item.id}/push-dealius`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            feePercent: feePercent,
          },
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = Array.isArray(b?.errors) ? b.errors.join(" ") : b?.error;
        throw new Error(detail ?? "Push failed");
      }
      // Refresh the submission so the admin can see dealiusPush result stored in payload.
      const r2 = await fetch(`/api/submissions/${item.id}`, { credentials: "include" });
      const b2 = await r2.json().catch(() => ({}));
      if (r2.ok) setItem(b2?.data ?? null);
    } catch (e: any) {
      setPushError(e?.message ?? "Push failed");
    } finally {
      setPushing(false);
    }
  }

  async function updateStatus(status: string) {
    if (!item || user?.role !== "admin") return;
    setUpdatingStatus(status);
    try {
      const r = await fetch(`/api/submissions/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b?.error ?? "Status update failed");
      setItem({ ...item, status, updatedAt: new Date().toISOString() });
      toast.success(`Submission marked ${status.replace("_", " ")}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Status update failed");
    } finally {
      setUpdatingStatus(null);
    }
  }

  const statusActions = ["in_review", "approved", "rejected"];

  return (
    <AdminPortalShell
      section="detail"
      title={`Submission #${id}`}
      description={item ? `${item.reference || "(untitled)"} - ${item.formType} - ${item.status}` : "Loading submission detail workspace."}
      actions={
        <Link href={user?.role === "admin" ? "/portal/admin/submissions" : "/portal/submissions"}>
          <Button variant="secondary">Back to queue</Button>
        </Link>
      }
    >
      <Card padding="lg">
          {error ? (
            <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
          ) : !item ? (
            <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>{item.reference || "(untitled)"}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                    status: {item.status}
                  </div>
                  {queueMeta?.position !== null && queueMeta?.position !== undefined && (
                    <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>
                      queue: #{queueMeta.position} of {queueMeta.totalActive}
                      {typeof queueMeta.aheadOfYou === "number" ? ` (ahead: ${queueMeta.aheadOfYou})` : ""}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                  Created: {new Date(item.createdAt).toLocaleString()}
                  <br />
                  Updated: {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>

              <div className="admin-detail-tabs" role="tablist" aria-label="Submission detail sections">
                {[
                  ["summary", "Summary", "Status and queue"],
                  ["deal", "Deal submission", "Dealius controls"],
                  ["documents", "Documents", "Imports and extraction"],
                  ["payload", "Payload", "Raw data"],
                ].map(([key, label, subhead]) => (
                  <button
                    key={key}
                    type="button"
                    className={activeTab === key ? "active" : ""}
                    onClick={() => setActiveTab(key as typeof activeTab)}
                  >
                    <span>{label}</span>
                    <small>{subhead}</small>
                  </button>
                ))}
              </div>

              {activeTab === "summary" && (
                <section className="admin-detail-panel">
                  <div className="admin-detail-summary-grid">
                    <div>
                      <span>Reference</span>
                      <strong>{item.reference || "(untitled)"}</strong>
                    </div>
                    <div>
                      <span>Type</span>
                      <strong>{item.formType}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{item.status}</strong>
                    </div>
                    <div>
                      <span>Submitted by</span>
                      <strong>{item.submittedBy || item.submittedByEmail || "Unknown"}</strong>
                    </div>
                    <div>
                      <span>Created</span>
                      <strong>{new Date(item.createdAt).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{new Date(item.updatedAt).toLocaleString()}</strong>
                    </div>
                    {queueMeta?.position !== null && queueMeta?.position !== undefined && (
                      <div>
                        <span>Queue</span>
                        <strong>
                          #{queueMeta.position} of {queueMeta.totalActive}
                          {typeof queueMeta.aheadOfYou === "number" ? ` (${queueMeta.aheadOfYou} ahead)` : ""}
                        </strong>
                      </div>
                    )}
                  </div>
                  {user?.role === "admin" && (
                    <div className="admin-status-actions">
                      {["pending", "in_review", "approved", "rejected"].map(status => (
                        <Button
                          key={status}
                          variant={item.status === status ? "primary" : "secondary"}
                          disabled={updatingStatus !== null || item.status === status}
                          onClick={() => updateStatus(status)}
                        >
                          {updatingStatus === status ? "Updating..." : status.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "deal" && user?.role !== "admin" && (
                <section className="admin-detail-panel">
                  <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Admin access is required for deal submission controls.</div>
                </section>
              )}

              {activeTab === "deal" && user?.role === "admin" && (
                <section className="admin-detail-panel">
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <Button
                      variant="primary"
                      disabled={pushing || !dealiusChecklist.canPush}
                      onClick={pushToDealius}
                    >
                      {pushing ? "Pushing to Dealius…" : "Review & push to Dealius"}
                    </Button>
                    {pushError && <span style={{ color: "var(--err-700)", fontSize: 12 }}>{pushError}</span>}
                    {!dealiusChecklist.canPush && (
                      <span style={{ color: "var(--err-700)", fontSize: 12 }}>
                        Fix missing fields before pushing.
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      Voucher submissions only for now.
                    </span>
                  </div>
                </section>
              )}

              {activeTab === "deal" && user?.role === "admin" && item?.formType === "voucher" && (
                <section className="admin-detail-panel">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                    Dealius push settings
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: 12, color: "var(--ink-600)" }}>
                      Fee %
                      <input
                        value={feeOverride}
                        onChange={e => setFeeOverride(e.target.value)}
                        inputMode="decimal"
                        placeholder="e.g. 3"
                        style={{
                          marginLeft: 8,
                          width: 110,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--ink-200)",
                          fontSize: 13,
                        }}
                      />
                    </label>
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      Sent to Dealius as percent (3 = 3%, 0.03 = 3%).
                    </span>
                  </div>
                </section>
              )}

              {activeTab === "deal" && user?.role === "admin" && (
                <section className="admin-detail-panel">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                    Dealius pre-flight checklist
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--ink-200)",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "white",
                    }}
                  >
                    {dealiusChecklist.items.map((it, idx) => (
                      <div
                        key={it.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderTop: idx === 0 ? undefined : "1px solid var(--ink-150)",
                          background: it.ok ? "var(--ok-100)" : "var(--err-100)",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-900)" }}>{it.label}</div>
                        <div style={{ fontSize: 12, color: it.ok ? "var(--ok-700)" : "var(--err-700)", textAlign: "right" }}>
                          {it.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!dealiusChecklist.canPush && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--err-700)" }}>
                      Blocking issues: {dealiusChecklist.blockingMissing.map(i => i.label).join(", ")}
                    </div>
                  )}
                </section>
              )}

              {activeTab === "documents" && user?.role !== "admin" && (
                <section className="admin-detail-panel">
                  <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Admin access is required for document import and extraction.</div>
                </section>
              )}

              {activeTab === "documents" && user?.role === "admin" && item?.formType === "voucher" && (
                <section className="admin-detail-panel">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                    Import Lee voucher (Excel)
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      ref={excelFileInputRef}
                      type="file"
                      accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                      style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleImportVoucherExcel(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="secondary"
                      disabled={!item || importingExcel}
                      onClick={() => excelFileInputRef.current?.click()}
                    >
                      {importingExcel ? "Importing…" : "Upload .xlsx / .xlsm voucher"}
                    </Button>
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      Uses the same cell layout as the legacy commission voucher workbook (first sheet).
                    </span>
                  </div>
                </section>
              )}

              {activeTab === "documents" && user?.role === "admin" && (
                <section className="admin-detail-panel">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                    AI extract (voucher / lease / PSA PDF)
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: 12, color: "var(--ink-600)" }}>
                      Document type
                      <select
                        value={contractType}
                        onChange={e => setContractType(e.target.value)}
                        style={{
                          marginLeft: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--ink-200)",
                          fontSize: 13,
                          background: "white",
                        }}
                      >
                        <option>Lease Agreement</option>
                        <option>Purchase &amp; Sale Agreement</option>
                        <option>AIR CRE Contract</option>
                        <option>Commission Agreement</option>
                      </select>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleExtractFile(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="secondary"
                      disabled={!item || extracting}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {extracting ? "Extracting…" : "Upload PDF & extract"}
                    </Button>
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      Fills address, parties, term dates, and fee % when found.
                      {derivedFee != null ? ` (current fee: ${derivedFee.toFixed(2)}%)` : ""}
                    </span>
                  </div>
                </section>
              )}

              {activeTab === "payload" && (
                <section className="admin-detail-panel">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                    Body
                  </div>
                  <div
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--ink-200)",
                      background: "white",
                      overflow: "auto",
                      fontSize: 13,
                      color: "var(--ink-900)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {(() => {
                      const p: any = item.payload as any;
                      return typeof p?.body === "string" ? p.body : JSON.stringify(item.payload, null, 2);
                    })()}
                  </div>
                </section>
              )}
            </>
          )}
      </Card>
    </AdminPortalShell>
  );
}

