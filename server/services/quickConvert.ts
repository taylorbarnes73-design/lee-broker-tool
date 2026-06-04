import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSetting } from "../settings/getSetting";
import { storageGetBytes, isStoredFileReference } from "../storage";
import {
  mimeTypeFromQuickConvertFilename,
  normalizeQuickConvertFilename,
  type QuickConvertKind,
} from "@shared/quickConvert";

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BUNDLED_LETTERHEAD_DOC = path.join(
  SERVICE_DIR,
  "../assets/templates/lanb-letterhead-copy.doc"
);
export const BUNDLED_LETTERHEAD_DOCX = path.join(
  SERVICE_DIR,
  "../assets/templates/lanb-letterhead-copy.docx"
);
export const BUNDLED_LETTERHEAD_PDF_CACHE = path.join(
  SERVICE_DIR,
  "../assets/templates/lanb-letterhead-copy.pdf"
);

const SOFFICE_CANDIDATES = [
  process.env.QUICK_CONVERT_SOFFICE_PATH,
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/usr/local/bin/soffice",
  "/opt/homebrew/bin/soffice",
  "soffice",
].filter(Boolean) as string[];

export type QuickConvertConverterStatus = {
  sofficePath: string | null;
  textutilAvailable: boolean;
  letterheadTemplate: "bundled" | "settings" | "missing";
  letterheadTemplatePath: string | null;
};

