/**
 * Admin Notification Service
 *
 * Sends an email notification to the configured admin inbox (ADMIN_EMAIL).
 * whenever a new submission is recorded in the admin queue.
 */
import { execFileSync } from "child_process";
import nodemailer from "nodemailer";
import { ENV } from "../_core/env";
import { getSetting } from "../settings/getSetting";

async function getSubmissionNotifyEmail(formType: string): Promise<string> {
  if (formType === "marketing-request") {
    const fromSettings = String(await getSetting("branding.marketing_email")).trim();
    return fromSettings || ENV.marketingEmail;
  }
  return ENV.adminEmail;
}

function isSmtpConfigured(): boolean {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}

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
  void sendAdminNotification(params);
}

async function sendAdminNotification(params: SubmissionNotificationParams): Promise<void> {
  try {
    const notifyEmail = await getSubmissionNotifyEmail(params.formType);
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

    if (isSmtpConfigured()) {
      const transporter = nodemailer.createTransport({
        host: ENV.smtpHost,
        port: ENV.smtpPort,
        secure: ENV.smtpSecure,
        requireTLS: !ENV.smtpSecure,
        auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
      });

      await transporter.sendMail({
        from: ENV.smtpFrom,
        to: notifyEmail,
        subject,
        text: bodyLines,
      });
      return;
    }

    const message: Record<string, unknown> = {
      to: [notifyEmail],
      cc: [],
      subject,
      content: bodyLines,
    };

    const input = JSON.stringify({ messages: [message] });

    // Pass args as an array (no shell) so broker/property text can't break out
    // of the command line — mirrors the email router's execFileSync usage.
    execFileSync(
      "mcp-cli",
      ["tool", "call", "outlook_send_messages", "--server", "outlook-mail", "--input", input],
      {
        timeout: 15_000,
        stdio: "pipe",
      }
    );
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
    "admin-request": "Admin Request",
    "marketing-request": "Marketing Request",
  };
  return labels[formType] || formType.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
