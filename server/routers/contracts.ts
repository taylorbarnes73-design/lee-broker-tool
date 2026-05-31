import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM, invokeLLMWithFile, isGeminiDirectAvailable, type Message } from "../_core/llm";
import { execSync } from "child_process";
import { ENV } from "../_core/env";
import { getSetting } from "../settings/getSetting";
import { isStoredFileReference, storageGetBytes } from "../storage";
import { assertCanAccessStoredFile } from "../fileAccess";

// ── Types ──

const redlineSchema = z.object({
  paragraph: z.string(),
  type: z.enum(["strikethrough", "added", "modified"]),
  note: z.string(),
});

const contractDataSchema = z.object({
  contractType: z.string(),
  agreementDate: z.string().optional(),
  party1Name: z.string().optional(),
  party1Entity: z.string().optional(),
  party1Address: z.string().optional(),
  party1Phone: z.string().optional(),
  party1Fax: z.string().optional(),
  agentName: z.string().optional(),
  agentAddress: z.string().optional(),
  agentPhone: z.string().optional(),
  agentFax: z.string().optional(),
  brokerDre: z.string().optional(),
  agentIndividual: z.string().optional(),
  agentTitle: z.string().optional(),
  agentDre: z.string().optional(),
  agentEmail: z.string().optional(),
  propAddress: z.string().optional(),
  propCity: z.string().optional(),
  propState: z.string().optional(),
  propZip: z.string().optional(),
  propCounty: z.string().optional(),
  propDesc: z.string().optional(),
  mlDate: z.string().optional(),
  mlAmendments: z.string().optional(),
  mlLessor: z.string().optional(),
  mlLessee: z.string().optional(),
  termStart: z.string().optional(),
  termEnd: z.string().optional(),
  subleaseTerms: z.string().optional(),
  commType: z.string().optional(),
  commAmount: z.string().optional(),
  arbitration: z.string().optional(),
  additionalProvisions: z.string().optional(),
  sig1Name: z.string().optional(),
  sig1Title: z.string().optional(),
  redlines: z.array(redlineSchema).optional(),
});

// ── Helpers ──

/** Convert ISO date string (YYYY-MM-DD) from natural language date */
function parseToIsoDate(raw: string): string {
  if (!raw) return "";
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {}
  return "";
}

/** Build a formatted AIR CRE Data Sheet as plain text */
async function buildDataSheet(data: z.infer<typeof contractDataSchema>): Promise<string> {
  const companyName = String(await getSetting("branding.company_name"));
  const supportEmail = String(await getSetting("branding.support_email"));
  const line = (label: string, val?: string) =>
    val ? `  ${label}: ${val}` : "";

  const redlineLines = (data.redlines || [])
    .map((r, i) => `  ${i + 1}. Para ${r.paragraph} — ${r.type.toUpperCase()}: ${r.note}`)
    .join("\n");

  return [
    "═".repeat(64),
    `AIR CRE DATA SHEET — ${data.contractType.toUpperCase()}`,
    `Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`,
    "═".repeat(64),
    "",
    "── BASIC PROVISIONS ──",
    line("Agreement Date", data.agreementDate),
    "",
    "── PARTY 1 (Sublessor / Owner / Client) ──",
    line("Name", data.party1Name),
    line("Entity Type", data.party1Entity),
    line("Address", data.party1Address),
    line("Phone", data.party1Phone),
    line("Fax", data.party1Fax),
    "",
    "── AGENT / BROKER ──",
    line("Agent Name", data.agentName),
    line("Agent Address", data.agentAddress),
    line("Agent Phone", data.agentPhone),
    line("Agent Fax", data.agentFax),
    line("Broker DRE #", data.brokerDre),
    line("Agent (Individual)", data.agentIndividual),
    line("Agent Title", data.agentTitle),
    line("Agent DRE #", data.agentDre),
    line("Agent Email", data.agentEmail),
    "",
    "── PROPERTY ──",
    line("Address", data.propAddress),
    line("City", data.propCity),
    line("State", data.propState),
    line("Zip", data.propZip),
    line("County", data.propCounty),
    line("Description", data.propDesc),
    ...(data.mlDate || data.mlLessor ? [
      "",
      "── MASTER LEASE ──",
      line("Master Lease Date", data.mlDate),
      line("Amendment Dates", data.mlAmendments),
      line("Master Lessor", data.mlLessor),
      line("Master Lessee", data.mlLessee),
    ] : []),
    "",
    "── TERM OF AGREEMENT ──",
    line("Commencement", data.termStart),
    line("Expiration", data.termEnd),
    line("Sublease/Lease Terms", data.subleaseTerms),
    "",
    "── COMMISSION ──",
    line("Commission Type", data.commType),
    line("Commission Amount/Rate", data.commAmount),
    "",
    "── ARBITRATION ──",
    line("Arbitration Body", data.arbitration),
    "",
    "── ADDITIONAL PROVISIONS ──",
    line("Additional Provisions", data.additionalProvisions),
    "",
    "── SIGNATORIES ──",
    line("Party 1 Signatory", data.sig1Name),
    line("Party 1 Title", data.sig1Title),
    ...(redlineLines ? [
      "",
      "── REDLINES / MODIFICATIONS TO APPLY IN AIR CRE ──",
      redlineLines,
    ] : []),
    "",
    "═".repeat(64),
    "Enter these values into AIR CRE Contracts at https://www.aircre.com",
    `${supportEmail} | ${companyName}`,
  ]
    .filter((l) => l !== undefined && l !== "  : ")
    .join("\n");
}

