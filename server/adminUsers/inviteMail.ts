import nodemailer from "nodemailer";
import { ENV } from "../_core/env";
import { getSetting } from "../settings/getSetting";

export function isAdminInviteSmtpConfigured(): boolean {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}

export async function sendUserInviteEmail(params: {
  to: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isAdminInviteSmtpConfigured()) {
    return { ok: false, error: "SMTP is not configured." };
  }

  const companyName = String(await getSetting("branding.company_name"));
  const subject = `Your ${companyName} Broker Tool account`;
  const text = [
    `An administrator created an account for you on the ${companyName} Broker Tool.`,
    "",
    `Username: ${params.username}`,
    `Temporary password: ${params.tempPassword}`,
    "",
    `Sign in: ${params.loginUrl}`,
    "",
    "Change your password after first sign-in if prompted.",
    "",
    `— ${companyName}`,
  ].join("\n");

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
      subject,
      text,
    });
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
