import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { trpc } from "@/lib/trpc";
import { Button, Card, Field, Input, Select, Icons } from "../design/index.jsx";

/**
 * Native React Marketing Request form — fourth tool migrated off the legacy
 * iframe (broker_tool.html `tab-marketing-request`).
 *
 * Submits via `submissions.create` with `type:"marketing-request"` — the server
 * routes the notification to the marketing inbox off that literal
 * (adminNotification.ts). The legacy mailto step is dropped (the server-side
 * notification covers delivery). The official PDF is produced by the existing
 * server AcroForm endpoint `/api/marketing-request/pdf`. See
 * docs/FRAMEWORK_MIGRATION.md.
 */

type Vals = Record<string, string>;

const REQUEST_TYPES = [
  "Flyer / brochure", "Email campaign", "Social media graphic/post", "Offering memorandum",
  "Property listing update", "Presentation / pitch deck", "Signage", "Advertisement",
  "Website update", "Research / map / aerial", "Other",
];
const PRIORITIES = ["Standard", "High", "Urgent / time sensitive"];
const DELIVERABLES = [
  "Print collateral", "Digital graphic", "Email / Constant Contact", "Social media",
  "Presentation", "Website / listing", "Map / aerial", "Other",
];
const DATE_FLEXIBLE = ["Yes", "No", "Somewhat"];
const BRIEFING = ["", "2:00 PM", "2:10 PM", "2:20 PM", "2:30 PM", "2:40 PM", "2:50 PM"];

const sel = (placeholder: string, items: string[]) => [
  { value: "", label: placeholder },
  ...items.map(x => ({ value: x, label: x })),
];

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 84,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--ink-200)",
  fontSize: 14,
  fontFamily: "inherit",
  resize: "vertical",
  boxSizing: "border-box",
  color: "var(--ink-900)",
};

