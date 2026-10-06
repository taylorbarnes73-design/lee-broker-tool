import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { emailIngestLog, kvState, submissions } from "../../drizzle/schema";
import { parseEmailSubmission } from "../lib/parseEmailSubmission";
import {
  loadGraphConfig,
  loadIngestEnabled,
  loadMailboxAddress,
  listSharedMailboxMessages,
  type GraphMessage,
} from "../lib/msGraph";

const LAST_POLL_KEY = "brokerAdminIngest:lastPoll";

/**
 * `submissions.payload` is a MySQL TEXT column (65,535 bytes). A long mailbox
 * thread stringifies past that limit, the insert throws, and the error row is
 * then treated as a finished duplicate — so the message never lands in the
 * queue. Stay under the column size and keep the Outlook link for the rest.
 */
export const EMAIL_INGEST_PAYLOAD_MAX_BYTES = 60_000;

const BODY_TRUNCATION_NOTE =
  "\n\n[Message body truncated to fit the submission record. Open the Outlook link for the full email.]";

export type EmailIngestPayload = {
  body: string;
  summary: string;
  parsedFields: {
    formType: string;
    propertyAddress: string | null;
    dollarAmounts: string[];
    contacts: string[];
    summary: string;
  };
  source: {
    kind: string;
    messageId: string;
    internetMessageId: string | null;
    threadId: string | null;
    receivedAt: string | null;
    webLink: string | null;
    from: string;
    fromName: string;
    to: string[];
    cc: string[];
    hasAttachments: boolean;
  };
};

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sliceChars(value: string, maxChars: number): string {
  const sliced = value.slice(0, Math.max(0, maxChars));
  const last = sliced.charCodeAt(sliced.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) return sliced.slice(0, -1);
  return sliced;
}

function shrinkIngestPayload(payload: EmailIngestPayload): EmailIngestPayload {
  return {
    ...payload,
    summary: payload.summary.slice(0, 500),
    parsedFields: {
      ...payload.parsedFields,
      summary: payload.parsedFields.summary.slice(0, 500),
      contacts: payload.parsedFields.contacts.slice(0, 25),
      dollarAmounts: payload.parsedFields.dollarAmounts.slice(0, 10),
    },
    source: {
      ...payload.source,
      to: payload.source.to.slice(0, 25),
      cc: payload.source.cc.slice(0, 25),
    },
  };
}

