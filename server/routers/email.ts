import { execSync } from "child_process";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { submissions, uploads } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storageGetBytes, storagePut } from "../storage";
import { eq } from "drizzle-orm";
import { getSetting } from "../settings/getSetting";

const fieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const sectionSchema = z.object({
  title: z.string(),
  fields: z.array(fieldSchema),
});

const pdfAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf").default("application/pdf"),
  base64Data: z.string().min(1),
});

const sendToAdminInput = z.object({
  formType: z.enum(["listing", "voucher", "sign"]),
  brokerName: z.string().optional(),
  propertyAddress: z.string().optional(),
  sections: z.array(sectionSchema),
  senderEmail: z.string().email().optional(),
  pdfAttachment: pdfAttachmentSchema.optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});

type FormType = z.infer<typeof sendToAdminInput>["formType"];

type ArchivedPdf = {
  filename: string;
  mimeType: "application/pdf";
  base64Data: string;
  fileKey: string;
  url: string;
  fileSize: number;
};

type DeliveryResult = {
  success: boolean;
  error?: string;
  deliveryMethod?: "smtp" | "outlook-mcp" | "outlook-mcp-link";
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
      : "Commission Voucher";
}

function sanitizeFileName(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

async function buildEmailBody(params: {
  formType: FormType;
  brokerName: string;
  propertyAddress: string;
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  archivedPdfUrl?: string;
  archivedPdfName?: string;
}): Promise<string> {
  const { formType, brokerName, propertyAddress, sections, archivedPdfUrl, archivedPdfName } = params;
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

  return [
    `${companyName} - ${formLabelFor(formType)} Submission`,
    `Submitted: ${now}`,
    brokerName ? `Broker: ${brokerName}` : "",
    propertyAddress ? `Property: ${propertyAddress}` : "",
    archivedPdfUrl ? `Archived PDF: ${archivedPdfName || "submission.pdf"} - ${archivedPdfUrl}` : "",
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
  archivedPdf?: ArchivedPdf;
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
      attachments: params.archivedPdf
        ? [
            {
              filename: params.archivedPdf.filename,
              content: Buffer.from(params.archivedPdf.base64Data, "base64"),
              contentType: params.archivedPdf.mimeType,
            },
          ]
        : undefined,
    });

    return {
      success: true,
      deliveryMethod: "smtp",
      attachmentIncluded: Boolean(params.archivedPdf),
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
  archivedPdf?: ArchivedPdf;
  includeAttachment?: boolean;
}): DeliveryResult {
  try {
    const message: Record<string, unknown> = {
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      content: params.content,
    };

    if (params.includeAttachment && params.archivedPdf) {
      message.attachments = [
        {
          filename: params.archivedPdf.filename,
          name: params.archivedPdf.filename,
          contentType: params.archivedPdf.mimeType,
          mimeType: params.archivedPdf.mimeType,
          contentBytes: params.archivedPdf.base64Data,
        },
      ];
    }

    const input = JSON.stringify({ messages: [message] });
    const escaped = input.replace(/'/g, "'\\''");
    execSync(`mcp-cli tool call outlook_send_messages --server outlook-mail --input '${escaped}'`, {
      timeout: 30_000,
      stdio: "pipe",
    });

    return {
      success: true,
      deliveryMethod: params.includeAttachment && params.archivedPdf ? "outlook-mcp" : "outlook-mcp-link",
      attachmentIncluded: Boolean(params.includeAttachment && params.archivedPdf),
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
  archivedPdf?: ArchivedPdf;
}): Promise<DeliveryResult> {
  if (isSmtpConfigured()) {
    const smtpResult = await sendViaSmtp(params);
    if (smtpResult.success) {
      return smtpResult;
    }
  }

  const mcpWithAttachment = sendViaOutlookMcp({
    ...params,
    includeAttachment: Boolean(params.archivedPdf),
  });
  if (mcpWithAttachment.success) {
    return mcpWithAttachment;
  }

  if (params.archivedPdf) {
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

async function archivePdf(params: {
  formType: FormType;
  propertyAddress: string;
  pdfAttachment: z.infer<typeof pdfAttachmentSchema>;
  brokerName?: string;
  senderEmail?: string;
  uploaderOpenId?: string | null;
}): Promise<ArchivedPdf> {
  const safeFilename = sanitizeFileName(params.pdfAttachment.filename);
  const buffer = Buffer.from(params.pdfAttachment.base64Data, "base64");

  if (!buffer.length) {
    throw new Error("Generated PDF is empty.");
  }

  const fileKey = `broker-docs/submissions/${params.formType}/${new Date().toISOString().slice(0, 10)}/${nanoid(10)}-${safeFilename}`;
  const { url } = await storagePut(fileKey, buffer, params.pdfAttachment.mimeType);

  const db = await getDb();
  if (db) {
    await db.insert(uploads).values({
      fileKey,
      url,
      filename: safeFilename,
      mimeType: params.pdfAttachment.mimeType,
      fileSize: buffer.length,
      category: "submission_pdf",
      reference: params.propertyAddress || null,
      uploaderName: params.brokerName || params.senderEmail || null,
      uploaderOpenId: params.uploaderOpenId ?? null,
    });
  }

  return {
    filename: safeFilename,
    mimeType: params.pdfAttachment.mimeType,
    base64Data: params.pdfAttachment.base64Data,
    fileKey,
    url,
    fileSize: buffer.length,
  };
}

async function recordSubmissionRequest(params: {
  formType: FormType;
  brokerName: string;
  propertyAddress: string;
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  senderEmail?: string;
  archivedPdf?: ArchivedPdf;
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
          }
        : null,
      deliveryMethod: params.deliveryMethod ?? "",
      deliveryError: params.deliveryError ?? "",
    }),
  });

  return {
    id: (result as { insertId?: number }).insertId ?? null,
    status,
  };
}

