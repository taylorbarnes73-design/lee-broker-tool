import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a repo-bundled asset across dev (tsx), production bundle (dist/index.js),
 * and Docker (/app/assets/templates from Dockerfile COPY).
 */
export function resolveBundledAssetPath(relativePath: string): string | null {
  const normalized = relativePath.replace(/^\/+/, "");
  const candidates = [
    path.join(RUNTIME_DIR, "../assets", normalized),
    path.join(process.cwd(), "assets", normalized),
    path.join(process.cwd(), "server/assets", normalized),
    path.join(process.cwd(), "dist/public", normalized),
    path.join(process.cwd(), "client/public", normalized),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function requireBundledAssetPath(relativePath: string): string {
  const found = resolveBundledAssetPath(relativePath);
  if (!found) {
    throw new Error(`Bundled asset not found: ${relativePath}`);
  }
  return found;
}

export function resolveCommissionVoucherTemplatePath(): string | null {
  return resolveBundledAssetPath("templates/commission-voucher-template.xlsm");
}

export function requireCommissionVoucherTemplatePath(): string {
  const found = resolveCommissionVoucherTemplatePath();
  if (!found) {
    throw new Error("Commission voucher Excel template not found");
  }
  return found;
}