// ── Router ──

export const contractsRouter = router({
  /**
   * Extract contract fields and redlines from an uploaded PDF using AI vision.
   */
  extractContract: protectedProcedure
    .input(
        z.object({
          /** URL of the uploaded PDF (S3 signed URL or /local-uploads/ path) */
          pdfUrl: z.string().refine(
            v =>
              /^https?:\/\//i.test(v) ||
              v.startsWith("/local-uploads/") ||
              v.startsWith("/api/files/content") ||
              /^(broker-docs|broker-admin|broker-docusign)\//.test(v),
            {
              message:
                "pdfUrl must be an http(s) URL, local upload path, file proxy URL, or stored file key",
            }
          ),
          contractType: z.string(),
        })
    )
    .mutation(async ({ ctx, input }) => {
      const systemPrompt = `You are an expert real estate contract analyst. You will be given an AIR CRE contract PDF that a broker has filled out in Adobe Acrobat. Your job is to:
1. Extract every filled field value exactly as written.
2. Identify any redlined (struck-through) text and any added/modified text, noting the paragraph number and a brief description.
3. Return a JSON object matching the schema exactly.

For dates, return them in YYYY-MM-DD format if possible, otherwise return the raw text.
For commission, note whether it is a percentage, flat fee, or per schedule.
For arbitration, return "AAA", "JAMS", or "none".
If a field is blank or not applicable, omit it from the response.

Return ONLY valid JSON, no markdown, no explanation.`;

      const userPrompt = `Extract all fields and redlines from this AIR CRE contract PDF. Contract type: ${input.contractType}.

Return JSON with these fields (omit any that are blank):
{
  "contractType": "${input.contractType}",
  "agreementDate": "YYYY-MM-DD or raw text",
  "party1Name": "",
  "party1Entity": "",
  "party1Address": "",
  "party1Phone": "",
  "party1Fax": "",
  "agentName": "",
  "agentAddress": "",
  "agentPhone": "",
  "agentFax": "",
  "brokerDre": "",
  "agentIndividual": "",
  "agentTitle": "",
  "agentDre": "",
  "agentEmail": "",
  "propAddress": "",
  "propCity": "",
  "propState": "",
  "propZip": "",
  "propCounty": "",
  "propDesc": "",
  "mlDate": "YYYY-MM-DD",
  "mlAmendments": "comma-separated dates",
  "mlLessor": "",
  "mlLessee": "",
  "termStart": "YYYY-MM-DD",
  "termEnd": "YYYY-MM-DD",
  "subleaseTerms": "",
  "commType": "percent|schedule|flat",
  "commAmount": "e.g. 6% or $25,000",
  "arbitration": "AAA|JAMS|none",
  "additionalProvisions": "",
  "sig1Name": "",
  "sig1Title": "",
  "redlines": [
    { "paragraph": "4.1(b)", "type": "strikethrough", "note": "Brief description of what was struck through" }
  ]
}`;

      try {
        // Fetch the PDF server-side — use direct FS read for local storage paths
        let pdfBuffer: Buffer;
        if (isStoredFileReference(input.pdfUrl)) {
          const key = await assertCanAccessStoredFile({ user: ctx.user, keyOrUrl: input.pdfUrl });
          const { bytes } = await storageGetBytes(key);
          pdfBuffer = bytes;
        } else {
          const pdfResp = await fetch(input.pdfUrl, { signal: AbortSignal.timeout(30_000) });
          if (!pdfResp.ok) {
            return {
              success: false,
              error: `Could not fetch PDF: ${pdfResp.status} ${pdfResp.statusText}`,
              data: null,
            };
          }
          pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
        }

        let rawJson: string;

        // ── Preferred path: native AI inline PDF (no text extraction) ──
        if (isGeminiDirectAvailable()) {
          try {
            rawJson = await invokeLLMWithFile({
              fileBuffer: pdfBuffer,
              mimeType: "application/pdf",
              systemPrompt: systemPrompt,
              userPrompt: userPrompt,
            });
          } catch (aiErr: unknown) {
            console.warn(
              "[contracts] AI native PDF invocation failed, falling back to text extraction:",
              aiErr instanceof Error ? aiErr.message : String(aiErr)
            );
            rawJson = "";
          }
        } else {
          rawJson = "";
        }

        // ── Fallback path: extract text then call via the regular LLM ──
        if (!rawJson) {
          let pdfText = "";
          try {
            const mod = await import("pdf-parse");
            const parse = (mod as any).default ?? (mod as any);
            const pdfParsed = await parse(pdfBuffer);
            pdfText = (pdfParsed.text || "").replace(/\s+/g, " ").trim().slice(0, 40_000);
          } catch (parseErr: unknown) {
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
            pdfText = `[PDF text extraction failed: ${msg}. Return empty JSON if no data is available.]`;
          }

          const messages: Message[] = [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}\n\nDocument text (extracted from PDF):\n${pdfText}`,
            },
          ];
          const response = await invokeLLM({
            messages,
            response_format: { type: "json_object" },
          });
          const content = response.choices?.[0]?.message?.content;
          rawJson = typeof content === "string" ? content : JSON.stringify(content) || "{}";
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          return { success: false, error: "AI returned invalid JSON", data: null };
        }

        parsed.contractType = input.contractType;

        // Normalize date fields
        const dateFields = ["agreementDate", "mlDate", "termStart", "termEnd"];
        for (const f of dateFields) {
          if (parsed[f]) parsed[f] = parseToIsoDate(String(parsed[f]));
        }

        const validated = contractDataSchema.safeParse(parsed);
        if (!validated.success) {
          return { success: false, error: "AI returned data in an unexpected format", data: null };
        }

        return { success: true, data: validated.data, error: null };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg, data: null };
      }
    }),

  /**
   * Submit a completed contract data sheet to the admin via Outlook MCP.
   */
  submitContractToAdmin: publicProcedure
    .input(
      z.object({
        contractData: contractDataSchema,
        brokerName: z.string().optional(),
        senderEmail: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const adminEmail = ENV.adminEmail;
      if (!adminEmail) {
        return { success: false, error: "Admin email not configured." };
      }

      const { contractData, brokerName, senderEmail, notes } = input;

      // Append notes to additional provisions section of the data sheet
      const dataWithNotes = notes
        ? {
            ...contractData,
            additionalProvisions: [contractData.additionalProvisions, `Admin Notes: ${notes}`]
              .filter(Boolean)
              .join("\n"),
          }
        : contractData;

      const dataSheet = await buildDataSheet(dataWithNotes);
      const contractLabel = contractData.contractType || "Contract";
      const addressPart = [contractData.propAddress, contractData.propCity]
        .filter(Boolean)
        .join(", ");
      const companyName = String(await getSetting("branding.company_name"));
      const subject = `[${companyName}] Contract Intake — ${contractLabel}${addressPart ? ` — ${addressPart}` : ""}`;

      const body = [
        `Contract submitted by: ${brokerName || "Broker"}`,
        `Submitted: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`,
        "",
        dataSheet,
      ].join("\n");

      const to = [adminEmail];
      const cc = senderEmail ? [senderEmail] : [];

      try {
        const mcpInput = JSON.stringify({
          subject,
          body,
          to_recipients: to,
          cc_recipients: cc,
        });
        execSync(
          `mcp-cli tool call outlook_send_messages --server outlook-mail --input '${mcpInput.replace(/'/g, "'\\''")}'`,
          { timeout: 30000 }
        );
        return { success: true, error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `MCP connection failed: ${msg}` };
      }
    }),
});
