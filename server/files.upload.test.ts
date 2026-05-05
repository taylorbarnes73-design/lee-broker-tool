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
import { storagePut } from "./storage";

const authUser: TrpcContext["user"] = {
  id: 1,
  openId: "local:test@lee-associates.com",
  name: "Test User",
  email: "test@lee-associates.com",
  loginMethod: "local",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};

function createCtx(user: TrpcContext["user"] = authUser): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("files.upload", () => {
  it("uploads a file for an authenticated user and returns success with url", async () => {
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
    expect(result.url).toContain("https://");
    expect(result.fileKey).toContain("broker-docs/listing_agreement/");
  });

  it("rejects anonymous uploads before writing to storage", async () => {
    const caller = appRouter.createCaller(createCtx(null));

    await expect(
      caller.files.upload({
        filename: "test-file.txt",
        mimeType: "text/plain",
        base64Data: Buffer.from("Hello World").toString("base64"),
        category: "listing_agreement",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(storagePut).not.toHaveBeenCalled();
  });
});

describe("files.list", () => {
  it("returns a list of uploaded files for an authenticated user", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("fileKey");
    expect(result[0]).toHaveProperty("url");
    expect(result[0]).toHaveProperty("filename");
  });

  it("rejects anonymous list requests", async () => {
    const caller = appRouter.createCaller(createCtx(null));

    await expect(caller.files.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("files.getUrl", () => {
  it("returns a download url for a given file key to an authenticated user", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.files.getUrl({
      fileKey: "broker-docs/listing_agreement/test-file.txt",
    });
    expect(result.url).toContain("https://");
  });

  it("rejects anonymous download URL requests", async () => {
    const caller = appRouter.createCaller(createCtx(null));

    await expect(
      caller.files.getUrl({
        fileKey: "broker-docs/listing_agreement/test-file.txt",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
