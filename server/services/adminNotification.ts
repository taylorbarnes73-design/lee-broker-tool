/**
 * Admin Notification Service
 *
 * Sends an email notification to the admin (tbarnes@lee-associates.com)
 * whenever a new submission is recorded in the admin queue.
 */
import { execSync } from "child_process";

const ADMIN_NOTIFY_EMAIL = "tbarnes@lee-associates.com";

export interface SubmissionNotificationParams {
  formType: string;
  brokerName?: string | null;
  propertyAddress?: string | null;
  submittedByEmail?: string | null;
  submissionId?: number | null;
  notes?: string | null;
}

/**
 * Send a notification email to the admin when a new submission arrives.
 * This is fire-and-forget — failures are logged but do not block the submission flow.
 */
export function notifyAdminOfSubmission(params: SubmissionNotificationParams): void {
  try {
    const formLabel = formatFormType(params.formType);
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = `[New Submission] ${formLabel}${params.propertyAddress ? ` — ${params.propertyAddress}` : ""}`;

    const bodyLines = [
      `A new ${formLabel} has been submitted to the admin queue.`,
      "",
      `Form Type: ${formLabel}`,
      `Submitted By: ${params.brokerName || "Unknown"}`,
      params.submittedByEmail ? `Broker Email: ${params.submittedByEmail}` : "",
      params.propertyAddress ? `Property: ${params.propertyAddress}` : "",
      params.submissionId ? `Submission ID: #${params.submissionId}` : "",
      `Time: ${timestamp}`,
      params.notes ? `\nNotes: ${params.notes}` : "",
      "",
      "—",
      "View and manage this submission in the Admin Portal.",
    ].filter(Boolean).join("\n");

    const message: Record<string, unknown> = {
      to: [ADMIN_NOTIFY_EMAIL],
      cc: [],
      subject,
      content: bodyLines,
    };

    const input = JSON.stringify({ messages: [message] });
    const escaped = input.replace(/'/g, "'\\''");

    execSync(`mcp-cli tool call outlook_send_messages --server outlook-mail --input '${escaped}'`, {
      timeout: 15_000,
      stdio: "pipe",
    });
  } catch (error: unknown) {
    // Fire-and-forget: log the error but don't throw
    console.error(
      "[adminNotification] Failed to send notification email:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function formatFormType(formType: string): string {
  const labels: Record<string, string> = {
    sign: "Sign Request",
    listing: "Listing Entry",
    voucher: "Commission Voucher",
    contract: "Contract Data Sheet",
    comp: "Comp Submission",
  };
  return labels[formType] || formType.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
