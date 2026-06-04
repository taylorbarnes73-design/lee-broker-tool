import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Button, Card } from "../design/index.jsx";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AdminPortalShell from "@/components/AdminPortalShell";
import SubmissionFieldSummary from "@/components/SubmissionFieldSummary";
import DealiusSubmissionWorkspace from "@/components/DealiusSubmissionWorkspace";
import LinkButton from "@/components/ui/LinkButton";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  brokerQueueStatusText,
  brokerSubmissionNextSteps,
  brokerToolTabUrl,
  formatFormType,
  formatSubmissionStatus,
  submissionStatusTone,
} from "@/lib/format";
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
  source?: string | null;
  sourceEmailMessageId?: string | null;
  sourceEmailWebLink?: string | null;
  parsedFields?: {
    formType?: string;
    propertyAddress?: string | null;
    dollarAmounts?: string[];
    contacts?: string[];
    summary?: string;
  } | null;
  // Assignment tracking (admin-only fields)
  assignedTo?: string | null;
  assignedToOpenId?: string | null;
  assignedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  attachments?: SubmissionDocument[];
};

type QueueMeta = {
  position: number | null;
  totalActive: number;
  aheadOfYou: number | null;
};

type ActivityEntry = {
  id: string;
  action: string;
  summary: string;
  actorLabel: string;
  createdAt: string;
};

type SubmissionDocument = {
  title: string;
  filename: string;
  url: string | null;
  fileKey: string | null;
  category: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  downloadUrl?: string | null;
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

function submissionDocumentsFromPayload(payload: unknown): SubmissionDocument[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const docs: SubmissionDocument[] = [];
  const seen = new Set<string>();

  const pushDoc = (
    title: string,
    file: Record<string, unknown> | null | undefined,
    fallbackCategory: string | null = null
  ) => {
    if (!file) return;
    const filename = typeof file.filename === "string" ? file.filename.trim() : "";
    const url = typeof file.url === "string" ? file.url.trim() : "";
    const fileKey = typeof file.fileKey === "string" ? file.fileKey.trim() : "";
    const category = typeof file.category === "string" ? file.category.trim() : fallbackCategory;
    if (!filename || !url) return;
    const dedupeKey = fileKey || url;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    docs.push({
      title,
      filename,
      url,
      fileKey: fileKey || null,
      category: category || null,
      mimeType: typeof file.mimeType === "string" ? file.mimeType : null,
      fileSize: typeof file.fileSize === "number" ? file.fileSize : null,
      downloadUrl: null,
    });
  };

  const archivedFile =
    record.archivedFile && typeof record.archivedFile === "object"
      ? (record.archivedFile as Record<string, unknown>)
      : null;
  pushDoc("Generated submission PDF", archivedFile, "submission_pdf");
  const excelFile =
    record.excelFile && typeof record.excelFile === "object"
      ? (record.excelFile as Record<string, unknown>)
      : null;
  pushDoc("Generated Excel Voucher", excelFile, "voucher_excel");

  const supportingFiles = Array.isArray(record.supportingFiles) ? record.supportingFiles : [];
  supportingFiles.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const file = entry as Record<string, unknown>;
    const label = typeof file.label === "string" && file.label.trim()
      ? file.label.trim()
      : `Supporting document ${index + 1}`;
    pushDoc(label, file, typeof file.category === "string" ? file.category : null);
  });

  return docs;
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

type DetailTab = "summary" | "activity" | "deal" | "documents" | "payload";

