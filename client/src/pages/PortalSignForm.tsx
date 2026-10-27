import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { trpc } from "@/lib/trpc";
import { buildSignRequestPdf } from "@/lib/signPdf";
import { buildSignOrderFormData, buildSignOrderSections, signOrderPropertyAddress } from "@/lib/signSubmission";
import {
  normalizeSignExtractFields,
  parseQuickConvertPrefill,
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
} from "@shared/quickConvert";
import { Button, Card, Field, Input, Select, Toggle, Icons } from "../design/index.jsx";

/**
 * Native React Sign Orders form — the first tool migrated off the legacy
 * iframe (broker_tool.html `tab-sign`). Submits through the same
 * `email.sendToAdmin` procedure. Location fields (state, zip, maps pin) are
 * stored with the sections and formData so the installer PDF keeps them.
 * See docs/FRAMEWORK_MIGRATION.md.
 */

type SignFields = {
  date: string;
  orderType: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  cross: string;
  support: string;
  qty4x8: string;
  qty6x8: string;
  otherSize: string;
  otherQty: string;
  bannerSize: string;
  bannerQty: string;
  riderToggle: boolean;
  rider: string;
  placementToggle: boolean;
  requestedBy: string;
  access: string;
  accessContact: string;
  comments: string;
  mapsPin: string;
};

type Agent = { name: string; pct: string };

const todayISO = () => new Date().toISOString().split("T")[0];

const emptyFields = (): SignFields => ({
  date: todayISO(),
  orderType: "installation",
  address: "",
  city: "",
  state: "CA",
  zip: "",
  cross: "",
  support: "",
  qty4x8: "0",
  qty6x8: "0",
  otherSize: "",
  otherQty: "0",
  bannerSize: "",
  bannerQty: "0",
  riderToggle: false,
  rider: "",
  placementToggle: false,
  requestedBy: "",
  access: "no",
  accessContact: "",
  comments: "",
  mapsPin: "",
});

const ORDER_TYPE_OPTIONS = [
  { value: "installation", label: "Installation" },
  { value: "removal", label: "Removal" },
  { value: "maintenance", label: "Maintenance" },
];
const ACCESS_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];
const SUPPORT_OPTIONS = [
  { value: "sf", title: "Single Face", sub: "S/F" },
  { value: "df", title: "Double Face", sub: "D/F" },
  { value: "vshape", title: "V-Shape", sub: "V" },
];
const BROCHURE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 72,
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

function extractMime(file: File): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  if (t === "image/webp") return "image/webp";
  if (t === "application/pdf") return "application/pdf";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/pdf";
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

