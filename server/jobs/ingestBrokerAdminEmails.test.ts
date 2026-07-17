import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailIngestLog, kvState, submissions } from "../../drizzle/schema";
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
  const fakeDb = {
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
    delete: (_table: unknown) => ({
      where: (_cond: unknown) => Promise.resolve(undefined),
    }),
    update: (_table: unknown) => ({
      set: (_row: unknown) => ({
        where: (_cond: unknown) => Promise.resolve(undefined),
      }),
    }),
  };
  return Object.assign(fakeDb, {
    transaction: async (callback: (tx: typeof fakeDb) => Promise<unknown>) =>
      callback(fakeDb),
  });
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

  it("advances past a Graph message whose internet message ID was already ingested", async () => {
    const message = buildMessage("new-graph-id", "2026-01-01T00:00:00.000Z");
    message.internetMessageId = "<stable-message-id@example.com>";
    let emailLogLookupCount = 0;
    let emailLogInsertCount = 0;
    const fakeDb = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: () => {
              if (table === kvState) return Promise.resolve([]);
              if (table === emailIngestLog) {
                emailLogLookupCount += 1;
                return Promise.resolve(emailLogLookupCount === 2 ? [{ id: 1 }] : []);
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: () => {
          if (table === emailIngestLog) {
            emailLogInsertCount += 1;
            return Promise.reject(new Error("Duplicate entry for internet_message_id"));
          }
          return Object.assign(Promise.resolve([{ insertId: 1 }]), {
            onDuplicateKeyUpdate: () => Promise.resolve(undefined),
          });
        },
      }),
    };
    vi.mocked(getDb).mockResolvedValue(fakeDb as never);
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([message]);

    const summary = await runIngestOnce({ since: new Date("2025-12-31T00:00:00.000Z") });

    expect(summary.errors).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.lastPoll).toBe("2026-01-01T00:00:00.000Z");
    expect(emailLogInsertCount).toBe(0);
  });

  it("retries a message whose prior ingest log records an error", async () => {
    const message = buildMessage("retry-message", "2026-01-01T00:00:00.000Z");
    let submissionInsertCount = 0;
    let importedLogUpdateCount = 0;
    const fakeDb = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: () =>
              Promise.resolve(
                table === emailIngestLog ? [{ id: 1, ingestStatus: "error" }] : []
              ),
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: () => {
          if (table === submissions) {
            submissionInsertCount += 1;
            return Promise.resolve([{ insertId: 42 }]);
          }
          if (table === emailIngestLog) {
            return Promise.resolve(undefined);
          }
          return Object.assign(Promise.resolve(undefined), {
            onDuplicateKeyUpdate: () => Promise.resolve(undefined),
          });
        },
      }),
      delete: () => ({
        where: () => Promise.resolve(undefined),
      }),
      update: () => ({
        set: () => ({
          where: () => {
            importedLogUpdateCount += 1;
            return Promise.resolve(undefined);
          },
        }),
      }),
    };
    const transaction = vi.fn(
      async (callback: (tx: typeof fakeDb) => Promise<unknown>) => callback(fakeDb)
    );
    const transactionalDb = Object.assign(fakeDb, { transaction });
    vi.mocked(getDb).mockResolvedValue(transactionalDb as never);
    vi.mocked(listSharedMailboxMessages).mockResolvedValue([message]);

    const summary = await runIngestOnce({ since: new Date("2025-12-31T00:00:00.000Z") });

    expect(summary.errors).toBe(0);
    expect(summary.imported).toBe(1);
    expect(summary.lastPoll).toBe("2026-01-01T00:00:00.000Z");
    expect(submissionInsertCount).toBe(1);
    expect(importedLogUpdateCount).toBe(1);
    expect(transaction).toHaveBeenCalledOnce();
  });
});
