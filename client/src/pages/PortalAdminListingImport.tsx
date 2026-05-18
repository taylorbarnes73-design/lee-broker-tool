import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Badge, Button, Field, Icons, Input, Select } from "../design/index.jsx";

type ListingKey =
  | "propertyType"
  | "transactionType"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "rateSfMo"
  | "term"
  | "leaseType"
  | "buildingSf"
  | "suiteSf"
  | "askingPrice"
  | "listingAgentName"
  | "listingAgentLicense"
  | "comments";

type ListingFields = Record<ListingKey, string>;
type ContactRow = { name: string; email: string; phone: string; company: string; role: string };
type PushResult = {
  propertyId: number;
  mode: "create" | "update";
  photoResults: Array<{ url: string; ok: boolean; error?: string }>;
} | null;

const EMPTY_FIELDS: ListingFields = {
  propertyType: "",
  transactionType: "",
  address: "",
  city: "",
  state: "CA",
  zip: "",
  rateSfMo: "",
  term: "",
  leaseType: "",
  buildingSf: "",
  suiteSf: "",
  askingPrice: "",
  listingAgentName: "",
  listingAgentLicense: "",
  comments: "",
};

const FIELD_GROUPS: Array<{
  title: string;
  description: string;
  fields: Array<{ key: ListingKey; label: string; span?: 1 | 2; type?: string; placeholder?: string }>;
}> = [
  {
    title: "Property",
    description: "The core fields that become the Buildout property record.",
    fields: [
      { key: "address", label: "Address", span: 2, placeholder: "123 Main St" },
      { key: "city", label: "City", placeholder: "Irvine" },
      { key: "state", label: "State", placeholder: "CA" },
      { key: "zip", label: "ZIP", placeholder: "92618" },
      { key: "propertyType", label: "Property type", placeholder: "Industrial" },
      { key: "transactionType", label: "Transaction", placeholder: "Lease or Sale" },
    ],
  },
  {
    title: "Size and pricing",
    description: "Numbers should be plain values without commas or dollar signs where possible.",
    fields: [
      { key: "buildingSf", label: "Building SF", type: "number", placeholder: "25000" },
      { key: "suiteSf", label: "Suite SF", type: "number", placeholder: "12000" },
      { key: "rateSfMo", label: "Rate $/SF/mo", placeholder: "1.45" },
      { key: "leaseType", label: "Lease type", placeholder: "NNN" },
      { key: "term", label: "Term months", type: "number", placeholder: "60" },
      { key: "askingPrice", label: "Asking price", placeholder: "2500000" },
    ],
  },
  {
    title: "Marketing notes",
    description: "These details are merged into the Buildout description.",
    fields: [
      { key: "listingAgentName", label: "Listing agent", placeholder: "Taylor Barnes" },
      { key: "listingAgentLicense", label: "Agent license", placeholder: "DRE #..." },
    ],
  },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function mimeForFile(file: File): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const t = file.type;
  if (t === "application/pdf" || t === "image/jpeg" || t === "image/png" || t === "image/webp") return t;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isPositiveInt(raw: string) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0;
}

function normalizeFields(raw: Record<string, string | undefined> | undefined): ListingFields {
  const next = { ...EMPTY_FIELDS };
  if (!raw) return next;
  (Object.keys(next) as ListingKey[]).forEach(key => {
    const value = raw[key];
    if (typeof value === "string") next[key] = value;
  });
  return next;
}

function normalizeContacts(raw: Array<Record<string, string>> | undefined): ContactRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(row => ({
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    role: row.role ?? "",
  }));
}

function compactListingFields(fields: ListingFields): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value.trim() || undefined])
  );
}

function sanitizePhotoUrl(raw: string) {
  const value = raw.trim();
  return /^https:\/\//i.test(value) ? value : "";
}

