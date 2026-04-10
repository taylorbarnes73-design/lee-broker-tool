import { z } from "zod/v4";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { execSync } from "child_process";

// ─── Field schema shared by listing and voucher ───────────────────────────────

const fieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const sectionSchema = z.object({
  title: z.string(),
  fields: z.array(fieldSchema),
});

const sendToAdminInput = z.object({
  formType: z.enum(["listing", "voucher"]),
  brokerName: z.string().optional(),
  propertyAddress: z.string().optional(),
  sections: z.array(sectionSchema),
  /** Sender's email — used for CC */
  senderEmail: z.string().optional(),
});

// ─── Email body formatter ─────────────────────────────────────────────────────

function buildEmailBody(
  formType: "listing" | "voucher",
  brokerName: string,
  propertyAddress: string,
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>
): string {
  const formLabel = formType === "listing" ? "Listing Entry" : "Commission Voucher";
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  });

  const sectionLines = sections
    .filter(s => s.fields.some(f => f.value.trim()))
    .map(section => {
      const rows = section.fields
        .filter(f => f.value.trim())
        .map(f => `  ${f.label}: ${f.value}`)
        .join("\n");
      return `\n--- ${section.title} ---\n${rows}`;
    })
    .join("\n");

  return [
    `Lee & Associates Newport Beach — ${formLabel} Submission`,
    `Submitted: ${now}`,
    brokerName ? `Broker: ${brokerName}` : "",
    propertyAddress ? `Property: ${propertyAddress}` : "",
    "",
    "=" .repeat(60),
    sectionLines,
    "",
    "=" .repeat(60),
    "",
    "This email was generated automatically by the Lee & Associates Broker Submission Tool.",
    "Taylor Barnes | Lee & Associates Newport Beach",
  ]
    .filter(line => line !== undefined)
    .join("\n");
}

// ─── Send via Outlook MCP ─────────────────────────────────────────────────────

function sendViaOutlookMcp(params: {
  to: string[];
  cc: string[];
  subject: string;
  content: string;
}): { success: boolean; error?: string } {
  try {
    const input = JSON.stringify({ messages: [params] });
    const escaped = input.replace(/'/g, "'\\''");
    execSync(`manus-mcp-cli tool call outlook_send_messages --server outlook-mail --input '${escaped}'`, {
      timeout: 30_000,
      stdio: "pipe",
    });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const emailRouter = router({
  /**
   * Send a form submission to the office admin via Outlook.
   * The caller passes structured sections; this procedure formats and sends.
   */
  sendToAdmin: publicProcedure
    .input(sendToAdminInput)
    .mutation(async ({ input }) => {
      const { formType, brokerName = "", propertyAddress = "", sections, senderEmail } = input;

      const adminEmail = ENV.adminEmail;
      if (!adminEmail) {
        return { success: false, error: "Admin email not configured. Please set ADMIN_EMAIL in environment variables." };
      }

      const formLabel = formType === "listing" ? "Listing Entry" : "Commission Voucher";
      const addressPart = propertyAddress ? ` — ${propertyAddress}` : "";
      const subject = `[Lee & Associates] ${formLabel} Submission${addressPart}`;

      const content = buildEmailBody(formType, brokerName, propertyAddress, sections);

      const to = [adminEmail];
      const cc: string[] = senderEmail ? [senderEmail] : [];

      const result = sendViaOutlookMcp({ to, cc, subject, content });

      return result;
    }),
});
