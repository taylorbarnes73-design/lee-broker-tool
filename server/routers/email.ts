import { execFileSync } from "child_process";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { submissions, uploads } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storageGetBytes, storagePut } from "../storage";
import { eq } from "drizzle-orm";
import { getSetting } from "../settings/getSetting";
import { notifyAdminOfSubmission } from "../services/adminNotification";

const fieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const sectionSchema = z.object({
  title: z.string(),
  fields: z.array(fieldSchema),
});

// Max base64 length for an attachment. Base64 inflates bytes ~33%, so this
// caps the decoded payload near the documented 25 MB file limit.
const MAX_ATTACHMENT_BASE64_LEN = 35 * 1024 * 1024;

const pdfAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf").default("application/pdf"),
  base64Data: z.string().min(1).max(MAX_ATTACHMENT_BASE64_LEN),
});

const generatedFileSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  base64Data: z.string().min(1).max(MAX_ATTACHMENT_BASE64_LEN),
});

const supportingFileUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(value => {
    if (/^https?:\/\//i.test(value)) {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    return value.startsWith("/api/files/content?key=") || value.startsWith("/local-uploads/");
  }, "Supporting file URL must be an absolute HTTP(S) URL or an app file URL.");

const supportingFileSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  url: supportingFileUrlSchema,
  fileKey: z.string().trim().min(1).max(512),
  category: z.string().trim().max(128).optional(),
  label: z.string().trim().max(255).optional(),
});

const sendToAdminInput = z.object({
  formType: z.enum(["listing", "voucher", "sign", "admin-request"]),
  deliveryMode: z.enum(["server", "mail-client"]).optional(),
  brokerName: z.string().optional(),
  propertyAddress: z.string().optional(),
  sections: z.array(sectionSchema),
  senderEmail: z.string().email().optional(),
  pdfAttachment: pdfAttachmentSchema.optional(),
  excelAttachment: generatedFileSchema.optional(),
  supportingFiles: z.array(supportingFileSchema).optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});

type FormType = z.infer<typeof sendToAdminInput>["formType"];

type ArchivedSubmissionFile = {
  filename: string;
  mimeType: string;
  base64Data: string;
  fileKey: string;
  url: string;
  fileSize: number;
  category: string;
};

type DeliveryResult = {
  success: boolean;
  error?: string;
  deliveryMethod?: "smtp" | "outlook-mcp" | "outlook-mcp-link" | "mail-client";
  attachmentIncluded?: boolean;
};

type RecordedSubmission = {
  id: number | null;
  status: string;
};

function formLabelFor(formType: FormType): string {
  return formType === "listing"
    ? "Listing Entry"
    : formType === "sign"
      ? "Sign Request"
      : formType === "admin-request"
        ? "Admin Request"
        : "Commission Voucher";
}

function sanitizeFileName(filename: string, fallbackExtension?: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe.includes(".")) return safe;
  if (fallbackExtension) return `${safe}.${fallbackExtension.replace(/^\./, "")}`;
  return safe;
}

