import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AdminPortalShell from "@/components/AdminPortalShell";
import LinkButton from "@/components/ui/LinkButton";
import { Button, Card } from "../design/index.jsx";
import { usePublicBranding } from "@/hooks/usePublicBranding";
import { trpc } from "@/lib/trpc";
import {
  QUICK_CONVERT_PREFILL_STORAGE_KEY,
  assessQuickConvertPrefill,
  formatQuickConvertPrefillWarnings,
  isListingEntryQuickConvertKind,
  listingVariantForQuickConvertKind,
  mapContractExtractionToVoucherFields,
  mimeTypeFromQuickConvertFilename,
  normalizeListingExtractFields,
  normalizeSignExtractFields,
  serializeQuickConvertPrefill,
  toolTabForQuickConvertKind,
  type QuickConvertKind,
  validateQuickConvertUpload,
} from "@shared/quickConvert";

type ConvertCard = {
  kind: QuickConvertKind;
  title: string;
  description: string;
  badge?: string;
};

type ConvertCardSection = {
  heading: string;
  hint: string;
  cards: ConvertCard[];
};

const PREFILL_CARDS: ConvertCard[] = [
  {
    kind: "lease_to_voucher",
    title: "Lease / agreement → voucher",
    description: "Upload a lease or commission agreement PDF. AI extracts deal fields and opens the voucher tab with highlights.",
    badge: "AI prefill",
  },
  {
    kind: "exclusive_to_sign",
    title: "Exclusive right → sign request",
    description: "Upload an exclusive right or listing agreement PDF. AI fills the sign request form from the document.",
    badge: "AI prefill",
  },
  {
    kind: "exclusive_to_listing_industrial",
    title: "Listing agreement → industrial entry",
    description: "Extract listing fields from an agreement PDF and open the industrial listing entry form for review.",
    badge: "AI prefill",
  },
  {
    kind: "exclusive_to_listing_office",
    title: "Listing agreement → office entry",
    description: "Extract listing fields and open the office listing entry form (matches LANB office template).",
    badge: "AI prefill",
  },
  {
    kind: "exclusive_to_listing_retail",
    title: "Listing agreement → retail entry",
    description: "Extract listing fields and open the retail listing entry form for review.",
    badge: "AI prefill",
  },
  {
    kind: "exclusive_to_listing_land",
    title: "Listing agreement → land entry",
    description: "Extract listing fields and open the land listing entry form for review.",
    badge: "AI prefill",
  },
];

const FILE_CONVERSION_CARDS: ConvertCard[] = [
  {
    kind: "to_pdf",
    title: "Convert to PDF",
    description: "Upload a Word document (.doc / .docx). The server converts it to PDF for email or submission attachments.",
    badge: "PDF download",
  },
  {
    kind: "letterhead",
    title: "Apply LANB letterhead",
    description:
      "Upload Word or PDF. The server prepends the LANB Newport Beach letterhead cover page, then your document pages.",
    badge: "PDF download",
  },
];

const CONVERT_SECTIONS: ConvertCardSection[] = [
  {
    heading: "AI prefill",
    hint: "PDF only in v1 — use Convert to PDF first if you have a Word file.",
    cards: PREFILL_CARDS,
  },
  {
    heading: "File conversion",
    hint: "Accepts Word (.doc, .docx) or PDF. Downloads a PDF when conversion finishes.",
    cards: FILE_CONVERSION_CARDS,
  },
];

