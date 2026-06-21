import { buildSectionedPdf, type GeneratedPdf, type PdfSection } from "./formPdf";

/**
 * Client-side Sign Request PDF generator. Thin wrapper over the shared
 * sectioned-PDF builder.
 *
 * Note: the *vendor-facing* PDF (with the assigned PO #) is regenerated
 * admin-side from the submission's formData during the Cimarron flow. This
 * document is the broker-facing record archived with the submission.
 */

export type SignPdfSection = PdfSection;
export type { GeneratedPdf };

export type SignPdfInput = {
  sections: SignPdfSection[];
  agents: Array<{ name: string; pct: string }>;
  propertyAddress: string;
};

export async function buildSignRequestPdf(input: SignPdfInput): Promise<GeneratedPdf> {
  const agents = input.agents.filter(a => a.name.trim() || a.pct.trim());
  return buildSectionedPdf({
    title: "SIGN REQUEST",
    sections: input.sections,
    table: agents.length
      ? {
          title: "Participating Agents",
          columns: ["Name", "Shared Expense %"],
          rows: agents.map(a => [a.name, a.pct]),
        }
      : undefined,
    propertyAddress: input.propertyAddress,
    filenamePrefix: "Sign_Request",
  });
}
