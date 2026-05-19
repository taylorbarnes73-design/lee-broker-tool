import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import { sendAdminError, sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { writeAuditLog } from "./auth/writeAuditLog";
import { getDb } from "./db";
import { appSettings, emailIngestLog, submissions } from "../drizzle/schema";
import { invalidateSettingsCache } from "./settings/settingsStore";
import { getIngestStatus, runIngestOnce } from "./jobs/ingestBrokerAdminEmails";
import { testGraphConnection } from "./lib/msGraph";
import { parseEmailSubmission, type FormType } from "./lib/parseEmailSubmission";
import { SETTINGS_BY_KEY } from "./settings/settingsSchema";

export const brokerAdminIngestRouter = Router();
brokerAdminIngestRouter.use(requirePlatformAdmin);

function asyncAdmin(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(err => {
      if (err instanceof AdminUserError) {
        sendAdminUserError(res, err);
        return;
      }
      next(err);
    });
  };
}

async function persistTestResult(actorId: string, req: Request, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const testedAt = new Date().toISOString();
  const result = success ? "success" : "failed";
  const defAt = SETTINGS_BY_KEY["integrations.broker_admin_ingest.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.broker_admin_ingest.last_test_result"];
  await db
    .insert(appSettings)
    .values({
      key: "integrations.broker_admin_ingest.last_test_at",
      value: testedAt as any,
      category: "integrations",
      description: defAt.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({ set: { value: testedAt as any, updatedAt: new Date(), updatedBy: actorId } });
  await db
    .insert(appSettings)
    .values({
      key: "integrations.broker_admin_ingest.last_test_result",
      value: result as any,
      category: "integrations",
      description: defRes.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({ set: { value: result as any, updatedAt: new Date(), updatedBy: actorId } });
  invalidateSettingsCache();
  await writeAuditLog(
    actorId,
    "settings.updated",
    "setting",
    "integrations.broker_admin_ingest.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );
}

brokerAdminIngestRouter.post(
  "/test",
  asyncAdmin(async (req, res) => {
    const result = await testGraphConnection();
    await persistTestResult(req.user!.id, req, result.success).catch(() => undefined);
    res.json(result);
  })
);

brokerAdminIngestRouter.post(
  "/run",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const summary = await runIngestOnce();
    await writeAuditLog(
      req.user!.id,
      "broker_admin_ingest.run",
      "system",
      null,
      { imported: summary.imported, skipped: summary.skipped, errors: summary.errors },
      req
    );
    res.json(summary);
  })
);

brokerAdminIngestRouter.get(
  "/status",
  asyncAdmin(async (_req, res) => {
    const status = await getIngestStatus();
    res.json(status);
  })
);

type BackfillRecord = {
  email_id?: string;
  thread_id?: string | null;
  internet_message_id?: string | null;
  from?: string | null;
  to?: string[] | null;
  cc?: string[] | null;
  subject?: string | null;
  date?: string | null;
  body_plain?: string | null;
  summary?: string | null;
  web_link?: string | null;
  attachment_count?: number | null;
  parsed?: {
    form_type?: string | null;
    property_address?: string | null;
    dollar_amounts?: string[] | null;
    contacts?: string[] | null;
  } | null;
};

function reclassifyFormType(subject: string, from: string, fallback: FormType): FormType {
  const s = subject || "";
  const f = (from || "").toLowerCase();
  if (/sign\s*removal|sign\s*order/i.test(s)) return "sign";
  if (/comp\s*request/i.test(s)) return "comp_request";
  if (/activity\s*report/i.test(s)) return "activity_report";
  if (/new\s*voucher|voucher/i.test(s) && f.startsWith("tbarnes")) return "voucher";
  return fallback;
}

brokerAdminIngestRouter.post(
  "/backfillFromBody",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const body = req.body as { records?: unknown; status?: unknown; source?: unknown };
    const records = Array.isArray(body?.records) ? (body.records as BackfillRecord[]) : null;
    if (!records) {
      sendAdminError(res, 400, "BAD_REQUEST", "Expected { records: [...] } in body.");
      return;
    }
    const status = typeof body.status === "string" && body.status.trim() ? body.status.trim() : "pending";
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "email_ingest_backfill";

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ email_id: string; error: string }> = [];
    const log: Array<{ email_id: string; status: string; submission_id?: number; formType?: string; subject?: string }> = [];

    for (const entry of records) {
      const emailId = entry.email_id;
      const subject = (entry.subject ?? "").toString();
      try {
        if (!emailId) {
          errors.push({ email_id: "(none)", error: "missing email_id" });
          continue;
        }

        const existing = await db
          .select({ id: emailIngestLog.id })
          .from(emailIngestLog)
          .where(eq(emailIngestLog.messageId, emailId))
          .limit(1);
        if (existing.length > 0) {
          skipped += 1;
          log.push({ email_id: emailId, status: "skipped_duplicate", subject });
          continue;
        }

        const bodyPlain = entry.body_plain ?? "";
        const fromEmail = (entry.from ?? "").toString();
        const parsed = parseEmailSubmission({
          subject,
          body: bodyPlain,
          from: fromEmail,
          toEmails: (entry.to ?? []).map(s => (s ?? "").toString().toLowerCase()),
          ccEmails: (entry.cc ?? []).map(s => (s ?? "").toString().toLowerCase()),
        });

        const jsonParsedType = (entry.parsed?.form_type ?? null) as FormType | null;
        const fallbackType: FormType =
          jsonParsedType && typeof jsonParsedType === "string" ? jsonParsedType : parsed.formType;
        const formType = reclassifyFormType(subject, fromEmail, fallbackType);

        const jsonDollarAmounts = Array.isArray(entry.parsed?.dollar_amounts)
          ? (entry.parsed!.dollar_amounts as string[])
          : parsed.parsedFields.dollarAmounts;
        const jsonContacts = Array.isArray(entry.parsed?.contacts)
          ? (entry.parsed!.contacts as string[])
          : parsed.parsedFields.contacts;
        const jsonPropertyAddress = entry.parsed?.property_address ?? parsed.parsedFields.propertyAddress;
        const summary = entry.summary ?? parsed.summary;

        const parsedFields = {
          formType,
          propertyAddress: jsonPropertyAddress,
          dollarAmounts: jsonDollarAmounts,
          contacts: jsonContacts,
          summary,
        };

        const reference = jsonPropertyAddress ?? (subject.trim() || null);
        const payload = {
          body: bodyPlain,
          summary,
          parsedFields,
          source: {
            kind: source,
            messageId: emailId,
            threadId: entry.thread_id ?? null,
            internetMessageId: entry.internet_message_id ?? null,
            receivedAt: entry.date ?? null,
            webLink: entry.web_link ?? null,
            from: fromEmail || null,
            to: entry.to ?? [],
            cc: entry.cc ?? [],
            attachmentCount: entry.attachment_count ?? null,
          },
        };

        const [insertResult] = await db.insert(submissions).values({
          formType,
          status,
          payload: JSON.stringify(payload),
          reference: reference ? reference.slice(0, 511) : null,
          submittedBy: fromEmail || null,
          submittedByOpenId: null,
          submittedByEmail: fromEmail || null,
          source,
          sourceEmailMessageId: emailId,
          sourceEmailWebLink: entry.web_link ?? null,
          parsedFields: parsedFields as any,
        });
        const submissionId = (insertResult as any).insertId ?? null;

        await db.insert(emailIngestLog).values({
          messageId: emailId,
          internetMessageId: entry.internet_message_id ?? null,
          threadId: entry.thread_id ?? null,
          receivedAt: entry.date ? new Date(entry.date) : null,
          fromEmail: fromEmail.toLowerCase() || null,
          toEmails: (entry.to ?? []) as any,
          ccEmails: (entry.cc ?? []) as any,
          subject: subject.slice(0, 1023) || null,
          submissionId,
          ingestStatus: "imported",
          errorMessage: null,
        });

        imported += 1;
        log.push({ email_id: emailId, status: "imported", submission_id: submissionId ?? undefined, formType, subject });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ email_id: emailId ?? "(unknown)", error: msg });
        log.push({ email_id: emailId ?? "(unknown)", status: `error: ${msg}`, subject });
      }
    }

    await writeAuditLog(
      req.user!.id,
      "broker_admin_ingest.backfillFromBody",
      "system",
      null,
      { imported, skipped, errors: errors.length, status, source, total: records.length },
      req
    );

    res.json({ imported, skipped, errors, log, total: records.length, status, source });
  })
);