function downloadBase64Pdf(filename: string, dataBase64: string) {
  const bytes = Uint8Array.from(atob(dataBase64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function PortalQuickConvert() {
  const [location] = useLocation();
  const isAdminToolsRoute = location.startsWith("/portal/admin/quick-convert");
  const branding = usePublicBranding();
  const accent = branding.primary_color || "var(--lee-red, #98002E)";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedKind, setSelectedKind] = useState<QuickConvertKind | null>(null);
  const [busy, setBusy] = useState(false);

  const statusQuery = trpc.quickConvert.status.useQuery();
  const uploadFile = trpc.files.upload.useMutation();
  const processUploaded = trpc.quickConvert.processUploaded.useMutation();
  const extractContract = trpc.contracts.extractContract.useMutation();
  const extractDocument = trpc.aiAssist.extractDocument.useMutation();
  const extractListingDocument = trpc.aiAssist.extractListingDocument.useMutation();

  const converterNote = (() => {
    const s = statusQuery.data;
    if (!s) return null;
    const parts: string[] = [];
    if (!s.sofficePath) {
      parts.push("Word→PDF uses LibreOffice (soffice) when installed on the server.");
    } else {
      parts.push(`Office converter: ${s.sofficePath}`);
    }
    if (s.letterheadTemplate === "missing") {
      parts.push("Letterhead template not found — add server/assets/templates/lanb-letterhead.dotx.");
    }
    return parts.join(" ");
  })();

  function openFilePicker(kind: QuickConvertKind) {
    setSelectedKind(kind);
    fileInputRef.current?.click();
  }

  async function runWorkflowPrefill(kind: QuickConvertKind, file: File, fileUrl: string) {
    const mimeType = mimeTypeFromQuickConvertFilename(file.name);
    if (kind === "lease_to_voucher") {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Lease → voucher needs a PDF in v1. Use Convert to PDF first, then retry.");
        return;
      }
      const extracted = await extractContract.mutateAsync({
        pdfUrl: fileUrl,
        contractType: "Lease Agreement",
      });
      if (!extracted?.success || !extracted.data) {
        throw new Error(extracted?.error || "Contract extraction failed");
      }
      const fields = mapContractExtractionToVoucherFields(
        extracted.data as Record<string, unknown>
      );
      const assessment = assessQuickConvertPrefill("voucher", fields);
      if (assessment.lowConfidence) {
        toast.warning(formatQuickConvertPrefillWarnings(assessment), { duration: 8000 });
      }
      const payload = {
        version: 1 as const,
        tab: "voucher" as const,
        fields,
        sourceFileUrl: fileUrl,
        sourceFilename: file.name,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
      toast.success(
        `Extracted ${assessment.fieldCount} voucher field(s). Review highlighted fields before submitting.`
      );
      window.location.href = "/portal/forms/voucher";
      return;
    }

    if (kind === "exclusive_to_sign") {
      const pdfMime = mimeType === "application/pdf" ? mimeType : "application/pdf";
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Exclusive → sign needs a PDF in v1. Use Convert to PDF first, then retry.");
        return;
      }
      const result = await extractDocument.mutateAsync({
        fileUrl,
        mimeType: pdfMime,
        tab: "sign",
      });
      if (!result?.success) {
        throw new Error(result?.error || "Could not extract sign request fields from this document.");
      }
      const fields = normalizeSignExtractFields((result.fields || {}) as Record<string, unknown>);
      const assessment = assessQuickConvertPrefill("sign", fields);
      if (assessment.lowConfidence) {
        toast.warning(formatQuickConvertPrefillWarnings(assessment), { duration: 8000 });
      }
      const payload = {
        version: 1 as const,
        tab: "sign" as const,
        fields,
        sourceFileUrl: fileUrl,
        sourceFilename: file.name,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
      toast.success(
        `Extracted ${assessment.fieldCount} sign field(s). Review highlighted fields before submitting.`
      );
      window.location.href = "/portal/forms/sign";
      return;
    }

    if (isListingEntryQuickConvertKind(kind)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Listing entry prefill needs a PDF in v1. Use Convert to PDF first, then retry.");
        return;
      }
      const result = await extractListingDocument.mutateAsync({
        fileUrl,
        mimeType: "application/pdf",
      });
      if (!result?.success) {
        throw new Error(result?.error || "Could not extract listing fields from this document.");
      }
      const forcedVariant = listingVariantForQuickConvertKind(kind);
      const fields = normalizeListingExtractFields((result.fields || {}) as Record<string, unknown>, {
        forcedVariant,
      });
      const assessment = assessQuickConvertPrefill("listing", fields);
      if (assessment.lowConfidence) {
        toast.warning(formatQuickConvertPrefillWarnings(assessment), { duration: 8000 });
      }
      const payload = {
        version: 1 as const,
        tab: "listing" as const,
        fields,
        sourceFileUrl: fileUrl,
        sourceFilename: file.name,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(QUICK_CONVERT_PREFILL_STORAGE_KEY, serializeQuickConvertPrefill(payload));
      toast.success(
        `Extracted ${assessment.fieldCount} listing field(s). Review highlighted fields, then download the official PDF.`
      );
      window.location.href = "/portal/forms/listing";
    }
  }

  async function handleFileSelected(file: File) {
    const kind = selectedKind;
    if (!kind) return;

    const validation = validateQuickConvertUpload({
      filename: file.name,
      mimeType: file.type || mimeTypeFromQuickConvertFilename(file.name),
      byteLength: file.size,
    });
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const uploaded = await uploadFile.mutateAsync({
        filename: file.name,
        mimeType: file.type || mimeTypeFromQuickConvertFilename(file.name),
        base64Data: dataBase64,
        category: "quick_convert",
        reference: kind,
      });

      if (!uploaded?.success || !uploaded.url) {
        throw new Error("Upload failed");
      }
      const fileUrl = uploaded.url;

      if (toolTabForQuickConvertKind(kind)) {
        await runWorkflowPrefill(kind, file, fileUrl);
        return;
      }

      const result = await processUploaded.mutateAsync({
        kind,
        filename: file.name,
        mimeType: file.type || mimeTypeFromQuickConvertFilename(file.name),
        dataBase64,
      });

      if (!result.success) {
        throw new Error(result.error || "Conversion failed");
      }

      downloadBase64Pdf(result.filename, result.dataBase64);
      toast.success(
        result.note
          ? `Downloaded ${result.filename}. ${result.note}`
          : `Downloaded ${result.filename}`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Conversion failed");
    } finally {
      setBusy(false);
      setSelectedKind(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <AdminPortalShell
      section={isAdminToolsRoute ? "quick-convert" : "forms"}
      eyebrow={isAdminToolsRoute ? "Admin Portal" : "Broker Portal"}
      title="Upload a document — skip the typing"
      description="Upload a lease, exclusive, or agreement and we'll read it and prefill the right form for you (closed deal, listing, or sign order). Also converts Word to PDF and applies LANB letterhead."
      actions={
        <>
          <LinkButton href="/portal/workspace" variant="secondary">
            Workspace
          </LinkButton>
          <LinkButton href="/portal/submissions" variant="secondary">
            My submissions
          </LinkButton>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
        }}
      />

      <div className="admin-portal-card">
        <Card padding="lg">
          {converterNote && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-600)",
                marginBottom: 16,
                lineHeight: 1.5,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--ink-50)",
                border: "1px solid var(--ink-200)",
              }}
            >
              {converterNote}
            </div>
          )}

          {CONVERT_SECTIONS.map(section => (
            <div key={section.heading} style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink-800)" }}>{section.heading}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-500)", lineHeight: 1.45 }}>{section.hint}</p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                {section.cards.map(card => (
                  <div
                    key={card.kind}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "16px 18px",
                      borderRadius: 12,
                      border: "1px solid var(--ink-200)",
                      background: "var(--ink-0)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-900)" }}>{card.title}</span>
                      {card.badge && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: `${accent}14`,
                            color: accent,
                          }}
                        >
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--ink-600)", lineHeight: 1.45 }}>{card.description}</p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openFilePicker(card.kind)}
                      style={{ marginTop: 4, alignSelf: "flex-start" }}
                    >
                      {busy && selectedKind === card.kind ? "Working…" : "Choose file…"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p style={{ margin: "20px 0 0", fontSize: 12, color: "var(--ink-500)", lineHeight: 1.5 }}>
            Accepted: PDF, Word (.doc, .docx), up to 25 MB. AI prefill requires a configured Gemini, Anthropic, or OpenAI
            key on the server. After prefill, you'll land on the form with fields highlighted — review every one,
            then download the official PDF or Excel voucher before submitting.
          </p>
        </Card>
      </div>
    </AdminPortalShell>
  );
}
