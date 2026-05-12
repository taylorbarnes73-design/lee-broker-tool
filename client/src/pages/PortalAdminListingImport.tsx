import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AdminPortalShell from "@/components/AdminPortalShell";
import { Badge, Button, Field, Input } from "../design/index.jsx";

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
  if (
    t === "application/pdf" ||
    t === "image/jpeg" ||
    t === "image/png" ||
    t === "image/webp"
  ) {
    return t;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export default function PortalAdminListingImport() {
  const upload = trpc.files.upload.useMutation();
  const extract = trpc.listingImport.extractFromBrochure.useMutation();
  const push = trpc.listingImport.pushToBuildout.useMutation();

  const [brokerId, setBrokerId] = useState("");
  const [propertyTypeId, setPropertyTypeId] = useState("");
  const [propertySubtypeId, setPropertySubtypeId] = useState("");
  const [updatePropertyId, setUpdatePropertyId] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  const [propertyJson, setPropertyJson] = useState("{}");
  const [contactsJson, setContactsJson] = useState("[]");
  const [photoUrlsJson, setPhotoUrlsJson] = useState("[]");

  const busy = upload.isPending || extract.isPending || push.isPending;

  const lastExtractOk = extract.data?.success === true;

  const hint = useMemo(
    () =>
      "Uses the Buildout API key from Portal → Settings → Integrations. You must supply broker_id, property_type_id, and property_subtype_id from your Buildout account (see Buildout API v1 docs).",
    []
  );

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const mimeType = mimeForFile(file);
      if (!mimeType) {
        toast.error("Use a PDF, JPEG, PNG, or WebP file.");
        return;
      }
      const base64 = await fileToBase64(file);
      try {
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
        setPropertyJson(JSON.stringify(ex.property, null, 2));
        setContactsJson(JSON.stringify(ex.contacts, null, 2));
        setPhotoUrlsJson(JSON.stringify(ex.photoUrls, null, 2));
        toast.success("Brochure parsed — review fields before pushing to Buildout.");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Upload or extract failed");
      }
    },
    [extract, upload]
  );

  const runPush = async () => {
    let listingFields: Record<string, string | undefined>;
    let photoUrls: string[];
    let contactsUnknown: unknown;
    try {
      listingFields = JSON.parse(propertyJson) as Record<string, string | undefined>;
      photoUrls = JSON.parse(photoUrlsJson) as string[];
      contactsUnknown = JSON.parse(contactsJson);
    } catch {
      toast.error("Invalid JSON in property, contacts, or photo URLs.");
      return;
    }
    if (!Array.isArray(photoUrls)) {
      toast.error("photoUrls must be a JSON array of strings.");
      return;
    }
    if (!Array.isArray(contactsUnknown)) {
      toast.error("contacts must be a JSON array.");
      return;
    }

    const b = Number(brokerId);
    const pt = Number(propertyTypeId);
    const pst = Number(propertySubtypeId);
    if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(pt) || pt <= 0 || !Number.isFinite(pst) || pst <= 0) {
      toast.error("Enter positive numeric broker_id, property_type_id, and property_subtype_id.");
      return;
    }

    const buildoutPropertyId =
      mode === "update" ? Number(updatePropertyId) : undefined;
    if (mode === "update" && (!Number.isFinite(buildoutPropertyId) || (buildoutPropertyId ?? 0) <= 0)) {
      toast.error("Enter the existing Buildout property id for update mode.");
      return;
    }

    try {
      const res = await push.mutateAsync({
        mode,
        buildoutPropertyId,
        brokerId: b,
        propertyTypeId: pt,
        propertySubtypeId: pst,
        listingFields,
        photoUrls,
      });
      const failed = res.photoResults.filter(p => !p.ok);
      if (failed.length) {
        toast.message(
          `Buildout property ${res.propertyId}: ${failed.length} photo(s) failed (URLs may be blocked or invalid).`,
          { duration: 8000 }
        );
      } else {
        toast.success(`Buildout ${res.mode === "create" ? "created" : "updated"} property id ${res.propertyId}.`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push to Buildout failed");
    }
  };

  return (
    <AdminPortalShell
      section="listing-import"
      eyebrow="Admin Portal"
      title="Listing import → Buildout"
      description={hint}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12, maxWidth: 960 }}>
        <div style={{ fontSize: 13, color: "var(--ink-600)" }}>
          Entry point: <strong>Portal → Admin → Listing import</strong> (this page). Brochures are uploaded with category{" "}
          <code className="lee-mono text-xs">listing_brochure</code> (20 MB max). Extraction runs server-side (same PDF
          text path as the broker tool&apos;s AI assist).
        </div>

        <div>
          <Field label="Brochure file (PDF or image)">
            <Input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={e => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          {extract.isPending && <div style={{ fontSize: 12, marginTop: 6 }}>Extracting…</div>}
          {lastExtractOk && <Badge tone="success">Extracted</Badge>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          <Field label="broker_id (Buildout)">
            <Input value={brokerId} onChange={e => setBrokerId(e.target.value)} placeholder="e.g. 42" />
          </Field>
          <Field label="property_type_id">
            <Input value={propertyTypeId} onChange={e => setPropertyTypeId(e.target.value)} />
          </Field>
          <Field label="property_subtype_id">
            <Input value={propertySubtypeId} onChange={e => setPropertySubtypeId(e.target.value)} />
          </Field>
        </div>

        <Field label="Mode">
          <select
            className="lee-input"
            value={mode}
            onChange={e => setMode(e.target.value as "create" | "update")}
            disabled={busy}
          >
            <option value="create">Create new property</option>
            <option value="update">Update existing property</option>
          </select>
        </Field>

        {mode === "update" && (
          <Field label="Existing Buildout property id">
            <Input value={updatePropertyId} onChange={e => setUpdatePropertyId(e.target.value)} placeholder="e.g. 1001" />
          </Field>
        )}

        <Field label="Listing fields (JSON — editable)">
          <textarea
            className="lee-input"
            rows={12}
            value={propertyJson}
            onChange={e => setPropertyJson(e.target.value)}
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          />
        </Field>

        <Field label="Contacts (JSON — informational; not sent to Buildout in this MVP)">
          <textarea
            className="lee-input"
            rows={6}
            value={contactsJson}
            onChange={e => setContactsJson(e.target.value)}
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          />
        </Field>

        <Field label="Photo URLs sent to Buildout (https only, JSON array)">
          <textarea
            className="lee-input"
            rows={4}
            value={photoUrlsJson}
            onChange={e => setPhotoUrlsJson(e.target.value)}
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          />
        </Field>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button variant="primary" disabled={busy} onClick={() => void runPush()}>
            {push.isPending ? "Pushing…" : "Push to Buildout"}
          </Button>
        </div>

        <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
          Limitations: Buildout property create requires valid enum IDs from your account. Photos use POST{" "}
          <span className="lee-mono">/properties/ID/photos.json</span> with public <code>url</code> when supported; failed
          uploads are reported per URL. Property update uses HTTP PUT to{" "}
          <span className="lee-mono">properties/ID.json</span> (see Buildout API v1); if your tenant differs, adjust in
          <span className="lee-mono"> buildoutClient.ts</span>.
        </div>
      </div>
    </AdminPortalShell>
  );
}
