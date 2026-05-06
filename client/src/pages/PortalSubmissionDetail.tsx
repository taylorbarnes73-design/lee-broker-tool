import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AdminPortalShell from "@/components/AdminPortalShell";
import DealiusSubmissionWorkspace from "@/components/DealiusSubmissionWorkspace";
import { mergeVoucherFromContractExtraction } from "@shared/contractIntake";

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

type QueueMeta = {
  position: number | null;
  totalActive: number;
  aheadOfYou: number | null;
};

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
  for (const candidate of candidates) {
    const pct = feePercentFrom(candidate);
    if (pct != null) return pct;
  }
  return null;
}

function payloadBody(payload: unknown): string {
  const p: any = payload as any;
  if (typeof p?.body === "string") return p.body;
  return JSON.stringify(payload, null, 2);
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

export default function PortalSubmissionDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/portal/submissions/:id");
  const id = Number(params?.id);
  const [activeTab, setActiveTab] = useState<"summary" | "deal" | "documents" | "payload">("summary");
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueMeta, setQueueMeta] = useState<QueueMeta | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [contractType, setContractType] = useState("Lease Agreement");
  const [extracting, setExtracting] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = trpc.files.upload.useMutation();
  const extractContract = trpc.contracts.extractContract.useMutation();
  const derivedFee = deriveFeePercent(item?.payload);

  async function reloadSubmission() {
    if (!Number.isFinite(id)) {
      setError("Invalid submission id.");
      return;
    }
    setError(null);
    const response = await fetch(`/api/submissions/${id}`, { credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error ?? "Failed to load submission");
    setItem(body?.data ?? null);
  }

  async function reloadQueue() {
    if (!Number.isFinite(id)) return;
    const response = await fetch(`/api/submissions/${id}/queue`, { credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setQueueMeta(body?.data ?? null);
  }

  useEffect(() => {
    let alive = true;
    setItem(null);
    setQueueMeta(null);
    setError(null);

    if (!Number.isFinite(id)) {
      setError("Invalid submission id.");
      return () => {
        alive = false;
      };
    }

    fetch(`/api/submissions/${id}`, { credentials: "include" })
      .then(response => response.json().then(body => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (!ok) throw new Error(body?.error ?? "Failed to load submission");
        setItem(body?.data ?? null);
      })
      .catch((e: any) => {
        if (alive) setError(e?.message ?? "Failed to load submission");
      });

    fetch(`/api/submissions/${id}/queue`, { credentials: "include" })
      .then(response => response.json().then(body => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (alive && ok) setQueueMeta(body?.data ?? null);
      })
      .catch(() => {
        // Queue status is helpful, but the detail view can still render without it.
      });

    return () => {
      alive = false;
    };
  }, [id]);

  async function updateStatus(status: string) {
    if (!item || user?.role !== "admin") return;
    setUpdatingStatus(status);
    try {
      const response = await fetch(`/api/submissions/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Status update failed");
      setItem({ ...item, status, updatedAt: new Date().toISOString() });
      toast.success(`Submission marked ${status.replace("_", " ")}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Status update failed");
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleImportVoucherExcel(file: File) {
    if (!item || user?.role !== "admin" || item.formType !== "voucher") return;
    setImportingExcel(true);
    try {
      const base64Data = await fileAsBase64(file);
      const response = await fetch(`/api/submissions/${item.id}/import-voucher-excel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, filename: file.name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Excel import failed");

      await reloadSubmission();
      const data = body?.data;
      toast.success(
        data
          ? `Imported voucher: ${data.dealName ?? "OK"} (${data.rentRowCount ?? 0} rent period(s), ${data.brokerCount ?? 0} broker(s))`
          : "Excel voucher imported."
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Excel import failed");
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleExtractFile(file: File) {
    if (!item || user?.role !== "admin") return;
    setExtracting(true);
    try {
      const base64Data = await fileAsBase64(file);
      const uploaded = await uploadFile.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
        category: "submissions/contracts",
        reference: item.reference || String(item.id),
        uploaderName: user?.name || undefined,
      });
      if (!uploaded?.success || !uploaded?.url) throw new Error("Upload failed");

      const extracted = await extractContract.mutateAsync({ pdfUrl: uploaded.url, contractType });
      if (!extracted?.success || !extracted?.data) throw new Error(extracted?.error || "AI extraction failed");

      const nextPayload = mergeVoucherFromContractExtraction({
        payload: item.payload as any,
        contract: extracted.data,
        pdf: { url: uploaded.url, fileKey: uploaded.fileKey, filename: uploaded.filename },
        contractType,
      });

      const response = await fetch(`/api/submissions/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: nextPayload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Failed to save extracted fields");

      await reloadSubmission();
      toast.success("AI extracted fields and saved to submission.");
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  const tabs: Array<[typeof activeTab, string, string]> = [
    ["summary", "Summary", "Status and queue"],
    ["deal", "Dealius", "Create deal or listing"],
    ["documents", "Documents", "Imports and extraction"],
    ["payload", "Payload", "Raw data"],
  ];

  return (
    <AdminPortalShell
      section="detail"
      title={`Submission #${Number.isFinite(id) ? id : ""}`}
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
          <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>{item.reference || "(untitled)"}</div>
                <div style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 2 }}>status: {item.status}</div>
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
              {tabs.map(([key, label, subhead]) => (
                <button
                  key={key}
                  type="button"
                  className={activeTab === key ? "active" : ""}
                  onClick={() => setActiveTab(key)}
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

            {activeTab === "deal" && (
              <section className="admin-detail-panel">
                {user?.role === "admin" ? (
                  <DealiusSubmissionWorkspace submission={item as any} onRefresh={reloadSubmission} />
                ) : (
                  <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Admin access is required for Dealius controls.</div>
                )}
              </section>
            )}

            {activeTab === "documents" && user?.role !== "admin" && (
              <section className="admin-detail-panel">
                <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Admin access is required for document import and extraction.</div>
              </section>
            )}

            {activeTab === "documents" && user?.role === "admin" && item.formType === "voucher" && (
              <section className="admin-detail-panel">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>Import Lee voucher (Excel)</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    ref={excelFileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportVoucherExcel(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="secondary" disabled={!item || importingExcel} onClick={() => excelFileInputRef.current?.click()}>
                    {importingExcel ? "Importing..." : "Upload .xlsx / .xlsm voucher"}
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    Uses the same cell layout as the legacy commission voucher workbook.
                  </span>
                </div>
              </section>
            )}

            {activeTab === "documents" && user?.role === "admin" && (
              <section className="admin-detail-panel">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                  AI extract (voucher, lease, or purchase agreement PDF)
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
                      const file = e.target.files?.[0];
                      if (file) void handleExtractFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="secondary" disabled={!item || extracting} onClick={() => fileInputRef.current?.click()}>
                    {extracting ? "Extracting..." : "Upload PDF and extract"}
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    Fills address, parties, term dates, and fee percent when found.
                    {derivedFee != null ? ` Current fee: ${derivedFee.toFixed(2)}%.` : ""}
                  </span>
                </div>
              </section>
            )}

            {activeTab === "payload" && (
              <section className="admin-detail-panel">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>Body</div>
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
                  {payloadBody(item.payload)}
                </div>
              </section>
            )}
          </>
        )}
      </Card>
    </AdminPortalShell>
  );
}
