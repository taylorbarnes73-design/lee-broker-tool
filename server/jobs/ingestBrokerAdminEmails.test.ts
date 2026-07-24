import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailIngestLog, kvState } from "../../drizzle/schema";
import { runIngestOnce } from "./ingestBrokerAdminEmails";
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

  it("retries a prior ingestStatus=error row instead of permanently skipping it", async () => {
    const message = {
      ...buildMessage("retry-me", "2026-02-01T00:00:00.000Z"),
      internetMessageId: "<retry@example.com>",
      body: { contentType: "text", content: "Commission voucher for 9 Retry Lane" },
    };
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([message]);

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const insertValues = vi.fn().mockResolvedValue([{ insertId: 55 }]);
    let emailLogLookups = 0;

    const fakeDb = {
      select: (_cols?: unknown) => ({
        from: (table: unknown) => ({
          where: (_cond: unknown) => ({
            limit: (_n: number) => {
              if (table === kvState) return Promise.resolve([]);
              if (table === emailIngestLog) {
                emailLogLookups += 1;
                // First lookup is by messageId and finds the prior error row.
                if (emailLogLookups === 1) {
                  return Promise.resolve([
                    { id: 9, ingestStatus: "error", submissionId: null },
                  ]);
                }
                // Second lookup is by internetMessageId — treat as same error row path.
                return Promise.resolve([
                  { id: 9, messageId: "retry-me", ingestStatus: "error", submissionId: null },
                ]);
              }
              // submissions.sourceEmailMessageId heal lookup
              return Promise.resolve([]);
            },
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: (row: unknown) => {
          if (table === emailIngestLog) {
            const promise: any = Promise.resolve([{ insertId: 9 }]);
            promise.onDuplicateKeyUpdate = () => Promise.resolve(undefined);
            return promise;
          }
          return insertValues(row);
        },
      }),
      update: () => ({ set: updateSet }),
    };

    vi.mocked(getDb).mockResolvedValue(fakeDb as never);

    const summary = await runIngestOnce({ since: new Date("2026-01-01T00:00:00.000Z") });

    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.errors).toBe(0);
    expect(insertValues).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ ingestStatus: "imported", submissionId: 55 })
    );
  });

  it("skips a terminal internetMessageId match without attempting a conflicting insert", async () => {
    const message = {
      ...buildMessage("graph-new-id", "2026-03-01T00:00:00.000Z"),
      internetMessageId: "<already-seen@example.com>",
    };
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([message]);

    const insertValues = vi.fn();
    let emailLogLookups = 0;
    const fakeDb = {
      select: (_cols?: unknown) => ({
        from: (table: unknown) => ({
          where: (_cond: unknown) => ({
            limit: (_n: number) => {
              if (table === kvState) return Promise.resolve([]);
              if (table === emailIngestLog) {
                emailLogLookups += 1;
                if (emailLogLookups === 1) return Promise.resolve([]); // no messageId match
                return Promise.resolve([
                  {
                    id: 3,
                    messageId: "graph-old-id",
                    ingestStatus: "imported",
                    submissionId: 12,
                  },
                ]);
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
      insert: () => ({
        values: (...args: unknown[]) => {
          insertValues(...args);
          const promise: any = Promise.resolve([{ insertId: 1 }]);
          promise.onDuplicateKeyUpdate = () => Promise.resolve(undefined);
          return promise;
        },
      }),
      update: () => ({
        set: () => ({ where: () => Promise.resolve(undefined) }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(fakeDb as never);

    const summary = await runIngestOnce({ since: new Date("2026-01-01T00:00:00.000Z") });

    expect(summary.skipped).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.errors).toBe(0);
    expect(insertValues).not.toHaveBeenCalled();
  });
});