export default function PortalSignForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState<SignFields>(emptyFields);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brochureName, setBrochureName] = useState<string>("");
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const uploadMut = trpc.files.upload.useMutation();
  const extractMut = trpc.aiAssist.extractDocument.useMutation();
  const sendMut = trpc.email.sendToAdmin.useMutation();
  const analyzing = uploadMut.isPending || extractMut.isPending;
  const submitting = sendMut.isPending;

  function update<K extends keyof SignFields>(key: K, value: SignFields[K]) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  // Default requested-by to the signed-in broker once auth resolves.
  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setFields(prev => (prev.requestedBy ? prev : { ...prev, requestedBy: name }));
  }, [user?.name]);

  // One-shot prefill from Quick Convert / portal funnel (sessionStorage).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUICK_CONVERT_PREFILL_STORAGE_KEY);
      if (!raw) return;
      const payload = parseQuickConvertPrefill(raw);
      sessionStorage.removeItem(QUICK_CONVERT_PREFILL_STORAGE_KEY);
      if (!payload || payload.tab !== "sign" || !payload.fields) return;
      applyExtracted(payload.fields as Record<string, unknown>);
      toast.success("We carried over your earlier details — review and finish below.");
    } catch {
      /* ignore malformed prefill */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply AI/prefill fields with the same side effects as the legacy form. */
  function applyExtracted(raw: Record<string, unknown>) {
    const norm = normalizeSignExtractFields(raw as Record<string, string>) as Record<string, string>;
    const f = { ...(raw as Record<string, string>), ...norm };
    setFields(prev => {
      const next = { ...prev };
      if (f.propertyAddress) next.address = String(f.propertyAddress);
      if (f.city) next.city = String(f.city);
      if (f.state) next.state = String(f.state);
      if (f.zip) next.zip = String(f.zip);
      if (f.requestedBy) next.requestedBy = String(f.requestedBy);
      if (f.nameRider) {
        next.rider = String(f.nameRider);
        next.riderToggle = true;
      }
      if (f.specialInstructions) {
        const add = String(f.specialInstructions);
        next.comments = next.comments ? `${next.comments}\n${add}` : add;
      }
      if (f.accessInstructions) {
        const a = String(f.accessInstructions).trim().toLowerCase();
        if (a === "yes" || a === "no") next.access = a;
        else next.accessContact = String(f.accessInstructions);
      }
      return next;
    });
  }

  async function onBrochureSelected(file: File | null) {
    if (!file) return;
    setBrochureName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const up = await uploadMut.mutateAsync({
        filename: file.name,
        mimeType: extractMime(file),
        base64Data: base64,
        category: "brochure",
        reference: "sign",
      });
      const res = await extractMut.mutateAsync({
        fileUrl: up.url,
        mimeType: extractMime(file),
        tab: "sign",
      });
      if (res?.success && res.fields && Object.keys(res.fields).length) {
        applyExtracted(res.fields as Record<string, unknown>);
        toast.success("Document analyzed — we filled in what we could find.");
      } else {
        toast.message("We couldn't pull details from that document. Fill the form in manually.");
      }
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  async function onDownloadPdf() {
    const propertyAddress = signOrderPropertyAddress(fields);
    const sections = buildSignOrderSections(fields);
    try {
      const pdf = await buildSignRequestPdf({ sections, agents, propertyAddress });
      downloadBlob(pdf.blob, pdf.filename);
    } catch (e) {
      toast.error(humanError(e));
    }
  }

  async function onSubmit() {
    setError(null);
    if (!fields.address.trim()) {
      setError("Property address is required before sending.");
      return;
    }
    const propertyAddress = signOrderPropertyAddress(fields);
    const sections = buildSignOrderSections(fields);
    const senderEmail = user?.email && /.+@.+\..+/.test(user.email) ? user.email : undefined;
    try {
      const pdf = await buildSignRequestPdf({ sections, agents, propertyAddress });
      const result = await sendMut.mutateAsync({
        formType: "sign",
        brokerName: (user?.name || fields.requestedBy || "").trim(),
        propertyAddress,
        sections,
        senderEmail,
        pdfAttachment: {
          filename: pdf.filename,
          mimeType: pdf.mimeType,
          base64Data: pdf.base64Data,
        },
        supportingFiles: [],
        formData: buildSignOrderFormData(fields, agents),
      });
      if (!result.success) {
        throw new Error(result.error || "The sign request could not be submitted.");
      }
      downloadBlob(pdf.blob, pdf.filename);
      toast.success("Sign request submitted — the admin team has it in the queue.");
      setLocation("/portal/submissions");
    } catch (e) {
      setError(humanError(e));
    }
  }

  function onClear() {
    if (!window.confirm("Clear the sign request form?")) return;
    setFields({ ...emptyFields(), requestedBy: user?.name?.trim() || "" });
    setAgents([]);
    setBrochureName("");
    setError(null);
  }

  const stepperBtn: CSSProperties = {
    width: 34,
    height: 40,
    border: "1px solid var(--ink-200)",
    background: "var(--ink-0)",
    color: "var(--ink-700)",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  function Qty({
    label,
    value,
    onValue,
  }: {
    label: string;
    value: string;
    onValue: (v: string) => void;
  }) {
    const n = Math.max(0, parseInt(value || "0", 10) || 0);
    return (
      <Field label={label}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" style={stepperBtn} aria-label={`Decrease ${label}`} onClick={() => onValue(String(Math.max(0, n - 1)))}>
            −
          </button>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValue(e.target.value)}
            style={{ width: 80, textAlign: "center" }}
            inputStyle={{ textAlign: "center" }}
          />
          <button type="button" style={stepperBtn} aria-label={`Increase ${label}`} onClick={() => onValue(String(n + 1))}>
            +
          </button>
        </div>
      </Field>
    );
  }

  return (
    <AdminPortalShell
      section="forms"
      eyebrow="Need a sign?"
      title="Order a sign"
      description="Configure the sign order and send it to the admin team. We install a standard Lee & Associates for-lease or for-sale sign at the property — orders are typically fulfilled within 2–3 business days."
      actions={
        <LinkButton href="/portal/workspace" variant="secondary">
          Back to workspace
        </LinkButton>
      }
    >
      <div style={{ marginTop: 14, display: "grid", gap: 16, maxWidth: 860 }}>
        {/* Order basics + AI */}
        <Card padding="lg">
          <SectionTitle>Order basics</SectionTitle>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              border: "1px dashed var(--ink-200)",
              borderRadius: 10,
              padding: "14px 16px",
              background: "var(--ink-50)",
              marginBottom: 18,
            }}
          >
            <span style={{ color: "var(--ai-500)", display: "flex" }}>
              <Icons.Sparkles size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
                Have a brochure or flyer?
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                {brochureName
                  ? `Selected: ${brochureName}`
                  : "Upload it and Deal Assist will fill in the address and details."}
              </div>
            </div>
            <input
              ref={brochureInputRef}
              type="file"
              accept={BROCHURE_ACCEPT}
              style={{ display: "none" }}
              onChange={e => onBrochureSelected(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="ai"
              loading={analyzing}
              onClick={() => brochureInputRef.current?.click()}
              icon={<Icons.Upload size={15} />}
            >
              {analyzing ? "Analyzing…" : "Upload & analyze"}
            </Button>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Field label="Date">
                <Input type="date" value={fields.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("date", e.target.value)} />
              </Field>
              <Field label="Order type">
                <Select
                  value={fields.orderType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update("orderType", e.target.value)}
                  options={ORDER_TYPE_OPTIONS}
                />
              </Field>
            </div>

            <Field label="Property address" required>
              <AddressAutocompleteInput
                value={fields.address}
                onChange={v => update("address", v)}
                onSelect={s => {
                  update("address", s.address);
                  if (s.city) update("city", s.city);
                  if (s.state) update("state", s.state);
                  if (s.zip) update("zip", s.zip);
                }}
                placeholder="500 Anton Blvd"
              />
            </Field>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Field label="City">
                <Input value={fields.city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("city", e.target.value)} placeholder="Costa Mesa" />
              </Field>
              <Field label="State">
                <Input value={fields.state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("state", e.target.value)} placeholder="CA" />
              </Field>
              <Field label="Zip">
                <Input value={fields.zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("zip", e.target.value)} placeholder="92618" />
              </Field>
            </div>

            <Field label="Cross streets / building name">
              <Input value={fields.cross} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("cross", e.target.value)} placeholder="At Bristol St · Plaza Tower" />
            </Field>
          </div>
        </Card>

        {/* Sign specifications */}
        <Card padding="lg">
          <SectionTitle>Sign specifications</SectionTitle>

          <Field label="Configuration">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {SUPPORT_OPTIONS.map(opt => {
                const selected = fields.support === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("support", selected ? "" : opt.value)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      minWidth: 96,
                      padding: "12px 16px",
                      borderRadius: 10,
                      cursor: "pointer",
                      border: `1px solid ${selected ? "var(--lee-red)" : "var(--ink-200)"}`,
                      background: selected ? "var(--lee-red-wash)" : "var(--ink-0)",
                      color: selected ? "var(--lee-red)" : "var(--ink-700)",
                      transition: "border-color .12s, background .12s",
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{opt.sub}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{opt.title}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 16 }}>
            <Qty label="4′ × 8′" value={fields.qty4x8} onValue={v => update("qty4x8", v)} />
            <Qty label="6′ × 8′" value={fields.qty6x8} onValue={v => update("qty6x8", v)} />
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 14, alignItems: "end" }}>
            <Field label="Other size">
              <Input value={fields.otherSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("otherSize", e.target.value)} placeholder="3 × 4" />
            </Field>
            <Qty label="Other qty" value={fields.otherQty} onValue={v => update("otherQty", v)} />
            <Field label="Banner size">
              <Input value={fields.bannerSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("bannerSize", e.target.value)} placeholder="4 × 20" />
            </Field>
            <Qty label="Banner qty" value={fields.bannerQty} onValue={v => update("bannerQty", v)} />
          </div>
        </Card>

        {/* Details */}
        <Card padding="lg">
          <SectionTitle>Details</SectionTitle>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle on={fields.riderToggle} onClick={() => update("riderToggle", !fields.riderToggle)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
                  {fields.riderToggle ? "Name rider included" : "No name rider"}
                </span>
              </div>
              {fields.riderToggle && (
                <div style={{ marginTop: 12 }}>
                  <Field label="Rider text">
                    <Input value={fields.rider} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("rider", e.target.value)} placeholder="Building or suite name on the rider" />
                  </Field>
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle on={fields.placementToggle} onClick={() => update("placementToggle", !fields.placementToggle)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
                  {fields.placementToggle ? "Custom placement" : "Standard placement"}
                </span>
              </div>
              {fields.placementToggle && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-500)", lineHeight: 1.5 }}>
                  Note any specific placement in the comments below, or email placement photos to the admin team after submitting.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Requested by & access */}
        <Card padding="lg">
          <SectionTitle>Requested by &amp; access</SectionTitle>
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Requested by" required>
              <Input value={fields.requestedBy} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("requestedBy", e.target.value)} placeholder="Broker name" />
            </Field>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-700)", marginBottom: 8 }}>
                Participating agents
              </div>
              {agents.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 8 }}>
                  No additional agents added.
                </div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {agents.map((a, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 40px", gap: 8, alignItems: "center" }}>
                    <Input
                      value={a.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAgents(prev => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="Agent name"
                    />
                    <Input
                      value={a.pct}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAgents(prev => prev.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))
                      }
                      placeholder="Shared %"
                      suffix="%"
                    />
                    <button
                      type="button"
                      aria-label="Remove agent"
                      onClick={() => setAgents(prev => prev.filter((_, j) => j !== i))}
                      style={{ ...stepperBtn, color: "var(--err-600)" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <Button variant="secondary" size="sm" icon={<Icons.Plus size={14} />} onClick={() => setAgents(prev => [...prev, { name: "", pct: "" }])}>
                  Add agent
                </Button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Field label="Access necessary?">
                <Select
                  value={fields.access}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update("access", e.target.value)}
                  options={ACCESS_OPTIONS}
                />
              </Field>
              <Field label="Access contact" optional>
                <Input value={fields.accessContact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("accessContact", e.target.value)} placeholder="Name / phone for site access" />
              </Field>
            </div>

            <Field label="Comments" optional>
              <textarea
                value={fields.comments}
                onChange={e => update("comments", e.target.value)}
                placeholder="Gate codes, placement notes, or anything the admin team should know"
                style={textareaStyle}
              />
            </Field>

            <Field label="Google Maps pin URL" optional help="Helps the installer find the exact spot.">
              <Input value={fields.mapsPin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("mapsPin", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
            </Field>
          </div>
        </Card>

        {error ? (
          <div role="alert" style={{ color: "var(--err-700)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Warn size={14} /> {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={onSubmit} loading={submitting} iconRight={<Icons.Arrow size={16} />}>
            {submitting ? "Submitting…" : "Submit to admin"}
          </Button>
          <Button variant="secondary" onClick={onDownloadPdf} icon={<Icons.Download size={15} />}>
            Download PDF
          </Button>
          <Button variant="ghost" onClick={onClear}>
            Clear form
          </Button>
          {user?.name ? (
            <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>Signed in as {user.name}</span>
          ) : null}
        </div>
      </div>
    </AdminPortalShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: "var(--ink-900)",
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: "1px solid var(--ink-150)",
      }}
    >
      {children}
    </div>
  );
}