export default function PortalAdminListingImport() {
  const upload = trpc.files.upload.useMutation();
  const extract = trpc.listingImport.extractFromBrochure.useMutation();
  const push = trpc.listingImport.pushToBuildout.useMutation();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [brokerId, setBrokerId] = useState("");
  const [propertyTypeId, setPropertyTypeId] = useState("");
  const [propertySubtypeId, setPropertySubtypeId] = useState("");
  const [updatePropertyId, setUpdatePropertyId] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  const [listingFields, setListingFields] = useState<ListingFields>(EMPTY_FIELDS);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<{ name: string; size: number; mimeType: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult>(null);

  const busy = upload.isPending || extract.isPending || push.isPending;
  const idsReady = isPositiveInt(brokerId) && isPositiveInt(propertyTypeId) && isPositiveInt(propertySubtypeId);
  const updateReady = mode === "create" || isPositiveInt(updatePropertyId);
  const hasCoreProperty = Boolean(listingFields.address.trim() && listingFields.city.trim());
  const extractedFieldCount = Object.entries(listingFields).filter(([key, value]) => {
    const clean = value.trim();
    if (!clean) return false;
    return key !== "state" || clean.toUpperCase() !== "CA" || hasCoreProperty;
  }).length;
  const validPhotoCount = photoUrls.filter(Boolean).length;
  const failedPhotoCount = pushResult?.photoResults.filter(p => !p.ok).length ?? 0;
  const canPush = idsReady && updateReady && !busy;

  const workflow = useMemo(
    () => [
      {
        label: "Upload",
        detail: sourceFile ? sourceFile.name : "Brochure or image",
        status: sourceFile ? "complete" : busy ? "active" : "idle",
      },
      {
        label: "Review",
        detail: extractedFieldCount ? `${extractedFieldCount} field(s)` : "Manual entry ok",
        status: extractedFieldCount ? "complete" : "idle",
      },
      {
        label: "Push",
        detail: pushResult ? `Buildout #${pushResult.propertyId}` : idsReady ? "Ready" : "Needs IDs",
        status: pushResult ? "complete" : idsReady ? "active" : "idle",
      },
    ],
    [busy, extractedFieldCount, idsReady, pushResult, sourceFile]
  );

  const hint =
    "Upload a brochure, review the extracted fields, enter the Buildout enum IDs from your account, then create or update the Buildout property.";

  function patchField(key: ListingKey, value: string) {
    setListingFields(current => ({ ...current, [key]: key === "state" ? value.toUpperCase().slice(0, 2) : value }));
  }

  function patchContact(index: number, patch: Partial<ContactRow>) {
    setContacts(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function patchPhoto(index: number, value: string) {
    setPhotoUrls(current => current.map((url, i) => (i === index ? value : url)));
  }

  function resetWorkspace() {
    setListingFields(EMPTY_FIELDS);
    setContacts([]);
    setPhotoUrls([]);
    setNewPhotoUrl("");
    setSourceFile(null);
    setPushResult(null);
    extract.reset();
    push.reset();
    upload.reset();
  }

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const mimeType = mimeForFile(file);
      if (!mimeType) {
        toast.error("Use a PDF, JPEG, PNG, or WebP file.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Use a file under 20 MB.");
        return;
      }

      setSourceFile({ name: file.name, size: file.size, mimeType });
      setPushResult(null);

      try {
        const base64 = await fileToBase64(file);
        const up = await upload.mutateAsync({
          filename: file.name,
          mimeType,
          base64Data: base64,
          category: "listing_brochure",
          reference: "listing-import",
        });
        if (!up.success || !up.url) throw new Error("Upload failed");
        const ex = await extract.mutateAsync({ fileUrl: up.url, mimeType });
        if (!ex.success) {
          toast.error(ex.error ?? "Extraction failed");
          return;
        }
        setListingFields(normalizeFields(ex.property));
        setContacts(normalizeContacts(ex.contacts));
        setPhotoUrls(ex.photoUrls ?? []);
        toast.success("Brochure parsed. Review the fields before pushing to Buildout.");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Upload or extract failed");
      }
    },
    [extract, upload]
  );

  function addPhotoUrl() {
    const url = sanitizePhotoUrl(newPhotoUrl);
    if (!url) {
      toast.error("Photo URLs must start with https://");
      return;
    }
    setPhotoUrls(current => [...new Set([...current, url])].slice(0, 12));
    setNewPhotoUrl("");
  }

  const runPush = async () => {
    if (!canPush) {
      toast.error("Enter positive numeric broker, property type, and property subtype IDs.");
      return;
    }

    const buildoutPropertyId = mode === "update" ? Number(updatePropertyId) : undefined;

    try {
      const res = await push.mutateAsync({
        mode,
        buildoutPropertyId,
        brokerId: Number(brokerId),
        propertyTypeId: Number(propertyTypeId),
        propertySubtypeId: Number(propertySubtypeId),
        listingFields: compactListingFields(listingFields),
        photoUrls: photoUrls.map(sanitizePhotoUrl).filter(Boolean),
      });
      setPushResult(res);
      const failed = res.photoResults.filter(p => !p.ok);
      if (failed.length) {
        toast.message(
          `Buildout property ${res.propertyId}: ${failed.length} photo(s) failed. Review the photo results below.`,
          { duration: 8000 }
        );
      } else {
        toast.success(`Buildout ${res.mode === "create" ? "created" : "updated"} property id ${res.propertyId}.`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push to Buildout failed");
    }
  };

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    void onPickFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <AdminPortalShell
      section="listing-import"
      title="Listing import to Buildout"
      description={hint}
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={resetWorkspace} disabled={busy}>
          Clear
        </Button>
      }
    >
      <div className="buildout-import-workspace">
        <section className="buildout-workflow" aria-label="Listing import progress">
          {workflow.map((step, index) => (
            <div className={`buildout-step ${step.status}`} key={step.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </div>
          ))}
        </section>

        <div className="buildout-main-grid">
          <div className="buildout-content-stack">
            <section className="buildout-panel">
              <div className="buildout-panel-header">
                <div>
                  <h2>Brochure intake</h2>
                  <p>Drop in a PDF or image. The extractor fills the review form below, and you can edit every value before sending.</p>
                </div>
                {extract.isSuccess && <Badge tone="success" icon={<Icons.Check size={12} />}>Extracted</Badge>}
              </div>

              <div
                className={`buildout-upload-zone ${dragging ? "dragging" : ""}`}
                onDragEnter={onDragOver}
                onDragOver={onDragOver}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <div className="buildout-upload-icon">
                  <Icons.Upload size={22} />
                </div>
                <div>
                  <strong>{sourceFile ? sourceFile.name : "Upload a listing brochure"}</strong>
                  <p>{sourceFile ? `${sourceFile.mimeType} - ${formatBytes(sourceFile.size)}` : "PDF, JPG, PNG, or WebP up to 20 MB."}</p>
                </div>
                <Button type="button" variant="primary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  {extract.isPending ? "Extracting…" : sourceFile ? "Replace file" : "Choose file"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  disabled={busy}
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onPickFile(file);
                  }}
                />
              </div>
            </section>

            <section className="buildout-panel">
              <div className="buildout-panel-header">
                <div>
                  <h2>Buildout setup</h2>
                  <p>These IDs come from Buildout and are required by the API for create/update.</p>
                </div>
                <Badge tone={idsReady && updateReady ? "success" : "warn"}>{idsReady && updateReady ? "Ready" : "Needs IDs"}</Badge>
              </div>

              <div className="buildout-mode-toggle" aria-label="Buildout push mode">
                <button type="button" className={mode === "create" ? "active" : ""} onClick={() => setMode("create")} disabled={busy}>
                  Create new
                </button>
                <button type="button" className={mode === "update" ? "active" : ""} onClick={() => setMode("update")} disabled={busy}>
                  Update existing
                </button>
              </div>

              <div className="buildout-field-grid">
                <Field label="Broker ID" required help="Buildout broker_id">
                  <Input value={brokerId} onChange={(e: any) => setBrokerId(e.target.value)} placeholder="Required" inputMode="numeric" />
                </Field>
                <Field label="Property type ID" required help="Buildout property_type_id">
                  <Input value={propertyTypeId} onChange={(e: any) => setPropertyTypeId(e.target.value)} placeholder="Required" inputMode="numeric" />
                </Field>
                <Field label="Property subtype ID" required help="Buildout property_subtype_id">
                  <Input value={propertySubtypeId} onChange={(e: any) => setPropertySubtypeId(e.target.value)} placeholder="Required" inputMode="numeric" />
                </Field>
                {mode === "update" && (
                  <Field label="Existing property ID" required help="Buildout property id">
                    <Input value={updatePropertyId} onChange={(e: any) => setUpdatePropertyId(e.target.value)} placeholder="Required for update" inputMode="numeric" />
                  </Field>
                )}
              </div>
            </section>

            <section className="buildout-panel">
              <div className="buildout-panel-header">
                <div>
                  <h2>Review listing fields</h2>
                  <p>These values map into Buildout property fields and the marketing description.</p>
                </div>
                <Badge tone={hasCoreProperty ? "success" : "neutral"}>{extractedFieldCount} fields</Badge>
              </div>

              {FIELD_GROUPS.map(group => (
                <div className="buildout-form-section" key={group.title}>
                  <div className="buildout-form-section-title">
                    <strong>{group.title}</strong>
                    <span>{group.description}</span>
                  </div>
                  <div className="buildout-field-grid">
                    {group.fields.map(field =>
                      field.key === "transactionType" ? (
                        <Field key={field.key} label={field.label}>
                          <Select
                            value={listingFields.transactionType}
                            onChange={(e: any) => patchField("transactionType", e.target.value)}
                            placeholder="Select"
                            options={["Lease", "Sale", "Sale or Lease", "Sublease"]}
                          />
                        </Field>
                      ) : (
                        <Field key={field.key} label={field.label} span={field.span ?? 1}>
                          <Input
                            type={field.type ?? "text"}
                            value={listingFields[field.key]}
                            onChange={(e: any) => patchField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        </Field>
                      )
                    )}
                  </div>
                </div>
              ))}

              <div className="buildout-form-section">
                <div className="buildout-form-section-title">
                  <strong>Description notes</strong>
                  <span>Visible brochure copy, highlights, loading, parking, or callouts.</span>
                </div>
                <textarea
                  className="buildout-textarea"
                  rows={6}
                  value={listingFields.comments}
                  onChange={e => patchField("comments", e.target.value)}
                  placeholder="Paste or edit brochure notes here."
                />
              </div>
            </section>

            <section className="buildout-panel">
              <div className="buildout-panel-header">
                <div>
                  <h2>Contacts</h2>
                  <p>Captured for review. Contacts are not sent to Buildout by this push yet.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Icons.Plus size={14} />}
                  onClick={() => setContacts(current => [...current, { name: "", email: "", phone: "", company: "", role: "" }])}
                >
                  Add contact
                </Button>
              </div>

              {contacts.length ? (
                <div className="buildout-contact-list">
                  {contacts.map((contact, index) => (
                    <div className="buildout-contact-row" key={index}>
                      <Input value={contact.name} onChange={(e: any) => patchContact(index, { name: e.target.value })} placeholder="Name" />
                      <Input value={contact.email} onChange={(e: any) => patchContact(index, { email: e.target.value })} placeholder="Email" />
                      <Input value={contact.phone} onChange={(e: any) => patchContact(index, { phone: e.target.value })} placeholder="Phone" />
                      <Input value={contact.company} onChange={(e: any) => patchContact(index, { company: e.target.value })} placeholder="Company" />
                      <Input value={contact.role} onChange={(e: any) => patchContact(index, { role: e.target.value })} placeholder="Role" />
                      <button
                        type="button"
                        className="buildout-icon-button"
                        aria-label="Remove contact"
                        onClick={() => setContacts(current => current.filter((_, i) => i !== index))}
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="buildout-empty">No contacts extracted yet.</div>
              )}
            </section>

            <section className="buildout-panel">
              <div className="buildout-panel-header">
                <div>
                  <h2>Photos</h2>
                  <p>Buildout only accepts reachable https image URLs here. Extracted URLs can be edited or removed.</p>
                </div>
                <Badge tone={validPhotoCount ? "success" : "neutral"}>{validPhotoCount} URL(s)</Badge>
              </div>

              <div className="buildout-photo-list">
                {photoUrls.map((url, index) => {
                  const result = pushResult?.photoResults.find(r => r.url === url);
                  return (
                    <div className="buildout-photo-row" key={index}>
                      <Input value={url} onChange={(e: any) => patchPhoto(index, e.target.value)} placeholder="https://..." />
                      {result && <Badge tone={result.ok ? "success" : "danger"}>{result.ok ? "Uploaded" : "Failed"}</Badge>}
                      <button
                        type="button"
                        className="buildout-icon-button"
                        aria-label="Remove photo URL"
                        onClick={() => setPhotoUrls(current => current.filter((_, i) => i !== index))}
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                  );
                })}
                <div className="buildout-photo-row add">
                  <Input value={newPhotoUrl} onChange={(e: any) => setNewPhotoUrl(e.target.value)} placeholder="https://cdn.example.com/photo.jpg" />
                  <Button type="button" variant="secondary" size="sm" onClick={addPhotoUrl}>
                    Add URL
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside className="buildout-side-rail">
            <section className="buildout-panel buildout-push-panel">
              <div className="buildout-panel-header compact">
                <div>
                  <h2>Ready check</h2>
                  <p>Fix required items before pushing.</p>
                </div>
              </div>
              <div className="buildout-check-list">
                <div className={idsReady ? "ok" : "missing"}>
                  <span>Buildout IDs</span>
                  <strong>{idsReady ? "Complete" : "Required"}</strong>
                </div>
                <div className={updateReady ? "ok" : "missing"}>
                  <span>Mode</span>
                  <strong>{mode === "create" ? "Create" : updateReady ? "Update ready" : "Needs property ID"}</strong>
                </div>
                <div className={hasCoreProperty ? "ok" : "warn"}>
                  <span>Property basics</span>
                  <strong>{hasCoreProperty ? "Address and city set" : "Recommended"}</strong>
                </div>
                <div className={validPhotoCount ? "ok" : "warn"}>
                  <span>Photos</span>
                  <strong>{validPhotoCount ? `${validPhotoCount} queued` : "Optional"}</strong>
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={<Icons.Send size={15} />}
                disabled={!canPush}
                onClick={() => void runPush()}
                style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
              >
                {push.isPending ? "Pushing…" : mode === "create" ? "Create in Buildout" : "Update Buildout"}
              </Button>
            </section>

            {pushResult && (
              <section className="buildout-panel buildout-result-panel">
                <Badge tone={failedPhotoCount ? "warn" : "success"}>{failedPhotoCount ? "Partial success" : "Success"}</Badge>
                <h2>Buildout #{pushResult.propertyId}</h2>
                <p>
                  Property {pushResult.mode === "create" ? "created" : "updated"}
                  {pushResult.photoResults.length ? ` with ${pushResult.photoResults.length - failedPhotoCount}/${pushResult.photoResults.length} photo(s).` : "."}
                </p>
                {failedPhotoCount > 0 && (
                  <div className="buildout-result-errors">
                    {pushResult.photoResults.filter(p => !p.ok).map(photo => (
                      <div key={photo.url}>{photo.error || photo.url}</div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="buildout-panel buildout-help-panel">
              <h2>How this maps</h2>
              <p>
                Address, city, state, ZIP, building SF, sale price, and brochure notes are mapped to the Buildout property payload.
              </p>
              <p>
                Contacts are preserved here for review, but the current Buildout push only sends property fields and photo URLs.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </AdminPortalShell>
  );
}