function fitPayloadBody(payload: EmailIngestPayload): string {
  let lo = 0;
  let hi = payload.body.length;
  let best = "";
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = JSON.stringify({
      ...payload,
      body: sliceChars(payload.body, mid) + BODY_TRUNCATION_NOTE,
      bodyTruncated: true,
    });
    if (utf8Bytes(candidate) <= EMAIL_INGEST_PAYLOAD_MAX_BYTES) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** JSON for `submissions.payload` that is guaranteed to fit a MySQL TEXT column. */
export function buildEmailIngestPayloadJson(payload: EmailIngestPayload): string {
  const full = JSON.stringify(payload);
  if (utf8Bytes(full) <= EMAIL_INGEST_PAYLOAD_MAX_BYTES) return full;

  const fitted = fitPayloadBody(payload);
  if (fitted) return fitted;

  const reduced = fitPayloadBody(shrinkIngestPayload(payload));
  if (reduced) return reduced;

  throw new Error("Email ingest payload exceeds the submissions.payload column limit.");
}

export type IngestSummary = {
  imported: number;
  skipped: number;
  errors: number;
  lastPoll: string | null;
  errorMessages: string[];
};

type AppDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function plainTextFromBody(message: GraphMessage): string {
  const body = message.body?.content ?? "";
  const isHtml = (message.body?.contentType ?? "").toLowerCase() === "html";
  if (!body) return message.bodyPreview ?? "";
  if (!isHtml) return body;
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function emailsFrom(list: GraphMessage["toRecipients"]): string[] {
  return (list ?? [])
    .map(r => r.emailAddress?.address?.toLowerCase().trim())
    .filter((s): s is string => !!s);
}

async function loadLastPoll(db: AppDb): Promise<Date> {
  const rows = await db.select().from(kvState).where(eq(kvState.key, LAST_POLL_KEY)).limit(1);
  const raw = rows[0]?.value as { iso?: string } | null;
  if (raw && typeof raw === "object" && typeof raw.iso === "string") {
    const d = new Date(raw.iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function saveLastPoll(db: AppDb, iso: string): Promise<void> {
  await db
    .insert(kvState)
    .values({ key: LAST_POLL_KEY, value: { iso } as any, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value: { iso } as any, updatedAt: new Date() } });
}

export type RunIngestOptions = {
  since?: Date | null;
  mailbox?: string;
  sourceLabel?: "email_ingest" | "email_ingest_backfill";
};

export async function runIngestOnce(options: RunIngestOptions = {}): Promise<IngestSummary> {
  const summary: IngestSummary = { imported: 0, skipped: 0, errors: 0, lastPoll: null, errorMessages: [] };

  const db = await getDb();
  if (!db) {
    summary.errors = 1;
    summary.errorMessages.push("Database unavailable.");
    return summary;
  }

  const cfg = await loadGraphConfig();
  if (!cfg) {
    summary.errors = 1;
    summary.errorMessages.push("Graph credentials are not configured. Set Tenant ID, Client ID, and Client Secret in Settings.");
    return summary;
  }
  const mailbox = options.mailbox ?? (await loadMailboxAddress());
  const source = options.sourceLabel ?? "email_ingest";

  const since = options.since ?? (await loadLastPoll(db));
  let messages: GraphMessage[] = [];
  try {
    // Oldest-first: a burst beyond maxResults must not skip over older messages
    // in favor of newer ones, since the watermark below only ever advances forward.
    messages = await listSharedMailboxMessages(cfg, { mailbox, since, top: 50, maxResults: 200, order: "asc" });
  } catch (err) {
    summary.errors += 1;
    summary.errorMessages.push(err instanceof Error ? err.message : String(err));
    return summary;
  }

  // Advance the watermark only through a confirmed-successful prefix of the
  // (oldest-first) batch. Once a message fails, stop advancing so the failed
  // message and everything after it gets retried on the next poll; already
  // successful messages before it are safely re-skipped via the dedup checks.
  let lastGoodReceived: Date | null = null;
  let sawFailure = false;
  for (const message of messages) {
    try {
      const result = await ingestOneMessage(db, message, mailbox, source);
      if (result === "imported") summary.imported += 1;
      else if (result === "skipped_duplicate" || result === "skipped_no_match") summary.skipped += 1;
      if (!sawFailure) {
        const r = message.receivedDateTime ? new Date(message.receivedDateTime) : null;
        if (r && (!lastGoodReceived || r > lastGoodReceived)) lastGoodReceived = r;
      }
    } catch (err) {
      sawFailure = true;
      summary.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      summary.errorMessages.push(`[${message.id}] ${msg}`);
      try {
        await db.insert(emailIngestLog).values({
          messageId: message.id,
          internetMessageId: message.internetMessageId ?? null,
          threadId: message.conversationId ?? null,
          receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null,
          fromEmail: message.from?.emailAddress?.address?.toLowerCase() ?? null,
          toEmails: emailsFrom(message.toRecipients) as any,
          ccEmails: emailsFrom(message.ccRecipients) as any,
          subject: message.subject?.slice(0, 1023) ?? null,
          submissionId: null,
          ingestStatus: "error",
          errorMessage: msg.slice(0, 4000),
        });
      } catch {
        // best-effort logging only
      }
    }
  }

  if (lastGoodReceived) {
    await saveLastPoll(db, lastGoodReceived.toISOString());
    summary.lastPoll = lastGoodReceived.toISOString();
  } else {
    const existing = await loadLastPoll(db);
    summary.lastPoll = existing.toISOString();
  }

  return summary;
}

type IngestOutcome = "imported" | "skipped_duplicate" | "skipped_no_match";

async function ingestOneMessage(
  db: AppDb,
  message: GraphMessage,
  _mailbox: string,
  source: "email_ingest" | "email_ingest_backfill"
): Promise<IngestOutcome> {
  const existing = await db
    .select({ id: emailIngestLog.id })
    .from(emailIngestLog)
    .where(eq(emailIngestLog.messageId, message.id))
    .limit(1);
  if (existing.length > 0) {
    return "skipped_duplicate";
  }
  if (message.internetMessageId) {
    const existingByIm = await db
      .select({ id: emailIngestLog.id })
      .from(emailIngestLog)
      .where(eq(emailIngestLog.internetMessageId, message.internetMessageId))
      .limit(1);
    if (existingByIm.length > 0) {
      await db.insert(emailIngestLog).values({
        messageId: message.id,
        internetMessageId: message.internetMessageId,
        threadId: message.conversationId ?? null,
        receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null,
        fromEmail: message.from?.emailAddress?.address?.toLowerCase() ?? null,
        toEmails: emailsFrom(message.toRecipients) as any,
        ccEmails: emailsFrom(message.ccRecipients) as any,
        subject: message.subject?.slice(0, 1023) ?? null,
        submissionId: null,
        ingestStatus: "skipped_duplicate",
        errorMessage: null,
      });
      return "skipped_duplicate";
    }
  }

  const bodyText = plainTextFromBody(message);
  const fromEmail = message.from?.emailAddress?.address ?? "";
  const fromName = message.from?.emailAddress?.name ?? "";
  const toEmails = emailsFrom(message.toRecipients);
  const ccEmails = emailsFrom(message.ccRecipients);

  const parsed = parseEmailSubmission({
    subject: message.subject ?? "",
    body: bodyText,
    from: fromEmail,
    toEmails,
    ccEmails,
  });

  const reference = parsed.propertyAddress ?? message.subject?.trim() ?? null;
  const payload = {
    body: bodyText,
    summary: parsed.summary,
    parsedFields: parsed.parsedFields,
    source: {
      kind: source,
      messageId: message.id,
      internetMessageId: message.internetMessageId ?? null,
      threadId: message.conversationId ?? null,
      receivedAt: message.receivedDateTime ?? null,
      webLink: message.webLink ?? null,
      from: fromEmail,
      fromName,
      to: toEmails,
      cc: ccEmails,
      hasAttachments: Boolean(message.hasAttachments),
    },
  };

  const [insertResult] = await db.insert(submissions).values({
    formType: parsed.formType,
    status: "pending",
    payload: buildEmailIngestPayloadJson(payload),
    reference: reference ? reference.slice(0, 511) : null,
    submittedBy: fromName || fromEmail || null,
    submittedByOpenId: null,
    submittedByEmail: fromEmail || null,
    source,
    sourceEmailMessageId: message.id,
    sourceEmailWebLink: message.webLink ?? null,
    parsedFields: parsed.parsedFields as any,
  });
  const submissionId = (insertResult as any).insertId ?? null;

  await db.insert(emailIngestLog).values({
    messageId: message.id,
    internetMessageId: message.internetMessageId ?? null,
    threadId: message.conversationId ?? null,
    receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null,
    fromEmail: fromEmail.toLowerCase() || null,
    toEmails: toEmails as any,
    ccEmails: ccEmails as any,
    subject: message.subject?.slice(0, 1023) ?? null,
    submissionId,
    ingestStatus: "imported",
    errorMessage: null,
  });

  return "imported";
}

export async function getIngestStatus(): Promise<{
  enabled: boolean;
  configured: boolean;
  mailbox: string;
  lastPoll: string | null;
  counts: { imported24h: number; duplicates24h: number; errors24h: number };
  recentErrors: Array<{ id: number; createdAt: string; subject: string | null; error: string | null }>;
  recent: Array<{ id: number; createdAt: string; subject: string | null; ingestStatus: string; submissionId: number | null }>;
}> {
  const db = await getDb();
  const enabled = await loadIngestEnabled();
  const cfg = await loadGraphConfig();
  const mailbox = await loadMailboxAddress();
  const blank = {
    enabled,
    configured: !!cfg,
    mailbox,
    lastPoll: null as string | null,
    counts: { imported24h: 0, duplicates24h: 0, errors24h: 0 },
    recentErrors: [],
    recent: [],
  };
  if (!db) return blank;

  const lastPollRow = await db.select().from(kvState).where(eq(kvState.key, LAST_POLL_KEY)).limit(1);
  const lastPollIso =
    (lastPollRow[0]?.value as { iso?: string } | null)?.iso ?? null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = await db
    .select({ status: emailIngestLog.ingestStatus, c: sql<number>`count(*)` })
    .from(emailIngestLog)
    .where(gte(emailIngestLog.createdAt, since))
    .groupBy(emailIngestLog.ingestStatus);
  const countsMap: Record<string, number> = {};
  for (const r of counts) countsMap[r.status] = Number(r.c) || 0;

  const recentErrors = await db
    .select({
      id: emailIngestLog.id,
      createdAt: emailIngestLog.createdAt,
      subject: emailIngestLog.subject,
      error: emailIngestLog.errorMessage,
    })
    .from(emailIngestLog)
    .where(eq(emailIngestLog.ingestStatus, "error"))
    .orderBy(desc(emailIngestLog.createdAt))
    .limit(5);

  const recent = await db
    .select({
      id: emailIngestLog.id,
      createdAt: emailIngestLog.createdAt,
      subject: emailIngestLog.subject,
      ingestStatus: emailIngestLog.ingestStatus,
      submissionId: emailIngestLog.submissionId,
    })
    .from(emailIngestLog)
    .orderBy(desc(emailIngestLog.createdAt))
    .limit(10);

  return {
    enabled,
    configured: !!cfg,
    mailbox,
    lastPoll: lastPollIso,
    counts: {
      imported24h: countsMap["imported"] ?? 0,
      duplicates24h: countsMap["skipped_duplicate"] ?? 0,
      errors24h: countsMap["error"] ?? 0,
    },
    recentErrors: recentErrors.map(r => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      subject: r.subject ?? null,
      error: r.error ?? null,
    })),
    recent: recent.map(r => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      subject: r.subject ?? null,
      ingestStatus: r.ingestStatus,
      submissionId: r.submissionId ?? null,
    })),
  };
}

