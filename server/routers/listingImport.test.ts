import { describe, expect, it, vi, beforeEach } from "vitest";
import { listingImportRouter } from "./listingImport";
import type { TrpcContext } from "../_core/context";
import type { User } from "../../drizzle/schema";

const { storageGetBytesMock, storedUploadRow } = vi.hoisted(() => ({
  storageGetBytesMock: vi.fn(),
  storedUploadRow: {
    fileKey: "broker-docs/listing_brochure/proxy.pdf",
    filename: "proxy.pdf",
    mimeType: "application/pdf",
    uploaderOpenId: "local:broker@example.com",
    reference: null,
  },
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn().mockResolvedValue({ text: "Sample brochure 100 Main St" }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../settings/getSetting", () => ({
  getSetting: vi.fn().mockResolvedValue("Test Brokerage"),
}));

vi.mock("../settings/settingsStore", () => ({
  ensureSettingsCache: vi.fn(),
}));

vi.mock("../storage", () => ({
  sanitizeStorageKey: vi.fn((rawKey: string) =>
    String(rawKey).trim().replace(/\\/g, "/").replace(/^\/+/, "")
  ),
  storedFileKeyFromReference: vi.fn((input: string | null | undefined) => {
    const raw = String(input ?? "").trim();
    if (!raw) return null;
    if (raw.startsWith("/api/files/content")) {
      const [, query = ""] = raw.split("?", 2);
      return new URLSearchParams(query).get("key");
    }
    if (raw.startsWith("/local-uploads/")) {
      return raw.slice("/local-uploads/".length);
    }
    if (/^(broker-docs|broker-admin|broker-docusign)\//.test(raw)) {
      return raw;
    }
    return null;
  }),
  storageGetBytes: storageGetBytesMock,
  isStoredFileReference: vi.fn((value: string) =>
    Boolean(
      value?.startsWith("/api/files/content") ||
      value?.startsWith("/local-uploads/") ||
      /^(broker-docs|broker-admin|broker-docusign)\//.test(value ?? "")
    )
  ),
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([storedUploadRow]),
        }),
      }),
    }),
  }),
}));

import { invokeLLM } from "../_core/llm";
import { ensureSettingsCache } from "../settings/settingsStore";

const adminUser = { openId: "local:admin@example.com", role: "admin" } as User;

function adminCtx(): TrpcContext {
  return {
    user: adminUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("listingImport.extractFromBrochure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetBytesMock.mockResolvedValue({
      key: "broker-docs/listing_brochure/proxy.pdf",
      bytes: Buffer.from("%PDF-proxy"),
    });
  });

  it("returns property, contacts, and https photo URLs", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              property: {
                address: "100 Main St",
                city: "Irvine",
                state: "CA",
                buildingSf: "5000",
              },
              contacts: [{ name: "Pat Lee", email: "pat@example.com" }],
              photoUrls: ["https://cdn.example.com/a.jpg", "ftp://ignored/x"],
            }),
          },
        },
      ],
    } as any);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })
    );

    const caller = listingImportRouter.createCaller(adminCtx());
    const r = await caller.extractFromBrochure({
      fileUrl: "https://files.example.com/b.pdf",
      mimeType: "application/pdf",
    });

    expect(r.success).toBe(true);
    expect(r.property.address).toBe("100 Main St");
    expect(r.contacts[0]?.name).toBe("Pat Lee");
    expect(r.photoUrls).toEqual(["https://cdn.example.com/a.jpg"]);
  });

  it("accepts uploaded file proxy URLs and reads via storage", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              property: {
                address: "42 Proxy Ave",
                city: "Irvine",
              },
              contacts: [],
              photoUrls: [],
            }),
          },
        },
      ],
    } as any);

    const fetchMock = vi.mocked(globalThis.fetch);
    const caller = listingImportRouter.createCaller(adminCtx());
    const r = await caller.extractFromBrochure({
      fileUrl: "/api/files/content?key=broker-docs%2Flisting_brochure%2Fproxy.pdf",
      mimeType: "application/pdf",
    });

    expect(r.success).toBe(true);
    expect(r.property.address).toBe("42 Proxy Ave");
    expect(storageGetBytesMock).toHaveBeenCalledWith("broker-docs/listing_brochure/proxy.pdf");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("listingImport.pushToBuildout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects when Buildout key is missing", async () => {
    vi.mocked(ensureSettingsCache).mockResolvedValueOnce(
      new Map([
        ["integrations.buildout.api_key", ""],
        ["integrations.buildout.api_base_url", null],
      ] as any)
    );

    const caller = listingImportRouter.createCaller(adminCtx());
    await expect(
      caller.pushToBuildout({
        mode: "create",
        brokerId: 1,
        propertyTypeId: 2,
        propertySubtypeId: 3,
        listingFields: { address: "1 Main" },
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("creates property and posts photos", async () => {
    vi.mocked(ensureSettingsCache).mockResolvedValueOnce(
      new Map([
        ["integrations.buildout.api_key", "bo-key"],
        ["integrations.buildout.api_base_url", null],
      ] as any)
    );

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ property: { id: 77 } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ photo: { id: 1 } }),
      } as any);

    const caller = listingImportRouter.createCaller(adminCtx());
    const r = await caller.pushToBuildout({
      mode: "create",
      brokerId: 9,
      propertyTypeId: 8,
      propertySubtypeId: 7,
      listingFields: { city: "LA", state: "CA" },
      photoUrls: ["https://cdn.example.com/p.png"],
    });

    expect(r.propertyId).toBe(77);
    expect(r.photoResults).toHaveLength(1);
    expect(r.photoResults[0]?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes("properties.json"))).toBe(true);
    expect(urls.some(u => u.includes("properties/77/photos.json"))).toBe(true);
  });
});
