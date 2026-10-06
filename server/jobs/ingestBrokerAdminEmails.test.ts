import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailIngestLog, kvState, submissions } from "../../drizzle/schema";
import {
  buildEmailIngestPayloadJson,
  EMAIL_INGEST_PAYLOAD_MAX_BYTES,
  runIngestOnce,
  type EmailIngestPayload,
} from "./ingestBrokerAdminEmails";
import type { GraphMessage } from "../lib/msGraph";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../lib/msGraph", () => ({
  loadGraphConfig: vi.fn(),
  loadMailboxAddress: vi.fn(),
  listSharedMailboxMessages: vi.fn(),
}));

import { getDb } from "../db";
import { loadGraphConfig, loadMailboxAddress, listSharedMailboxMessages } from "../lib/msGraph";

function buildMessage(id: string, receivedDateTime: string): GraphMessage {
  return {
    id,
    internetMessageId: null,
    subject: `Subject ${id}`,
    from: { emailAddress: { address: `sender-${id}@example.com`, name: "Sender" } },
    toRecipients: [],
    ccRecipients: [],
    receivedDateTime,
    bodyPreview: "hello",
    body: { contentType: "text", content: "hello" },
  };
}

function buildFakeDb(dedupBehavior: (callIndex: number) => "ok" | "fail") {
  let dedupCallIndex = 0;
  return {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => ({
        where: (_cond: unknown) => ({
          limit: (_n: number) => {
            if (table === kvState) return Promise.resolve([]);
            if (table === emailIngestLog) {
              dedupCallIndex += 1;
              if (dedupBehavior(dedupCallIndex) === "fail") {
                return Promise.reject(new Error("dedup check failed"));
              }
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: (_table: unknown) => {
      const builder: any = {
        values: (_row: unknown) => {
          const promise: any = Promise.resolve([{ insertId: 1 }]);
          promise.onDuplicateKeyUpdate = () => Promise.resolve(undefined);
          return promise;
        },
      };
      return builder;
    },
  };
}

function samplePayload(body: string): EmailIngestPayload {
  return {
    body,
    summary: "Lease at 100 Main St",
    parsedFields: {
      formType: "lease",
      propertyAddress: "100 Main St",
      dollarAmounts: ["$12,000"],
      contacts: ["tenant@example.com"],
      summary: "Lease at 100 Main St",
    },
    source: {
      kind: "email_ingest",
      messageId: "graph-message-1",
      internetMessageId: "<msg@example.com>",
      threadId: "thread-1",
      receivedAt: "2026-06-01T12:00:00.000Z",
      webLink: "https://outlook.office.com/mail/id/graph-message-1",
      from: "broker@example.com",
      fromName: "Broker",
      to: ["admin@lee-associates.com"],
      cc: [],
      hasAttachments: false,
    },
  };
}

describe("buildEmailIngestPayloadJson", () => {
  it("keeps a short mailbox message unchanged", () => {
    const payload = samplePayload("Please review the lease.");
    const json = buildEmailIngestPayloadJson(payload);
    expect(json).toBe(JSON.stringify(payload));
    expect(JSON.parse(json).bodyTruncated).toBeUndefined();
  });

  it("truncates an oversized body so the row still fits a MySQL TEXT column", () => {
    const payload = samplePayload(`${"Forwarded lease thread. ".repeat(8_000)}100 Main St`);
    expect(Buffer.byteLength(JSON.stringify(payload), "utf8")).toBeGreaterThan(65_535);

    const json = buildEmailIngestPayloadJson(payload);
    const stored = JSON.parse(json) as EmailIngestPayload & { bodyTruncated?: boolean };

    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(EMAIL_INGEST_PAYLOAD_MAX_BYTES);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(65_535);
    expect(stored.bodyTruncated).toBe(true);
    expect(stored.body.length).toBeGreaterThan(0);
    expect(stored.body).toContain("Open the Outlook link");
    expect(stored.parsedFields.propertyAddress).toBe("100 Main St");
    expect(stored.source.webLink).toBe(payload.source.webLink);
    expect(stored.source.messageId).toBe(payload.source.messageId);
  });

  it("counts UTF-8 bytes, not JavaScript characters, when truncating", () => {
    const payload = samplePayload("é".repeat(80_000));
    const json = buildEmailIngestPayloadJson(payload);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(EMAIL_INGEST_PAYLOAD_MAX_BYTES);
    expect(JSON.parse(json).bodyTruncated).toBe(true);
  });
});

describe("runIngestOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadGraphConfig).mockResolvedValue({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
    });
    vi.mocked(loadMailboxAddress).mockResolvedValue("mailbox@lee-associates.com");
  });

  it("requests the mailbox oldest-first so a large backlog can't skip over older messages", async () => {
    vi.mocked(getDb).mockResolvedValue(buildFakeDb(() => "ok") as never);
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([]);

    await runIngestOnce({ since: new Date("2026-01-01T00:00:00.000Z") });

    expect(listSharedMailboxMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ order: "asc" })
    );
  });

  it("imports an oversized mailbox message instead of failing the payload insert", async () => {
    const inserted: Array<{ table: unknown; row: { payload?: string } }> = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: (row: { payload?: string }) => {
          inserted.push({ table, row });
          const promise: any = Promise.resolve([{ insertId: 42 }]);
          promise.onDuplicateKeyUpdate = () => Promise.resolve(undefined);
          return promise;
        },
      }),
    };
    const message = buildMessage("long-msg", "2026-06-01T12:00:00.000Z");
    message.body = { contentType: "text", content: "Forwarded lease thread. ".repeat(8_000) };
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([message]);

    const summary = await runIngestOnce({ since: new Date("2026-05-01T00:00:00.000Z") });

    expect(summary.errors).toBe(0);
    expect(summary.imported).toBe(1);
    const submissionInsert = inserted.find(entry => entry.table === submissions);
    expect(submissionInsert?.row.payload).toBeTruthy();
    expect(Buffer.byteLength(submissionInsert!.row.payload!, "utf8")).toBeLessThanOrEqual(
      EMAIL_INGEST_PAYLOAD_MAX_BYTES
    );
    expect(JSON.parse(submissionInsert!.row.payload!).bodyTruncated).toBe(true);
    expect(summary.lastPoll).toBe("2026-06-01T12:00:00.000Z");
  });

  it("stops advancing the watermark past a failed message instead of skipping straight to the newest one", async () => {
    const messages = [
      buildMessage("msg1", "2026-01-01T00:00:00.000Z"),
      buildMessage("msg2", "2026-01-02T00:00:00.000Z"),
      buildMessage("msg3", "2026-01-03T00:00:00.000Z"),
    ];
    vi.mocked(listSharedMailboxMessages).mockResolvedValue(messages);
    // Second message's dedup lookup fails, simulating a transient per-message error.
    vi.mocked(getDb).mockResolvedValue(buildFakeDb(callIndex => (callIndex === 2 ? "fail" : "ok")) as never);

    const summary = await runIngestOnce({ since: new Date("2025-12-31T00:00:00.000Z") });

    expect(summary.errors).toBe(1);
    expect(summary.imported).toBe(2);
    // Watermark must hold at the last good message before the failure, not the
    // newest message in the batch, so msg2 (and anything after it) gets retried.
    expect(summary.lastPoll).toBe("2026-01-01T00:00:00.000Z");
  });
});
