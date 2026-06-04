import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { submissions } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { getSetting } from "../settings/getSetting";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In progress",
  approved: "Complete",
  rejected: "Rejected",
  closed: "Closed",
  cancelled: "Cancelled",
};

function formatStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function isSmtpConfigured(): boolean {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}

async function sendPlainEmail(params: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn("[submissionNotifications] SMTP not configured; skipping email to", params.to);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      requireTLS: !ENV.smtpSecure,
      auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
    });

    await transporter.sendMail({
      from: ENV.smtpFrom,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    return true;
  } catch (error) {
    console.warn("[submissionNotifications] Failed to send email:", error);
    return false;
  }
}

function settingEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function portalSubmissionPath(submissionId: number): string {
  return `/portal/submissions/${submissionId}`;
}

async function loadSubmissionRow(submissionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Notifies the submitting broker when an admin changes workflow status.
 * Best-effort: never throws; logs and returns when SMTP or settings block delivery.
 */
export async function maybeNotifySubmissionStatusChange(params: {
  submissionId: number;
  previousStatus: string;
  nextStatus: string;
}): Promise<void> {
  if (params.previousStatus === params.nextStatus) return;

  try {
    const enabled = await getSetting("notifications.email_on_status_change");
    if (!settingEnabled(enabled)) return;

    const row = await loadSubmissionRow(params.submissionId);
    if (!row) return;

    const brokerEmail = (row.submittedByEmail ?? "").trim();
    if (!brokerEmail.includes("@")) return;

    const companyName = String(await getSetting("branding.company_name"));
    const reference = row.reference?.trim() || `Submission #${row.id}`;
    const portalPath = portalSubmissionPath(row.id);
    const appOrigin = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
    const trackUrl = appOrigin ? `${appOrigin}${portalPath}` : portalPath;

    const subject = `[${companyName}] Submission update — ${reference}`;
    const text = [
      "Your submission status was updated.",
      "",
      `Reference: ${reference}`,
      `Type: ${row.formType}`,
      `Previous status: ${formatStatusLabel(params.previousStatus)}`,
      `New status: ${formatStatusLabel(params.nextStatus)}`,
      "",
      `Track progress in the broker portal: ${trackUrl}`,
      "",
      companyName,
    ].join("\n");

    await sendPlainEmail({ to: brokerEmail, subject, text });
  } catch (error) {
    console.warn("[submissionNotifications] Status change notification failed:", error);
  }
}

/**
 * Confirms receipt when a submission lands in the queue (send-to-admin, REST create, etc.).
 */
export async function maybeNotifySubmissionReceived(submissionId: number): Promise<void> {
  try {
    const enabled = await getSetting("notifications.email_on_submission");
    if (!settingEnabled(enabled)) return;

    const row = await loadSubmissionRow(submissionId);
    if (!row) return;

    const brokerEmail = (row.submittedByEmail ?? "").trim();
    if (!brokerEmail.includes("@")) return;

    const companyName = String(await getSetting("branding.company_name"));
    const reference = row.reference?.trim() || `Submission #${row.id}`;
    const portalPath = portalSubmissionPath(row.id);
    const appOrigin = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
    const trackUrl = appOrigin ? `${appOrigin}${portalPath}` : portalPath;

    const subject = `[${companyName}] Submission received — ${reference}`;
    const text = [
      "Your submission was added to the admin queue.",
      "",
      `Reference: ${reference}`,
      `Type: ${row.formType}`,
      `Status: ${formatStatusLabel(row.status)}`,
      "",
      `Track progress in the broker portal: ${trackUrl}`,
      "",
      companyName,
    ].join("\n");

    await sendPlainEmail({ to: brokerEmail, subject, text });
  } catch (error) {
    console.warn("[submissionNotifications] Submission received notification failed:", error);
  }
}
