#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { emailIngestLog, submissions } from "../../drizzle/schema";
import { parseEmailSubmission } from "../lib/parseEmailSubmission";

type BackfillEntry = {
  email_id: string;
  thread_id?: string | null;
  from?: string | null;
  to?: string[] | null;
  cc?: string[] | null;
  subject?: string | null;
  date?: string | null;
  snippet?: string | null;
  body?: string | null;
  web_link?: string | null;
  attachment_filenames?: string[] | null;
};

async function main() {
  const argv = process.argv.slice(2);
  let status = "pending";
  const positional: string[] = [];
  for (const a of argv) {
    const m = a.match(/^--status(?:=(.+))?$/);
    if (m) {
      const next = m[1] ?? argv[argv.indexOf(a) + 1];
      if (next) status = next;
      continue;
    }
    if (!a.startsWith("--")) positional.push(a);
  }
  const argPath = positional[0] || "brokeradmin_backfill.json";
  const filePath = path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Backfill JSON not found at ${filePath}`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as BackfillEntry[];
  if (!Array.isArray(raw)) {
    console.error("Expected JSON array.");
    process.exit(2);
  }

  const db = await getDb();
  if (!db) {
    console.error("Database is not available. Set DATABASE_URL and retry.");
    process.exit(3);
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorRows: Array<{ email_id: string; reason: string }> = [];

  for (const entry of raw) {
    try {
      if (!entry.email_id) {
        errors += 1;
        errorRows.push({ email_id: "(none)", reason: "missing email_id" });
        continue;
      }

      const existing = await db
        .select({ id: emailIngestLog.id })
        .from(emailIngestLog)
        .where(eq(emailIngestLog.messageId, entry.email_id))
        .limit(1);
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      const body = entry.body ?? entry.snippet ?? "";
      const parsed = parseEmailSubmission({
        subject: entry.subject ?? "",
        body,
        from: entry.from ?? "",
        toEmails: (entry.to ?? []).map(s => s.toLowerCase()),
        ccEmails: (entry.cc ?? []).map(s => s.toLowerCase()),
      });

      const reference = parsed.propertyAddress ?? (entry.subject?.trim() || null);
      const payload = {
        body,
        snippet: entry.snippet ?? null,
        summary: parsed.summary,
        parsedFields: parsed.parsedFields,
        source: {
          kind: "email_ingest_backfill",
          messageId: entry.email_id,
          threadId: entry.thread_id ?? null,
          receivedAt: entry.date ?? null,
          webLink: entry.web_link ?? null,
          from: entry.from ?? null,
          to: entry.to ?? [],
          cc: entry.cc ?? [],
          attachmentFilenames: entry.attachment_filenames ?? [],
        },
      };

      const [insertResult] = await db.insert(submissions).values({
        formType: parsed.formType,
        status,
        payload: JSON.stringify(payload),
        reference: reference ? reference.slice(0, 511) : null,
        submittedBy: entry.from ?? null,
        submittedByOpenId: null,
        submittedByEmail: entry.from ?? null,
        source: "email_ingest_backfill",
        sourceEmailMessageId: entry.email_id,
        sourceEmailWebLink: entry.web_link ?? null,
        parsedFields: parsed.parsedFields as any,
      });
      const submissionId = (insertResult as any).insertId ?? null;

      await db.insert(emailIngestLog).values({
        messageId: entry.email_id,
        internetMessageId: null,
        threadId: entry.thread_id ?? null,
        receivedAt: entry.date ? new Date(entry.date) : null,
        fromEmail: (entry.from ?? "").toLowerCase() || null,
        toEmails: (entry.to ?? []) as any,
        ccEmails: (entry.cc ?? []) as any,
        subject: entry.subject?.slice(0, 1023) ?? null,
        submissionId,
        ingestStatus: "imported",
        errorMessage: null,
      });

      imported += 1;
    } catch (err) {
      errors += 1;
      errorRows.push({
        email_id: entry.email_id ?? "(unknown)",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("\nBackfill summary:");
  console.log(`  Total in file: ${raw.length}`);
  console.log(`  Imported:      ${imported}`);
  console.log(`  Skipped (dup): ${skipped}`);
  console.log(`  Errors:        ${errors}`);
  if (errorRows.length) {
    console.log("\nErrors:");
    for (const e of errorRows) console.log(`  - ${e.email_id}: ${e.reason}`);
  }
  process.exit(errors === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