export default function PortalSubmissionDetail() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, params] = useRoute("/portal/submissions/:id");
  const id = Number(params?.id);
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueMeta, setQueueMeta] = useState<QueueMeta | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [contractType, setContractType] = useState("Lease Agreement");
  const [extracting, setExtracting] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = trpc.files.upload.useMutation();
  const extractContract = trpc.contracts.extractContract.useMutation();
  const derivedFee = deriveFeePercent(item?.payload);

  useEffect(() => {
    if (!isAdmin && (activeTab === "deal" || activeTab === "payload")) {
      setActiveTab("summary");
    }
  }, [isAdmin, activeTab]);

  async function reloadActivity() {
    if (!Number.isFinite(id)) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const response = await fetch(`/api/submissions/${id}/activity`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? "Failed to load activity");
      setActivity(body?.data ?? []);
    } catch (e: unknown) {
      setActivity([]);
      setActivityError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setActivityLoading(false);
    }
  }
  const submissionDocuments =
    item?.attachments && item.attachments.length > 0 ? item.attachments : submissionDocumentsFromPayload(item?.payload);

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

  useEffect(() => {
    if (activeTab !== "activity" || !Number.isFinite(id)) return;
    void reloadActivity();
  }, [activeTab, id]);

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
      toast.success(`Submission marked ${formatSubmissionStatus(status).toLowerCase()}.`);
      if (activeTab === "activity") {
        void reloadActivity();
      }
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

  const tabs: Array<[DetailTab, string, string]> = isAdmin
    ? [
        ["summary", "Summary", "Status and queue"],
        ["activity", "Activity", "Status & actions"],
        ["deal", "Dealius", "Create deal or listing"],
        ["documents", "Documents", "Imports and extraction"],
        ["payload", "Payload", "Raw data"],
      ]
    : [
        ["summary", "Summary", "Status and queue"],
        ["activity", "Activity", "Status updates"],
        ["documents", "Files", "Uploaded documents"],
      ];

  return (
    <AdminPortalShell
      section="detail"
      title={`Submission #${Number.isFinite(id) ? id : ""}`}
      description={
        item
          ? `${item.reference || "(untitled)"} · ${formatFormType(item.formType)} · ${formatSubmissionStatus(item.status)}`
          : "Loading submission detail workspace."
      }
      actions={
        <LinkButton href="/portal/submissions" variant="secondary">
          {isAdmin ? "Back to queue" : "Back to my submissions"}
        </LinkButton>
      }
    >
      <Card padding="lg">
        {error ? (
          <div style={{ color: "var(--err-700)", fontSize: 13 }}>{error}</div>
        ) : !item ? (
          <div
            aria-hidden
            style={{
              height: 120,
              borderRadius: "var(--r-8)",
              background: "var(--ink-100)",
              border: "1px solid var(--ink-200)",
            }}
          />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink-900)" }}>{item.reference || "(untitled)"}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                  <StatusBadge tone={submissionStatusTone(item.status)} size="sm">
                    {formatSubmissionStatus(item.status)}
                  </StatusBadge>
                  <StatusBadge
                    tone={{ bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" }}
                    size="sm"
                  >
                    {formatFormType(item.formType)}
                  </StatusBadge>
                  {queueMeta?.position !== null && queueMeta?.position !== undefined && (
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      Queue #{queueMeta.position} of {queueMeta.totalActive}
                      {typeof queueMeta.aheadOfYou === "number" ? ` · ${queueMeta.aheadOfYou} ahead` : ""}
                    </span>
                  )}
                </div>
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
                {(item.source === "email_ingest" || item.source === "email_ingest_backfill") && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: 14,
                      borderRadius: "var(--r-8)",
                      border: "1px solid #BCD6EF",
                      background: "#E6F0FA",
                      color: "#1F4F8B",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      ✉ Imported from {item.source === "email_ingest_backfill" ? "BrokerAdmin backfill" : "BrokerAdmin email"}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      Sender: <strong>{item.submittedByEmail ?? "(unknown)"}</strong> · Received{" "}
                      <strong>{new Date(item.createdAt).toLocaleString()}</strong>
                      {item.sourceEmailWebLink && (
                        <>
                          {" · "}
                          <a href={item.sourceEmailWebLink} target="_blank" rel="noreferrer" style={{ color: "#1F4F8B", fontWeight: 700 }}>
                            Open in Outlook ↗
                          </a>
                        </>
                      )}
                    </div>
                    {item.parsedFields && (
                      <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}>
                        {item.parsedFields.propertyAddress && (
                          <div>Address: <strong>{item.parsedFields.propertyAddress}</strong></div>
                        )}
                        {item.parsedFields.dollarAmounts && item.parsedFields.dollarAmounts.length > 0 && (
                          <div>Amounts: <strong>{item.parsedFields.dollarAmounts.join(", ")}</strong></div>
                        )}
                        {item.parsedFields.contacts && item.parsedFields.contacts.length > 0 && (
                          <div>Contacts: <strong>{item.parsedFields.contacts.join(", ")}</strong></div>
                        )}
                        {item.parsedFields.summary && (
                          <div style={{ marginTop: 4 }}>Summary: {item.parsedFields.summary}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!isAdmin && item && (
                  <>
                    <div
                      style={{
                        marginBottom: 18,
                        padding: 14,
                        borderRadius: "var(--r-8)",
                        border: `1px solid ${item.status === "in_review" ? "rgba(0, 49, 70, 0.22)" : "var(--ink-200)"}`,
                        background: item.status === "in_review" ? "rgba(0, 49, 70, 0.06)" : "var(--ink-50)",
                        fontSize: 13,
                        color: "var(--ink-700)",
                        lineHeight: 1.55,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-800)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        What happens next
                      </div>
                      <p style={{ margin: 0 }}>{brokerSubmissionNextSteps(item.status, item.formType)}</p>
                      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-500)" }}>
                        {brokerQueueStatusText(item.status, queueMeta?.position ?? item.queuePosition ?? null)}
                      </p>
                      {queueMeta?.position !== null && queueMeta?.position !== undefined && item.status === "pending" && (
                        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-600)" }}>
                          Queue position #{queueMeta.position} of {queueMeta.totalActive}
                          {typeof queueMeta.aheadOfYou === "number" && queueMeta.aheadOfYou > 0
                            ? ` — ${queueMeta.aheadOfYou} ahead of you`
                            : queueMeta.position === 1
                              ? " — you're next"
                              : ""}
                          .
                        </p>
                      )}
                    </div>
                  </>
                )}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)", marginBottom: 8 }}>
                    Submitted details
                  </div>
                  <SubmissionFieldSummary
                    formType={item.formType}
                    payload={item.payload}
                    reference={item.reference}
                  />
                </div>
                <div className="admin-detail-summary-grid">
                  <div>
                    <span>Reference</span>
                    <strong>{item.reference || "(untitled)"}</strong>
                  </div>
                  <div>
                    <span>Type</span>
                    <strong>{formatFormType(item.formType)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{formatSubmissionStatus(item.status)}</strong>
                  </div>
                  <div>
                    <span>Submitted by</span>
                    <strong>{item.submittedBy || item.submittedByEmail || "Unknown"}</strong>
                  </div>
                  <div>
                    <span>Submitted</span>
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
                  {!isAdmin && item && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span>Your status</span>
                      <strong>{brokerQueueStatusText(item.status, queueMeta?.position ?? null)}</strong>
                    </div>
                  )}
                  {/* Assignment / completion info — only admins see who is working on what */}
                  {user?.role === "admin" && item.assignedTo && (
                    <div>
                      <span>Assigned to</span>
                      <strong>
                        {item.assignedTo}
                        {item.assignedAt ? ` · ${new Date(item.assignedAt).toLocaleDateString()}` : ""}
                      </strong>
                    </div>
                  )}
                  {user?.role === "admin" && item.completedBy && (
                    <div>
                      <span>Completed by</span>
                      <strong>
                        {item.completedBy}
                        {item.completedAt ? ` · ${new Date(item.completedAt).toLocaleString()}` : ""}
                      </strong>
                    </div>
                  )}
                </div>
                {!isAdmin && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: "var(--r-8)",
                      border: "1px solid var(--ink-200)",
                      background: "var(--ink-50)",
                      fontSize: 13,
                      color: "var(--ink-700)",
                      lineHeight: 1.5,
                    }}
                  >
                    You will receive an email when the office updates this submission (if notifications are enabled).
                    Need to change something? Submit an updated request from the broker tool, or contact the admin team.
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <LinkButton href={brokerToolTabUrl("voucher")} variant="secondary">
                        Open broker tool
                      </LinkButton>
                      <LinkButton href="/portal/submissions" variant="secondary">
                        All my submissions
                      </LinkButton>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="admin-status-actions">
                    <Button
                      variant={item.status === "pending" ? "primary" : "secondary"}
                      disabled={updatingStatus !== null || item.status === "pending"}
                      onClick={() => updateStatus("pending")}
                    >
                      {updatingStatus === "pending" ? "Updating…" : "Requeue"}
                    </Button>
                    <Button
                      variant={item.status === "in_review" ? "primary" : "secondary"}
                      disabled={updatingStatus !== null || item.status === "in_review"}
                      onClick={() => updateStatus("in_review")}
                    >
                      {updatingStatus === "in_review" ? "Updating…" : item.assignedTo ? "Reassign to me" : "Claim & start"}
                    </Button>
                    <Button
                      variant={item.status === "approved" ? "primary" : "secondary"}
                      disabled={updatingStatus !== null || item.status === "approved"}
                      onClick={() => updateStatus("approved")}
                    >
                      {updatingStatus === "approved" ? "Updating…" : "Mark complete"}
                    </Button>
                    <Button
                      variant={item.status === "rejected" ? "primary" : "secondary"}
                      disabled={updatingStatus !== null || item.status === "rejected"}
                      onClick={() => updateStatus("rejected")}
                    >
                      {updatingStatus === "rejected" ? "Updating…" : "Reject"}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {activeTab === "activity" && (
              <section className="admin-detail-panel">
                {!isAdmin && item && (
                  <div style={{ fontSize: 13, color: "var(--ink-600)", lineHeight: 1.5, marginBottom: 14 }}>
                    Timeline of status changes for this request.{" "}
                    <strong>Pending</strong> means waiting in the office queue;{" "}
                    <strong>In progress</strong> means an admin claimed it and is working on it (not that you need to act).
                  </div>
                )}
                {activityLoading ? (
                  <div style={{ fontSize: 13, color: "var(--ink-500)" }}>Loading activity…</div>
                ) : activityError ? (
                  <div style={{ color: "var(--err-700)", fontSize: 13 }}>{activityError}</div>
                ) : activity.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: 1.5 }}>
                    No activity recorded yet. Status changes and new submissions will appear here.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {activity.map((entry, index) => (
                      <div
                        key={entry.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "12px 0",
                          borderBottom:
                            index < activity.length - 1 ? "1px solid var(--ink-150)" : "none",
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--lee-red, #98002E)",
                            marginTop: 6,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>
                            {entry.summary}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>
                            {entry.actorLabel} · {new Date(entry.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === "deal" && isAdmin && (
              <section className="admin-detail-panel">
                <DealiusSubmissionWorkspace submission={item as any} onRefresh={reloadSubmission} />
              </section>
            )}

            {activeTab === "documents" && (
              <section className="admin-detail-panel">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
                  Submission files
                </div>
                {submissionDocuments.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {submissionDocuments.map(doc => (
                      <div
                        key={doc.fileKey || doc.url}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          padding: 12,
                          borderRadius: "var(--r-8)",
                          border: "1px solid var(--ink-200)",
                          background: "var(--ink-0)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 2 }}>{doc.title}</div>
                          <div style={{ fontWeight: 600, color: "var(--ink-900)", wordBreak: "break-word" }}>{doc.filename}</div>
                          {doc.category && (
                            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>{doc.category}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {doc.downloadUrl && (
                            <a
                              href={doc.downloadUrl}
                              download={doc.filename}
                              style={{ fontSize: 13, fontWeight: 700, color: "var(--lee-crimson)" }}
                            >
                              Download
                            </a>
                          )}
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>
                              Open file ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--ink-500)", fontSize: 13 }}>
                    No uploaded documents were attached to this submission.
                  </div>
                )}
              </section>
            )}

            {activeTab === "documents" && isAdmin && item.formType === "voucher" && (
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
                    {importingExcel ? "Importing…" : "Upload .xlsx / .xlsm voucher"}
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    Uses the same cell layout as the legacy commission voucher workbook.
                  </span>
                </div>
              </section>
            )}

            {activeTab === "documents" && isAdmin && (
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
                        borderRadius: "var(--r-8)",
                        border: "1px solid var(--ink-200)",
                        fontSize: 13,
                        background: "var(--ink-0)",
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
                    {extracting ? "Extracting…" : "Upload PDF and extract"}
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    Fills address, parties, term dates, and fee percent when found.
                    {derivedFee != null ? ` Current fee: ${derivedFee.toFixed(2)}%.` : ""}
                  </span>
                </div>
              </section>
            )}

            {activeTab === "payload" && isAdmin && (
              <section className="admin-detail-panel">
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>Body</div>
                <div
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: "var(--r-8)",
                    border: "1px solid var(--ink-200)",
                    background: "var(--ink-0)",
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
