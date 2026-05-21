import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock storagePut so tests don't hit real S3
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "broker-docs/listing_agreement/test-file.txt",
    url: "https://cdn.example.com/broker-docs/listing_agreement/test-file.txt",
  }),
  storageGet: vi.fn().mockResolvedValue({
    key: "broker-docs/listing_agreement/test-file.txt",
    url: "https://cdn.example.com/broker-docs/listing_agreement/test-file.txt",
  }),
}));

// Mock getDb so tests don't need a real database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 1,
              fileKey: "broker-docs/listing_agreement/test-file.txt",
              url: "https://cdn.example.com/broker-docs/listing_agreement/test-file.txt",
              filename: "test-file.txt",
              mimeType: "text/plain",
              fileSize: 11,
              category: "listing_agreement",
              reference: "123 Main St",
              uploaderName: "Test User",
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        }),
      }),
    }),
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("files.upload", () => {
  it("uploads a file and returns success with url", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.upload({
      filename: "test-file.txt",
      mimeType: "text/plain",
      base64Data: Buffer.from("Hello World").toString("base64"),
      category: "listing_agreement",
      reference: "123 Main St",
      uploaderName: "Test User",
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBe("test-file.txt");
    // URL is either an S3 signed URL (https://) or a local-storage path (/local-uploads/)
    expect(result.url).toMatch(/^https?:\/\/|^\/local-uploads\//);
    expect(result.fileKey).toContain("broker-docs/listing_agreement/");
  });

  it("rejects a file that exceeds the 100 MB size limit", async () => {
    const caller = appRouter.createCaller(createCtx());
    // 101 MB of zeros
    const oversized = Buffer.alloc(101 * 1024 * 1024, 0);
    await expect(
      caller.files.upload({
        filename: "huge.pdf",
        mimeType: "application/pdf",
        base64Data: oversized.toString("base64"),
        category: "listing_brochure",
      })
    ).rejects.toThrow(/exceeds maximum size/i);
  });

  it("fails when database is unavailable so uploads are always auditable", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as any);
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.files.upload({
        filename: "audit-required.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("%PDF-1.4").toString("base64"),
        category: "listing_brochure",
      })
    ).rejects.toThrow(/Database unavailable/i);
  });
});

describe("files.uploadBatch", () => {
  it("uploads multiple files and returns per-file results", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.uploadBatch({
      files: [
        {
          filename: "doc1.pdf",
          mimeType: "application/pdf",
          base64Data: Buffer.from("%PDF-1.4 doc1").toString("base64"),
          category: "agency_disclosure",
        },
        {
          filename: "doc2.pdf",
          mimeType: "application/pdf",
          base64Data: Buffer.from("%PDF-1.4 doc2").toString("base64"),
          category: "listing_agreement",
        },
      ],
      uploaderName: "Test Broker",
    });

    expect(result.totalCount).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.results).toHaveLength(2);
    result.results.forEach(r => {
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.url).toMatch(/^https?:\/\/|^\/local-uploads\//);
        expect(r.fileKey).toContain("broker-docs/");
      }
    });
  });

  it("returns per-file errors for oversized files in a batch", async () => {
    const caller = appRouter.createCaller(createCtx());
    const oversized = Buffer.alloc(101 * 1024 * 1024, 0);
    const result = await caller.files.uploadBatch({
      files: [
        {
          filename: "good.pdf",
          mimeType: "application/pdf",
          base64Data: Buffer.from("%PDF-1.4 small").toString("base64"),
          category: "agency_disclosure",
        },
        {
          filename: "huge.pdf",
          mimeType: "application/pdf",
          base64Data: oversized.toString("base64"),
          category: "agency_disclosure",
        },
      ],
    });

    expect(result.totalCount).toBe(2);
    expect(result.successCount).toBe(1);
    const failed = result.results.find(r => !r.success);
    expect(failed).toBeDefined();
    if (failed && !failed.success) {
      expect(failed.error).toMatch(/exceeds maximum size/i);
    }
  });

  it("rejects a batch with more than 20 files", async () => {
    const caller = appRouter.createCaller(createCtx());
    const files = Array.from({ length: 21 }, (_, i) => ({
      filename: `file${i}.pdf`,
      mimeType: "application/pdf",
      base64Data: Buffer.from(`%PDF-1.4 ${i}`).toString("base64"),
      category: "other",
    }));
    await expect(caller.files.uploadBatch({ files })).rejects.toThrow();
  });
});

describe("files.list", () => {
  it("returns a list of uploaded files", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("fileKey");
    expect(result[0]).toHaveProperty("url");
    expect(result[0]).toHaveProperty("filename");
  });
});

describe("files.getUrl", () => {
  it("returns a download url for a given file key", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.getUrl({
      fileKey: "broker-docs/listing_agreement/test-file.txt",
    });
    expect(result.url).toContain("https://");
  });
});
