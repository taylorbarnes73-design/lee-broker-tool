import nodemailer from "nodemailer";
import { ENV } from "../_core/env";

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

  const subject = "Your Lee Broker Tool account";
  const text = [
    "An administrator created an account for you on the Lee Broker Tool.",
    "",
    `Username: ${params.username}`,
    `Temporary password: ${params.tempPassword}`,
    "",
    `Sign in: ${params.loginUrl}`,
    "",
    "Change your password after first sign-in if prompted.",
    "",
    "— Lee & Associates Newport Beach",
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