let intervalHandle: NodeJS.Timeout | null = null;
let running = false;

/**
 * Start the 5-minute polling loop if the integration is enabled and credentials are set.
 * Safe to call multiple times.
 */
export async function startBrokerAdminIngestScheduler(): Promise<void> {
  if (intervalHandle) return;
  const cfg = await loadGraphConfig();
  const hasEnvHint = !!process.env.MS_GRAPH_TENANT_ID;
  if (!cfg && !hasEnvHint) {
    // No credentials anywhere — silently skip to avoid log spam.
    return;
  }
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const enabled = await loadIngestEnabled();
      const c = await loadGraphConfig();
      if (!enabled || !c) return;
      const result = await runIngestOnce();
      if (result.imported > 0 || result.errors > 0) {
        console.log(
          `[brokerAdminIngest] imported=${result.imported} skipped=${result.skipped} errors=${result.errors}`
        );
      }
    } catch (err) {
      console.error("[brokerAdminIngest] tick failed:", err);
    } finally {
      running = false;
    }
  };
  intervalHandle = setInterval(tick, 5 * 60 * 1000);
  if (typeof intervalHandle.unref === "function") intervalHandle.unref();
  // Kick a first run shortly after startup.
  setTimeout(tick, 30_000).unref?.();
}

export function stopBrokerAdminIngestScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

// Suppress unused-import noise for `and` if not used:
void and;