export const emailRouter = router({
  sendToAdmin: publicProcedure
    .input(sendToAdminInput)
    .mutation(async ({ input, ctx }) => {
      const { formType, brokerName = "", propertyAddress = "", sections, senderEmail, pdfAttachment, formData } = input;
      const adminEmail = ENV.adminEmail;

      if (!adminEmail) {
        return {
          success: false,
          error: "Admin email not configured. Please set ADMIN_EMAIL in environment variables.",
        };
      }

      let archivedPdf: ArchivedPdf | undefined;
      if (pdfAttachment) {
        try {
          archivedPdf = await archivePdf({
            formType,
            propertyAddress,
            pdfAttachment,
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
      });

      // For sign requests, we record/queue the submission for the admin portal.
      // The admin later sends to Cimarron after approval + PO assignment.
      const delivery =
        formType === "sign"
          ? {
              success: true,
              deliveryMethod: "queue-only" as const,
              // Queue-only: no email is sent, so no attachment is included in delivery.
              attachmentIncluded: false,
              error: undefined as string | undefined,
            }
          : await deliverSubmissionEmail({
              to: [adminEmail],
              cc: senderEmail ? [senderEmail] : [],
              subject,
              content,
              archivedPdf,
            });

      let recordedSubmission: RecordedSubmission | null = null;
      try {
        recordedSubmission = await recordSubmissionRequest({
          formType,
          brokerName,
          propertyAddress,
          sections,
          senderEmail,
          archivedPdf,
          uploaderOpenId: ctx.user?.openId ?? null,
          deliveryMethod: delivery.deliveryMethod,
          deliveryError: delivery.error,
          formData,
        });
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          deliveryMethod: delivery.deliveryMethod,
          attachmentIncluded: delivery.attachmentIncluded,
          archivedFile: archivedPdf
            ? {
                fileKey: archivedPdf.fileKey,
                url: archivedPdf.url,
                filename: archivedPdf.filename,
                fileSize: archivedPdf.fileSize,
              }
            : null,
        };
      }

      return {
        success: delivery.success,
        error: delivery.error,
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

      const archivedPdf: ArchivedPdf = {
        filename: input.pdfAttachment.filename,
        mimeType: "application/pdf",
        base64Data: input.pdfAttachment.base64Data,
        fileKey: row.pdfFileKey ?? "",
        url: row.pdfUrl ?? "",
        fileSize: Buffer.from(input.pdfAttachment.base64Data, "base64").length,
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
        archivedPdf,
      });

      return {
        success: delivery.success,
        error: delivery.error,
        deliveryMethod: delivery.deliveryMethod,
        attachmentIncluded: delivery.attachmentIncluded,
      };
    }),
});