export type QuickConvertProcessResult =
  | {
      success: true;
      kind: QuickConvertKind;
      filename: string;
      mimeType: "application/pdf";
      dataBase64: string;
      note?: string;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

function fileExt(filename: string): string {
  const lower = normalizeQuickConvertFilename(filename).toLowerCase();
  if (lower.endsWith(".docx")) return ".docx";
  if (lower.endsWith(".doc")) return ".doc";
  if (lower.endsWith(".pdf")) return ".pdf";
  return path.extname(lower) || "";
}

export function resolveSofficePath(): string | null {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore", timeout: 5_000 });
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function isTextutilAvailable(): boolean {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync("textutil", ["-help"], { stdio: "ignore", timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function resolveLetterheadTemplatePath(): Promise<{
  source: "bundled" | "settings" | "missing";
  path: string | null;
}> {
  const settingUrl = String((await getSetting("branding.letterhead_template_url")) || "").trim();
  if (settingUrl) {
    try {
      if (isStoredFileReference(settingUrl)) {
        const { bytes } = await storageGetBytes(settingUrl);
        const tmp = path.join(os.tmpdir(), `lee-letterhead-setting-${Date.now()}.doc`);
        await fs.writeFile(tmp, bytes);
        return { source: "settings", path: tmp };
      }
      if (/^https?:\/\//i.test(settingUrl)) {
        const resp = await fetch(settingUrl, { signal: AbortSignal.timeout(30_000) });
        if (resp.ok) {
          const tmp = path.join(os.tmpdir(), `lee-letterhead-setting-${Date.now()}.doc`);
          await fs.writeFile(tmp, Buffer.from(await resp.arrayBuffer()));
          return { source: "settings", path: tmp };
        }
      }
    } catch {
      /* fall through to bundled */
    }
  }

  if (await pathExists(BUNDLED_LETTERHEAD_DOC)) {
    return { source: "bundled", path: BUNDLED_LETTERHEAD_DOC };
  }
  if (await pathExists(BUNDLED_LETTERHEAD_DOCX)) {
    return { source: "bundled", path: BUNDLED_LETTERHEAD_DOCX };
  }
  return { source: "missing", path: null };
}

export async function getQuickConvertConverterStatus(): Promise<QuickConvertConverterStatus> {
  const letterhead = await resolveLetterheadTemplatePath();
  return {
    sofficePath: resolveSofficePath(),
    textutilAvailable: isTextutilAvailable(),
    letterheadTemplate: letterhead.source,
    letterheadTemplatePath: letterhead.path,
  };
}

async function writeTempFile(dir: string, filename: string, bytes: Buffer): Promise<string> {
  const safeName = normalizeQuickConvertFilename(filename);
  const target = path.join(dir, safeName);
  await fs.writeFile(target, bytes);
  return target;
}

async function convertOfficeToPdfWithSoffice(
  sofficePath: string,
  inputPath: string,
  outDir: string
): Promise<string> {
  execFileSync(
    sofficePath,
    ["--headless", "--nologo", "--nofirststartwizard", "--convert-to", "pdf", "--outdir", outDir, inputPath],
    { timeout: 120_000, stdio: "ignore" }
  );
  const base = path.basename(inputPath, path.extname(inputPath));
  const pdfPath = path.join(outDir, `${base}.pdf`);
  if (!(await pathExists(pdfPath))) {
    throw new Error("Office conversion did not produce a PDF.");
  }
  return pdfPath;
}

async function convertDocToDocxWithTextutil(inputPath: string, outDir: string): Promise<string> {
  const base = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(outDir, `${base}.docx`);
  execFileSync("textutil", ["-convert", "docx", "-output", outPath, inputPath], {
    timeout: 60_000,
    stdio: "ignore",
  });
  if (!(await pathExists(outPath))) {
    throw new Error("Could not convert Word document to .docx on this server.");
  }
  return outPath;
}

export async function officeBytesToPdf(params: {
  filename: string;
  bytes: Buffer;
}): Promise<Buffer> {
  const ext = fileExt(params.filename);
  if (ext === ".pdf") return params.bytes;

  const sofficePath = resolveSofficePath();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lee-qc-"));
  try {
    const inputPath = await writeTempFile(tmpDir, params.filename, params.bytes);
    let convertInput = inputPath;
    if (
      sofficePath &&
      process.platform === "darwin" &&
      isTextutilAvailable() &&
      ext === ".doc"
    ) {
      convertInput = await convertDocToDocxWithTextutil(inputPath, tmpDir);
    }

    if (sofficePath) {
      const pdfPath = await convertOfficeToPdfWithSoffice(sofficePath, convertInput, tmpDir);
      return Buffer.from(await fs.readFile(pdfPath));
    }

    throw new Error(
      "Word to PDF conversion requires LibreOffice (soffice) on the server. Install LibreOffice or upload a PDF."
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function loadPdfLib() {
  try {
    return await import("pdf-lib");
  } catch {
    throw new Error(
      "PDF merge requires the pdf-lib package. Run pnpm install in the project root."
    );
  }
}

export async function validatePdfBytes(bytes: Buffer): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!bytes.length) {
    return { ok: false, error: "PDF file is empty." };
  }
  const header = bytes.subarray(0, 5).toString("ascii");
  if (!header.startsWith("%PDF")) {
    return { ok: false, error: "File is not a valid PDF (missing %PDF header)." };
  }
  try {
    const { PDFDocument } = await loadPdfLib();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (doc.getPageCount() <= 0) {
      return { ok: false, error: "PDF has no pages." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not read PDF — file may be corrupt or password-protected." };
  }
}

async function loadLetterheadCoverPdf(templatePath: string | null): Promise<Buffer> {
  if (await pathExists(BUNDLED_LETTERHEAD_PDF_CACHE)) {
    return Buffer.from(await fs.readFile(BUNDLED_LETTERHEAD_PDF_CACHE));
  }

  const sofficePath = resolveSofficePath();
  if (templatePath && sofficePath) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lee-qc-lh-"));
    try {
      const pdfPath = await convertOfficeToPdfWithSoffice(sofficePath, templatePath, tmpDir);
      const bytes = Buffer.from(await fs.readFile(pdfPath));
      await fs.writeFile(BUNDLED_LETTERHEAD_PDF_CACHE, bytes).catch(() => undefined);
      return bytes;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  throw new Error(
    "Letterhead cover requires LibreOffice (soffice) to convert the LANB template on first use. Install LibreOffice or pre-generate server/assets/templates/lanb-letterhead-copy.pdf."
  );
}

async function mergeLetterheadWithContentPdf(letterheadPdf: Buffer, contentPdf: Buffer): Promise<Buffer> {
  const { PDFDocument } = await loadPdfLib();
  const cover = await PDFDocument.load(letterheadPdf);
  const body = await PDFDocument.load(contentPdf);
  const merged = await PDFDocument.create();

  const coverPages = cover.getPageCount();
  const coverIndices = coverPages > 0 ? [0] : [];
  if (coverIndices.length) {
    const copied = await merged.copyPages(cover, coverIndices);
    copied.forEach(page => merged.addPage(page));
  }

  const bodyPageCount = body.getPageCount();
  if (bodyPageCount > 0) {
    const bodyIndices = Array.from({ length: bodyPageCount }, (_, i) => i);
    const copiedBody = await merged.copyPages(body, bodyIndices);
    copiedBody.forEach(page => merged.addPage(page));
  }

  if (merged.getPageCount() === 0) {
    throw new Error("No pages available to build letterhead PDF.");
  }

  return Buffer.from(await merged.save());
}

export async function applyLetterheadToDocument(params: {
  filename: string;
  bytes: Buffer;
}): Promise<QuickConvertProcessResult> {
  const letterhead = await resolveLetterheadTemplatePath();
  if (letterhead.source === "missing" || !letterhead.path) {
    return {
      success: false,
      code: "LETTERHEAD_TEMPLATE_MISSING",
      error:
        "LANB letterhead template is not available. Copy LANB Letterhead copy.doc to server/assets/templates/ or set branding.letterhead_template_url in Settings.",
    };
  }

  try {
    const contentPdf = await officeBytesToPdf(params);
    const pdfCheck = await validatePdfBytes(contentPdf);
    if (!pdfCheck.ok) {
      return { success: false, error: pdfCheck.error, code: "INVALID_PDF" };
    }
    const coverPdf = await loadLetterheadCoverPdf(letterhead.path);
    const merged = await mergeLetterheadWithContentPdf(coverPdf, contentPdf);
    const outName = normalizeQuickConvertFilename(params.filename).replace(/\.(docx?|pdf)$/i, "") + "-letterhead.pdf";
    return {
      success: true,
      kind: "letterhead",
      filename: outName,
      mimeType: "application/pdf",
      dataBase64: merged.toString("base64"),
      note:
        "v1 prepends the letterhead cover page, then your document pages. For in-template body merge, install LibreOffice on the server.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function convertDocumentToPdf(params: {
  filename: string;
  bytes: Buffer;
}): Promise<QuickConvertProcessResult> {
  try {
    const ext = fileExt(params.filename);
    let pdfBytes: Buffer;
    if (ext === ".pdf") {
      pdfBytes = params.bytes;
    } else {
      pdfBytes = await officeBytesToPdf(params);
    }
    const pdfCheck = await validatePdfBytes(pdfBytes);
    if (!pdfCheck.ok) {
      return { success: false, error: pdfCheck.error, code: "INVALID_PDF" };
    }
    const outName = normalizeQuickConvertFilename(params.filename).replace(/\.(docx?|pdf)$/i, "") + ".pdf";
    return {
      success: true,
      kind: "to_pdf",
      filename: outName,
      mimeType: "application/pdf",
      dataBase64: pdfBytes.toString("base64"),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, code: "CONVERT_FAILED" };
  }
}

export async function processQuickConvertBinary(params: {
  kind: QuickConvertKind;
  filename: string;
  bytes: Buffer;
}): Promise<QuickConvertProcessResult> {
  if (params.kind === "to_pdf") {
    return convertDocumentToPdf({ filename: params.filename, bytes: params.bytes });
  }
  if (params.kind === "letterhead") {
    return applyLetterheadToDocument({ filename: params.filename, bytes: params.bytes });
  }
  return {
    success: false,
    error: "This conversion runs in the portal workflow step (AI extract + broker tool prefill).",
    code: "USE_PORTAL_WORKFLOW",
  };
}

export async function loadQuickConvertSourceBytes(fileUrl: string): Promise<{ bytes: Buffer; filename: string }> {
  const trimmed = fileUrl.trim();
  if (isStoredFileReference(trimmed)) {
    const { bytes } = await storageGetBytes(trimmed);
    const filename = trimmed.split("/").pop() || "document.pdf";
    return { bytes, filename };
  }
  if (trimmed.startsWith("/api/files/content") || trimmed.startsWith("/local-uploads/")) {
    const { bytes } = await storageGetBytes(trimmed);
    const keyMatch = trimmed.match(/[?&]key=([^&]+)/);
    const decoded = keyMatch ? decodeURIComponent(keyMatch[1]) : trimmed;
    const filename = decoded.split("/").pop() || "document.pdf";
    return { bytes, filename };
  }
  const resp = await fetch(trimmed, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) {
    throw new Error(`Could not fetch file (${resp.status}).`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  const fromUrl = trimmed.split("/").pop()?.split("?")[0] || "document.pdf";
  return { bytes, filename: fromUrl };
}

export function mimeTypeForQuickConvertOutput(filename: string): string {
  return mimeTypeFromQuickConvertFilename(filename);
}