function humanError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
function validEmail(v: string): string {
  return /.+@.+\..+/.test(v) ? v : "";
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const REQUIRED: Array<[string, string]> = [
  ["mr-requester-name", "requester name"],
  ["mr-requester-email", "email"],
  ["mr-project-title", "project title"],
  ["mr-request-type", "project type"],
  ["mr-priority", "priority"],
  ["mr-objective", "project description / objective"],
  ["mr-due-date", "requested due date"],
];

export default function PortalMarketingForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [vals, setVals] = useState<Vals>({ "mr-date-flexible": "Yes" });
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [files, setFiles] = useState<Array<{ filename: string; url: string; fileKey: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitMut = trpc.submissions.create.useMutation();
  const uploadBatch = trpc.files.uploadBatch.useMutation();
  const rosterQ = trpc.brokers.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const submitting = submitMut.isPending;

  const roster = useMemo(() => (Array.isArray(rosterQ.data) ? rosterQ.data : []), [rosterQ.data]);
  const requesterOptions = useMemo(() => {
    const names = roster.map((b: { name?: string }) => b.name || "").filter(Boolean);
    if (user?.name && !names.includes(user.name)) names.unshift(user.name);
    return [{ value: "", label: "Select a name" }, ...names.map(n => ({ value: n, label: n }))];
  }, [roster, user?.name]);

  function emailForName(name: string): string {
    const entry = roster.find((b: { name?: string; email?: string }) => b.name === name);
    return entry?.email || "";
  }
  function setVal(id: string, value: string) {
    setVals(prev => ({ ...prev, [id]: value }));
  }
  function onRequesterChange(name: string) {
    setVals(prev => ({ ...prev, "mr-requester-name": name, "mr-requester-email": emailForName(name) || prev["mr-requester-email"] || "" }));
  }

  // Prefill requester from the signed-in broker.
  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setVals(prev => {
      if (prev["mr-requester-name"]) return prev;
      return {
        ...prev,
        "mr-requester-name": name,
        "mr-requester-email": prev["mr-requester-email"] || emailForName(name) || user?.email || "",
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, roster]);

  function toggleDeliverable(d: string) {
    setDeliverables(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
  }

  async function onFiles(list: FileList | null) {
    if (!list || !list.length) return;
    try {
      const payload = await Promise.all(
        Array.from(list).map(async file => ({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data: await fileToBase64(file),
          category: "marketing_request",
          reference: vals["mr-project-title"] || "marketing",
        }))
      );
      const result = await uploadBatch.mutateAsync({ files: payload, uploaderName: user?.name ?? undefined });
      const ok = (result?.results ?? result ?? []) as Array<{ success?: boolean; filename?: string; url?: string; fileKey?: string }>;
      const uploaded = ok
        .filter(r => r && r.success !== false && r.url)
        .map(r => ({ filename: r.filename ?? "Attachment", url: r.url ?? "", fileKey: r.fileKey ?? "" }));
      setFiles(prev => [...prev, ...uploaded]);
      if (uploaded.length) toast.success(`${uploaded.length} attachment(s) added.`);
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  function missingFields(): string[] {
    return REQUIRED.filter(([id]) => !(vals[id] || "").trim()).map(([, label]) => label);
  }

  function pdfPayload() {
    return {
      requesterName: vals["mr-requester-name"] || "",
      email: vals["mr-requester-email"] || "",
      team: vals["mr-team"] || "",
      projectTitle: vals["mr-project-title"] || "",
      requestType: vals["mr-request-type"] || "",
      priority: vals["mr-priority"] || "",
      propertyAddress: vals["mr-property"] || "",
      objective: vals["mr-objective"] || "",
      deliverables,
      finalSpecs: vals["mr-final-specs"] || "",
      dueDate: vals["mr-due-date"] || "",
      launchDate: vals["mr-launch-date"] || "",
      dateFlexible: vals["mr-date-flexible"] || "",
      timelineNotes: vals["mr-timeline-notes"] || "",
      briefingTime: vals["mr-briefing-time"] || "",
      copyMessaging: vals["mr-copy"] || "",
      assetLinks: vals["mr-asset-links"] || "",
      approverName: vals["mr-approver-name"] || "",
      approverEmail: vals["mr-approver-email"] || "",
      targetAudience: vals["mr-target-audience"] || "",
      market: vals["mr-market"] || "",
      distribution: vals["mr-distribution"] || "",
      additionalNotes: vals["mr-notes"] || "",
    };
  }

  async function onDownloadPdf() {
    const missing = missingFields();
    if (missing.length) {
      setError(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const resp = await fetch("/api/marketing-request/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfPayload()),
      });
      if (!resp.ok) throw new Error(`Could not generate the PDF (HTTP ${resp.status}).`);
      const blob = await resp.blob();
      const safe = (vals["mr-project-title"] || "Marketing_Request").replace(/[^a-zA-Z0-9._-]+/g, "_");
      downloadBlob(blob, `Marketing_Request_${safe}.pdf`);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setDownloading(false);
    }
  }

  async function onSubmit() {
    const missing = missingFields();
    if (missing.length) {
      setError(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }
    setError(null);
    const requestType = vals["mr-request-type"] || "";
    const objective = vals["mr-objective"] || "";
    const notes = [objective, vals["mr-notes"] || ""].filter(Boolean).join("\n\n");
    try {
      const result = await submitMut.mutateAsync({
        type: "marketing-request",
        status: "pending",
        transactionType: requestType,
        address: vals["mr-property"] || "",
        brokerName: vals["mr-requester-name"] || user?.name || "",
        brokerEmail: validEmail(vals["mr-requester-email"] || ""),
        // catchall extras consumed by the admin portal / marketing inbox:
        formType: "marketing-request",
        requestType,
        subject: vals["mr-project-title"] || "",
        priority: vals["mr-priority"] || "",
        dueDate: vals["mr-due-date"] || "",
        launchDate: vals["mr-launch-date"] || "",
        dateFlexible: vals["mr-date-flexible"] || "",
        deliverables,
        finalSpecs: vals["mr-final-specs"] || "",
        timelineNotes: vals["mr-timeline-notes"] || "",
        briefingTime: vals["mr-briefing-time"] || "",
        copyMessaging: vals["mr-copy"] || "",
        assetLinks: vals["mr-asset-links"] || "",
        approverName: vals["mr-approver-name"] || "",
        approverEmail: vals["mr-approver-email"] || "",
        targetAudience: vals["mr-target-audience"] || "",
        market: vals["mr-market"] || "",
        distribution: vals["mr-distribution"] || "",
        objective,
        notes,
        requesterEmail: vals["mr-requester-email"] || "",
        team: vals["mr-team"] || "",
        attachments: files,
      });
      if (result && (result as { success?: boolean }).success === false) {
        throw new Error((result as { error?: string }).error || "The request could not be submitted.");
      }
      toast.success("Marketing request sent — the marketing team has it and it's in your submissions.");
      setLocation("/portal/submissions");
    } catch (e) {
      setError(humanError(e));
    }
  }

  const T = (id: string, label: string, extra: { req?: boolean; ph?: string; type?: string } = {}) => (
    <Field label={label} required={extra.req}>
      <Input
        type={extra.type}
        value={vals[id] || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(id, e.target.value)}
        placeholder={extra.ph}
      />
    </Field>
  );
  const TA = (id: string, label: string, ph?: string, req?: boolean) => (
    <Field label={label} required={req}>
      <textarea value={vals[id] || ""} onChange={e => setVal(id, e.target.value)} placeholder={ph} style={textareaStyle} />
    </Field>
  );
  const grid = (children: ReactNode, min = 200) => (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>{children}</div>
  );

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Need marketing?"
      title="Marketing request"
      description="Request a flyer, campaign, social post, or other marketing deliverable. It goes straight to the marketing team and shows up under your submissions."
      actions={
        <LinkButton href="/portal/workspace" variant="secondary">
          Back to workspace
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 900 }}>
        <Card padding="lg">
          <SectionTitle>Requestor</SectionTitle>
          {grid(
            <>
              <Field label="Requester name" required>
                <Select value={vals["mr-requester-name"] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onRequesterChange(e.target.value)} options={requesterOptions} />
              </Field>
              {T("mr-requester-email", "Email", { req: true, type: "email", ph: "name@lee-associates.com" })}
            </>
          )}
          <div style={{ marginTop: 14 }}>{T("mr-team", "Broker / team / department", { ph: "Lee & Associates Newport Beach" })}</div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Project overview</SectionTitle>
          <div style={{ display: "grid", gap: 14 }}>
            {T("mr-project-title", "Project title", { req: true, ph: "Q3 industrial availability flyer" })}
            {grid(
              <>
                <Field label="Project type" required>
                  <Select value={vals["mr-request-type"] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("mr-request-type", e.target.value)} options={sel("Select one", REQUEST_TYPES)} />
                </Field>
                <Field label="Priority" required>
                  <Select value={vals["mr-priority"] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("mr-priority", e.target.value)} options={sel("Select one", PRIORITIES)} />
                </Field>
              </>
            )}
            {T("mr-property", "Related property / address", { ph: "1450 Von Karman Ave, Irvine" })}
            {TA("mr-objective", "Project description / objective", "What do you need, and what's the goal?", true)}
          </div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Deliverables</SectionTitle>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DELIVERABLES.map(d => {
              const on = deliverables.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDeliverable(d)}
                  style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--lee-red)" : "var(--ink-200)"}`, background: on ? "var(--lee-red-wash)" : "var(--ink-0)", color: on ? "var(--lee-red)" : "var(--ink-700)" }}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>{T("mr-final-specs", "Final size / format / specs", { ph: "8.5×11, double-sided, print + PDF" })}</div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Timeline</SectionTitle>
          {grid(
            <>
              {T("mr-due-date", "Requested due date", { req: true, type: "date" })}
              {T("mr-launch-date", "Event / launch date", { type: "date" })}
              <Field label="Is this date flexible?">
                <Select value={vals["mr-date-flexible"] || "Yes"} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("mr-date-flexible", e.target.value)} options={DATE_FLEXIBLE.map(x => ({ value: x, label: x }))} />
              </Field>
              <Field label="Optional 10-minute briefing window">
                <Select value={vals["mr-briefing-time"] || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVal("mr-briefing-time", e.target.value)} options={BRIEFING.map(x => ({ value: x, label: x || "No briefing requested" }))} />
              </Field>
            </>
          )}
          <div style={{ marginTop: 14 }}>{TA("mr-timeline-notes", "Timeline notes", "Any scheduling context")}</div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Content &amp; assets</SectionTitle>
          <div style={{ display: "grid", gap: 14 }}>
            {TA("mr-copy", "Copy / messaging", "Headlines, body copy, key points")}
            {T("mr-asset-links", "Asset links", { ph: "Dropbox / Drive links to photos, logos, data" })}
            {grid(
              <>
                {T("mr-approver-name", "Approver name")}
                {T("mr-approver-email", "Approver email", { type: "email" })}
              </>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Audience &amp; distribution</SectionTitle>
          <div style={{ display: "grid", gap: 14 }}>
            {grid(
              <>
                {T("mr-target-audience", "Target audience")}
                {T("mr-market", "Geography / market")}
              </>
            )}
            {TA("mr-distribution", "Distribution details", "Where/how this will be used")}
          </div>
        </Card>

        <Card padding="lg">
          <SectionTitle>Notes &amp; attachments</SectionTitle>
          {TA("mr-notes", "Additional notes")}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.ai,.indd" style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
            <Button variant="secondary" size="sm" loading={uploadBatch.isPending} onClick={() => fileRef.current?.click()} icon={<Icons.Upload size={14} />}>
              Add attachments
            </Button>
            {files.length ? <span style={{ fontSize: 12.5, color: "var(--ink-600)" }}>{files.length} file(s): {files.map(f => f.filename).join(", ")}</span> : null}
          </div>
        </Card>

        {error ? (
          <div role="alert" style={{ color: "var(--err-700)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Warn size={14} /> {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={onSubmit} loading={submitting} iconRight={<Icons.Arrow size={16} />}>
            {submitting ? "Sending…" : "Send to marketing"}
          </Button>
          <Button variant="secondary" onClick={onDownloadPdf} loading={downloading} icon={<Icons.Download size={15} />}>
            Download PDF
          </Button>
          {user?.name ? <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Signed in as {user.name}</span> : null}
        </div>
      </div>
    </AdminPortalShell>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--ink-150)" }}>
      {children}
    </div>
  );
}