async function buildEmailBody(params: {
  formType: FormType;
  brokerName: string;
  propertyAddress: string;
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  archivedPdfUrl?: string;
  archivedPdfName?: string;
  excelAttachmentUrl?: string;
  excelAttachmentName?: string;
  supportingFiles?: Array<z.infer<typeof supportingFileSchema>>;
}): Promise<string> {
  const {
    formType,
    brokerName,
    propertyAddress,
    sections,
    archivedPdfUrl,
    archivedPdfName,
    excelAttachmentUrl,
    excelAttachmentName,
    supportingFiles = [],
  } = params;
  const companyName = String(await getSetting("branding.company_name"));
  const supportEmail = String(await getSetting("branding.support_email"));
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  });

  const sectionLines = sections
    .filter(section => section.fields.some(field => field.value.trim()))
    .map(section => {
      const rows = section.fields
        .filter(field => field.value.trim())
        .map(field => `  ${field.label}: ${field.value}`)
        .join("\n");
      return `\n--- ${section.title} ---\n${rows}`;
    })
    .join("\n");
  const supportingFileLines = supportingFiles
    .filter(file => file.url.trim())
    .map(file => `  ${file.label || file.filename}: ${file.url}`)
    .join("\n");

  return [
    `${companyName} - ${formLabelFor(formType)} Submission`,
    `Submitted: ${now}`,
    brokerName ? `Broker: ${brokerName}` : "",
    propertyAddress ? `Property: ${propertyAddress}` : "",
    archivedPdfUrl ? `Archived PDF: ${archivedPdfName || "submission.pdf"} - ${archivedPdfUrl}` : "",
    excelAttachmentUrl ? `Generated Excel Voucher: ${excelAttachmentName || "voucher.xlsm"} - ${excelAttachmentUrl}` : "",
    supportingFileLines ? `Supporting Documents:\n${supportingFileLines}` : "",
    "",
    "=".repeat(60),
    sectionLines,
    "",
    "=".repeat(60),
    "",
    "This email was generated automatically by the Broker Submission Tool.",
    `${supportEmail} | ${companyName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function isSmtpConfigured(): boolean {
  return Boolean(ENV.smtpHost && ENV.smtpFrom);
}

async function sendViaSmtp(params: {
  to: string[];
  cc: string[];
  subject: string;
  content: string;
  attachments?: ArchivedSubmissionFile[];
}): Promise<DeliveryResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpSecure,
      requireTLS: !ENV.smtpSecure, // enforce STARTTLS on port 587 when not using implicit TLS
      auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
    });

    await transporter.sendMail({
      from: ENV.smtpFrom,
      to: params.to.join(", "),
      cc: params.cc.length ? params.cc.join(", ") : undefined,
      replyTo: params.cc[0] || undefined,
      subject: params.subject,
      text: params.content,
      attachments: params.attachments?.length
        ? params.attachments.map(file => ({
            filename: file.filename,
            content: Buffer.from(file.base64Data, "base64"),
            contentType: file.mimeType,
          }))
        : undefined,
    });

    return {
      success: true,
      deliveryMethod: "smtp",
      attachmentIncluded: Boolean(params.attachments?.length),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sendViaOutlookMcp(params: {
  to: string[];
  cc: string[];
  subject: string;
  content: string;
  attachments?: ArchivedSubmissionFile[];
  includeAttachment?: boolean;
}): DeliveryResult {
  try {
    const message: Record<string, unknown> = {
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      content: params.content,
    };

    if (params.includeAttachment && params.attachments?.length) {
      message.attachments = params.attachments.map(file => ({
        filename: file.filename,
        name: file.filename,
        contentType: file.mimeType,
        mimeType: file.mimeType,
        contentBytes: file.base64Data,
      }));
    }

    const input = JSON.stringify({ messages: [message] });
    execFileSync(
      "mcp-cli",
      ["tool", "call", "outlook_send_messages", "--server", "outlook-mail", "--input", input],
      { timeout: 30_000, stdio: "pipe" }
    );

    return {
      success: true,
      deliveryMethod: params.includeAttachment && params.attachments?.length ? "outlook-mcp" : "outlook-mcp-link",
      attachmentIncluded: Boolean(params.includeAttachment && params.attachments?.length),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function deliverSubmissionEmail(params: {
  to: string[];
  cc: string[];
  subject: string;
  content: string;
  attachments?: ArchivedSubmissionFile[];
}): Promise<DeliveryResult> {
  if (isSmtpConfigured()) {
    const smtpResult = await sendViaSmtp(params);
    if (smtpResult.success) {
      return smtpResult;
    }
  }

  const mcpWithAttachment = sendViaOutlookMcp({
    ...params,
    includeAttachment: Boolean(params.attachments?.length),
  });
  if (mcpWithAttachment.success) {
    return mcpWithAttachment;
  }

  if (params.attachments?.length) {
    const fallbackWithoutAttachment = sendViaOutlookMcp({
      ...params,
      includeAttachment: false,
    });
    if (fallbackWithoutAttachment.success) {
      return fallbackWithoutAttachment;
    }
  }

  return mcpWithAttachment;
}

async function archiveGeneratedFile(params: {
  formType: FormType;
  propertyAddress: string;
  attachment: z.infer<typeof generatedFileSchema>;
  category: string;
  brokerName?: string;
  senderEmail?: string;
  uploaderOpenId?: string | null;
}): Promise<ArchivedSubmissionFile> {
  const safeFilename = sanitizeFileName(params.attachment.filename);
  const buffer = Buffer.from(params.attachment.base64Data, "base64");

  if (!buffer.length) {
    throw new Error(`Generated ${params.category.replace(/_/g, " ")} is empty.`);
  }

  const fileKey = `broker-docs/submissions/${params.formType}/${new Date().toISOString().slice(0, 10)}/${nanoid(10)}-${safeFilename}`;
  const { url } = await storagePut(fileKey, buffer, params.attachment.mimeType);

  const db = await getDb();
  if (db) {
    await db.insert(uploads).values({
      fileKey,
      url,
      filename: safeFilename,
      mimeType: params.attachment.mimeType,
      fileSize: buffer.length,
      category: params.category,
      reference: params.propertyAddress || null,
      uploaderName: params.brokerName || params.senderEmail || null,
      uploaderOpenId: params.uploaderOpenId ?? null,
    });
  }

  return {
    filename: safeFilename,
    mimeType: params.attachment.mimeType,
    base64Data: params.attachment.base64Data,
    fileKey,
    url,
    fileSize: buffer.length,
    category: params.category,
  };
}

async function recordSubmissionRequest(params: {
  formType: FormType;
  brokerName: string;
  propertyAddress: string;
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  senderEmail?: string;
  archivedPdf?: ArchivedSubmissionFile;
  excelFile?: ArchivedSubmissionFile;
  supportingFiles?: Array<z.infer<typeof supportingFileSchema>>;
  uploaderOpenId?: string | null;
  deliveryMethod?: string;
  deliveryError?: string;
  formData?: Record<string, unknown>;
}): Promise<RecordedSubmission> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable. The request could not be recorded for the admin portal.");
  }

  const status = "pending";
  const [result] = await db.insert(submissions).values({
    formType: params.formType,
    status,
    reference: params.propertyAddress || null,
    submittedBy: params.brokerName || params.senderEmail || null,
    submittedByOpenId: params.uploaderOpenId ?? null,
    submittedByEmail: params.senderEmail ?? null,
    pdfFileKey: params.archivedPdf?.fileKey ?? null,
    pdfUrl: params.archivedPdf?.url ?? null,
    payload: JSON.stringify({
      brokerName: params.brokerName,
      senderEmail: params.senderEmail ?? "",
      propertyAddress: params.propertyAddress,
      sections: params.sections,
      formData: params.formData ?? null,
      archivedFile: params.archivedPdf
        ? {
            fileKey: params.archivedPdf.fileKey,
            url: params.archivedPdf.url,
            filename: params.archivedPdf.filename,
            fileSize: params.archivedPdf.fileSize,
            mimeType: params.archivedPdf.mimeType,
            category: params.archivedPdf.category,
          }
        : null,
      excelFile: params.excelFile
        ? {
            fileKey: params.excelFile.fileKey,
            url: params.excelFile.url,
            filename: params.excelFile.filename,
            fileSize: params.excelFile.fileSize,
            mimeType: params.excelFile.mimeType,
            category: params.excelFile.category,
          }
        : null,
      supportingFiles: params.supportingFiles ?? [],
      deliveryMethod: params.deliveryMethod ?? "",
      deliveryError: params.deliveryError ?? "",
    }),
  });

  const submissionId = (result as { insertId?: number }).insertId ?? null;

  // Fire-and-forget notification to admin
  notifyAdminOfSubmission({
    formType: params.formType,
    brokerName: params.brokerName,
    propertyAddress: params.propertyAddress,
    submittedByEmail: params.senderEmail,
    submissionId,
  });

  return {
    id: submissionId,
    status,
  };
}

async function updateRecordedSubmissionDelivery(params: {
  submissionId: number | null;
  deliveryMethod?: string;
  deliveryError?: string;
}): Promise<void> {
  if (!params.submissionId) return;

  try {
    const db = await getDb();
    if (!db) return;

    const [row] = await db
      .select({ payload: submissions.payload })
      .from(submissions)
      .where(eq(submissions.id, params.submissionId))
      .limit(1);

    if (!row) return;

    let payload: Record<string, unknown> = {};
    try {
      payload = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      payload = {};
    }

    await db
      .update(submissions)
      .set({
        payload: JSON.stringify({
          ...payload,
          deliveryMethod: params.deliveryMethod ?? "",
          deliveryError: params.deliveryError ?? "",
        }),
      })
      .where(eq(submissions.id, params.submissionId));
  } catch (error) {
    console.error("[email.sendToAdmin] Failed to update submission delivery metadata:", error);
  }
}

export const emailRouter = router({
  sendToAdmin: protectedProcedure
    .input(sendToAdminInput)
    .mutation(async ({ input, ctx }) => {
      const {
        formType,
        deliveryMode = "server",
        brokerName = "",
        propertyAddress = "",
        sections,
        senderEmail,
        pdfAttachment,
        excelAttachment,
        supportingFiles = [],
        formData,
      } = input;
      const adminEmail = ENV.adminEmail;

      if (deliveryMode === "server" && !adminEmail) {
        return {
          success: false,
          error: "Admin email not configured. Please set ADMIN_EMAIL in environment variables.",
        };
      }

      let archivedPdf: ArchivedSubmissionFile | undefined;
      if (pdfAttachment) {
        try {
          archivedPdf = await archiveGeneratedFile({
            formType,
            propertyAddress,
            attachment: pdfAttachment,
            category: "submission_pdf",
            brokerName: brokerName || ctx.user?.name || undefined,
            senderEmail,
            uploaderOpenId: ctx.user?.openId ?? null,
          });
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      let archivedExcel: ArchivedSubmissionFile | undefined;
      if (excelAttachment) {
        try {
          archivedExcel = await archiveGeneratedFile({
            formType,
            propertyAddress,
            attachment: excelAttachment,
            category: "voucher_excel",
            brokerName: brokerName || ctx.user?.name || undefined,
            senderEmail,
            uploaderOpenId: ctx.user?.openId ?? null,
          });
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      const generatedAttachments = [archivedPdf, archivedExcel].filter(Boolean) as ArchivedSubmissionFile[];

      const addressPart = propertyAddress ? ` - ${propertyAddress}` : "";
      const companyName = String(await getSetting("branding.company_name"));
      const subject = `[${companyName}] ${formLabelFor(formType)} Submission${addressPart}`;
      const content = await buildEmailBody({
        formType,
        brokerName,
        propertyAddress,
        sections,
        archivedPdfUrl: archivedPdf?.url,
        archivedPdfName: archivedPdf?.filename,
        excelAttachmentUrl: archivedExcel?.url,
        excelAttachmentName: archivedExcel?.filename,
        supportingFiles,
      });

      // For sign requests, we record/queue the submission for the admin portal.
      // The admin later sends to Cimarron after approval + PO assignment.
      // When the broker's email client handles delivery, skip server-side SMTP/MCP
      // so the admin does not receive a duplicate email.
      const queueOnlyDelivery =
        deliveryMode === "mail-client"
          ? {
              success: true,
              deliveryMethod: "mail-client" as const,
              attachmentIncluded: false,
              error: undefined as string | undefined,
            }
          : formType === "sign"
          ? {
              success: true,
              deliveryMethod: "queue-only" as const,
              // Queue-only: no email is sent, so no attachment is included in delivery.
              attachmentIncluded: false,
              error: undefined as string | undefined,
            }
          : null;

      let recordedSubmission: RecordedSubmission | null = null;
      try {
        recordedSubmission = await recordSubmissionRequest({
          formType,
          brokerName,
          propertyAddress,
          sections,
          senderEmail,
          archivedPdf,
          excelFile: archivedExcel,
          supportingFiles,
          uploaderOpenId: ctx.user?.openId ?? null,
          deliveryMethod: queueOnlyDelivery?.deliveryMethod,
          deliveryError: queueOnlyDelivery?.error,
          formData,
        });
      } catch (error: unknown) {
        return {
          // If we can't record the submission at all, that IS a real failure.
          success: false,
          error: error instanceof Error ? error.message : String(error),
          archivedFile: archivedPdf
            ? {
                fileKey: archivedPdf.fileKey,
                url: archivedPdf.url,
                filename: archivedPdf.filename,
                fileSize: archivedPdf.fileSize,
                mimeType: archivedPdf.mimeType,
                category: archivedPdf.category,
              }
            : null,
          excelFile: archivedExcel
            ? {
                fileKey: archivedExcel.fileKey,
                url: archivedExcel.url,
                filename: archivedExcel.filename,
                fileSize: archivedExcel.fileSize,
                mimeType: archivedExcel.mimeType,
                category: archivedExcel.category,
              }
            : null,
        };
      }

      // For listing/voucher/admin-request, queue first, then try email delivery.
      // The admin portal row is the durable source of truth; email is best-effort.
      const delivery =
        queueOnlyDelivery ??
        (await deliverSubmissionEmail({
          to: [adminEmail],
          cc: senderEmail ? [senderEmail] : [],
          subject,
          content,
          attachments: generatedAttachments,
        }));

      if (!queueOnlyDelivery) {
        await updateRecordedSubmissionDelivery({
          submissionId: recordedSubmission.id,
          deliveryMethod: delivery.deliveryMethod,
          deliveryError: delivery.error,
        });
      }

      // The submission is in the queue. Email delivery is best-effort — a failed email
      // does not mean the submission failed. Surface email status separately so the
      // broker tool can show the right message without blocking the queue entry.
      return {
        success: true,
        emailDelivered: delivery.success,
        emailError: delivery.success ? undefined : delivery.error,
        deliveryMethod: delivery.deliveryMethod,
        attachmentIncluded: delivery.attachmentIncluded,
        submissionId: recordedSubmission?.id ?? null,
        status: recordedSubmission?.status ?? null,
        archivedFile: archivedPdf
          ? {
              fileKey: archivedPdf.fileKey,
              url: archivedPdf.url,
              filename: archivedPdf.filename,
              fileSize: archivedPdf.fileSize,
              mimeType: archivedPdf.mimeType,
              category: archivedPdf.category,
            }
          : null,
        excelFile: archivedExcel
          ? {
              fileKey: archivedExcel.fileKey,
              url: archivedExcel.url,
              filename: archivedExcel.filename,
              fileSize: archivedExcel.fileSize,
              mimeType: archivedExcel.mimeType,
              category: archivedExcel.category,
            }
          : null,
      };
    }),

  sendApprovedSignToCimarron: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        poNumber: z.string().trim().min(1).max(64),
        pdfAttachment: pdfAttachmentSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        return { success: false as const, error: "Admin access required." };
      }
      if (!ENV.cimarronEmail) {
        return {
          success: false as const,
          error: "Cimarron email not configured. Please set CIMARRON_EMAIL in environment variables.",
        };
      }

      const db = await getDb();
      if (!db) return { success: false as const, error: "Database unavailable." };

      const [row] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, input.submissionId))
        .limit(1);

      if (!row) return { success: false as const, error: "Submission not found." };

      const payload = row.payload ? (() => { try { return JSON.parse(row.payload); } catch { return {}; } })() : {};
      const brokerEmail = String(row.submittedByEmail ?? payload?.senderEmail ?? "").trim();
      const reference = String(row.reference ?? payload?.propertyAddress ?? "").trim();

      const archivedPdf: ArchivedSubmissionFile = {
        filename: input.pdfAttachment.filename,
        mimeType: "application/pdf",
        base64Data: input.pdfAttachment.base64Data,
        fileKey: row.pdfFileKey ?? "",
        url: row.pdfUrl ?? "",
        fileSize: Buffer.from(input.pdfAttachment.base64Data, "base64").length,
        category: "submission_pdf",
      };

      const companyName = String(await getSetting("branding.company_name"));
      const supportEmail = String(await getSetting("branding.support_email"));
      const subject = `[${companyName}] Sign Request PO ${input.poNumber}${reference ? ` - ${reference}` : ""}`;
      const content = [
        "Hi Cimarron,",
        "",
        "Please see the attached sign request.",
        "",
        `PO #: ${input.poNumber}`,
        reference ? `Property: ${reference}` : "",
        "",
        "Thank you,",
        ctx.user.name || `${supportEmail} | ${companyName}`,
      ]
        .filter(Boolean)
        .join("\n");

      const delivery = await deliverSubmissionEmail({
        to: [ENV.cimarronEmail],
        cc: brokerEmail ? [brokerEmail] : [],
        subject,
        content,
        attachments: [archivedPdf],
      });

      return {
        success: delivery.success,
        error: delivery.error,
        deliveryMethod: delivery.deliveryMethod,
        attachmentIncluded: delivery.attachmentIncluded,
      };
    }),
});
