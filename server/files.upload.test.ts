import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock storagePut so tests don't hit real S3
vi.mock("./storage", () => ({
  storagePut: vi.fn((key: string) =>
    Promise.resolve({
      key,
      url: `https://cdn.example.com/${key}`,
    })
  ),
  storageGet: vi.fn((key: string) =>
    Promise.resolve({
      key,
      url: `https://cdn.example.com/${key}`,
    })
  ),
  storagePublicUrl: vi.fn((key: string) => `/api/files/content?key=${encodeURIComponent(key)}`),
}));

// Mock getDb so tests don't need a real database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

const testUser = {
  id: 1,
  openId: "local:broker@example.test",
  name: "Test User",
  email: "broker@example.test",
  loginMethod: "local",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
} as TrpcContext["user"];

const uploadRow = {
  id: 1,
  fileKey: "broker-docs/listing_agreement/test-file.txt",
  url: "https://cdn.example.com/broker-docs/listing_agreement/test-file.txt",
  filename: "test-file.txt",
  mimeType: "text/plain",
  fileSize: 11,
  category: "listing_agreement",
  reference: "123 Main St",
  uploaderName: "Test User",
  uploaderOpenId: "local:broker@example.test",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function makeDb(uploadRows: unknown[] = [uploadRow]) {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn((fields?: Record<string, unknown>) => {
      if (fields && Object.prototype.hasOwnProperty.call(fields, "uploaderOpenId")) {
        return makeSelectBuilder(uploadRows.map((row: any) => ({ uploaderOpenId: row.uploaderOpenId })));
      }
      return makeSelectBuilder(uploadRows);
    }),
  };
}

function createCtx(user: TrpcContext["user"] = testUser): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("files.upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(makeDb() as any);
  });

  it("rejects unauthenticated uploads", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.files.upload({
        filename: "test-file.txt",
        mimeType: "text/plain",
        base64Data: Buffer.from("Hello World").toString("base64"),
        category: "listing_agreement",
      })
    ).rejects.toThrow(/not authenticated/i);
  });

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
    // storageGet returns a browser URL after the upload succeeds.
    expect(result.url).toMatch(/^https?:\/\/|^\/api\/files\/content/);
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

  it("rejects unsafe category values", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.files.upload({
        filename: "bad.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("%PDF-1.4").toString("base64"),
        category: "../contracts",
      })
    ).rejects.toThrow(/Invalid file category/i);
  });

  it("allows nested category paths used by portal uploads", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.upload({
      filename: "contract.pdf",
      mimeType: "application/pdf",
      base64Data: Buffer.from("%PDF-1.4").toString("base64"),
      category: "submissions/contracts",
    });
    expect(result.success).toBe(true);
    expect(result.fileKey).toContain("broker-docs/submissions/contracts/");
  });

  it("rejects traversal segments inside nested categories", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.files.upload({
        filename: "bad.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("%PDF-1.4").toString("base64"),
        category: "submissions/../contracts",
      })
    ).rejects.toThrow(/Invalid file category/i);
  });

  it("rejects malformed nested categories with empty path segments", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.files.upload({
        filename: "bad.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("%PDF-1.4").toString("base64"),
        category: "submissions//contracts",
      })
    ).rejects.toThrow(/Invalid file category/i);
  });
});

describe("files.uploadBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(makeDb() as any);
  });

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
        expect(r.url).toMatch(/^https?:\/\/|^\/api\/files\/content/);
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

  it("returns a per-file error for unsafe categories", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.uploadBatch({
      files: [
        {
          filename: "bad.pdf",
          mimeType: "application/pdf",
          base64Data: Buffer.from("%PDF-1.4").toString("base64"),
          category: "../contracts",
        },
      ],
    });

    expect(result.successCount).toBe(0);
    expect(result.totalCount).toBe(1);
    const failed = result.results[0];
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error).toMatch(/Invalid file category/i);
    }
  });
});

describe("files.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated listing", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.files.list({})).rejects.toThrow(/not authenticated/i);
  });

  it("returns a list of files uploaded by the current broker", async () => {
    const db = makeDb([uploadRow]);
    vi.mocked(getDb).mockResolvedValue(db as any);
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated URL requests", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.files.getUrl({
        fileKey: "broker-docs/listing_agreement/test-file.txt",
      })
    ).rejects.toThrow(/not authenticated/i);
  });

  it("returns a download url for a given file key", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([uploadRow]) as any);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.getUrl({
      fileKey: "broker-docs/listing_agreement/test-file.txt",
    });
    expect(result.url).toContain("https://");
  });

  it("rejects files owned by a different broker", async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeDb([{ ...uploadRow, uploaderOpenId: "local:other@example.test" }]) as any
    );
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.files.getUrl({
        fileKey: "broker-docs/listing_agreement/test-file.txt",
      })
    ).rejects.toThrow(/not authorized/i);
  });
});
