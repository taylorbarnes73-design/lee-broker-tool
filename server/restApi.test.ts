import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { restApiRouter } from "./restApi";
import { getDb } from "./db";
import { storageGet } from "./storage";

const TEST_API_KEY = "test-connector-key";

// Mock the database and storage modules
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.pdf", key: "test-key" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.pdf?signed=1", key: "test-key" }),
  storageKeyFromReference: vi.fn((value: string) => {
    const raw = String(value).trim();
    if (raw.startsWith("/api/files/content")) {
      const [, query = ""] = raw.split("?", 2);
      const key = new URLSearchParams(query).get("key");
      return key ?? raw;
    }
    if (raw.startsWith("/local-uploads/")) {
      return raw.slice("/local-uploads/".length);
    }
    return raw.replace(/^\/+/, "");
  }),
}));

vi.mock("../drizzle/schema", () => ({
  uploads: {},
  submissions: {},
}));

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => col),
  eq: vi.fn((col, val) => ({ col, val })),
}));

// Build a minimal Express app with the REST router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", restApiRouter);
  return app;
}

function withApiKey(req: request.Test) {
  return req.set("x-api-key", TEST_API_KEY);
}

describe("REST API — /api/v1", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    process.env.CONNECTOR_API_KEY = TEST_API_KEY;
    app = buildApp();
    vi.clearAllMocks();
  });

  it("returns 401 when the API key header is missing", async () => {
    const res = await request(app).get("/api/v1/submissions");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/API key/i);
  });

  // ── Listing ──

  describe("POST /submit/listing", () => {
    it("returns 400 when propertyAddress is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/listing"))
        .send({ propertyType: "Industrial", transactionType: "Lease" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/propertyAddress/);
    });

    it("returns 400 when propertyType is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/listing"))
        .send({ propertyAddress: "123 Main St", transactionType: "Lease" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/propertyType/);
    });

    it("returns 200 with submissionId on valid payload", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/listing"))
        .send({ propertyAddress: "123 Main St", propertyType: "Industrial", transactionType: "Lease" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        formType: "listing",
        propertyAddress: "123 Main St",
      });
      expect(res.body.data.submittedAt).toBeDefined();
    });
  });

  // ── Voucher ──

  describe("POST /submit/voucher", () => {
    it("returns 400 when propertyAddress is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/voucher"))
        .send({ representationType: "Tenant Rep" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/propertyAddress/);
    });

    it("returns 400 when representationType is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/voucher"))
        .send({ propertyAddress: "123 Main St" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/representationType/);
    });

    it("returns 200 with submissionId on valid payload", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/voucher"))
        .send({ propertyAddress: "123 Main St", representationType: "Tenant Rep", totalCommission: 34000 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formType).toBe("voucher");
      expect(res.body.data.totalCommission).toBe(34000);
    });
  });

  // ── Sign Request ──

  describe("POST /submit/sign-request", () => {
    it("returns 400 when propertyAddress is missing", async () => {
      const res = await withApiKey(request(app).post("/api/v1/submit/sign-request")).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/propertyAddress/);
    });

    it("returns 200 and auto-generates a PO number", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/sign-request"))
        .send({ propertyAddress: "123 Main St", requestedBy: "Taylor Barnes" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.poNumber).toMatch(/^PO-/);
      expect(res.body.data.formType).toBe("sign-request");
    });

    it("uses provided PO number when given", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/sign-request"))
        .send({ propertyAddress: "123 Main St", poNumber: "PO-CUSTOM-001" });
      expect(res.status).toBe(200);
      expect(res.body.data.poNumber).toBe("PO-CUSTOM-001");
    });
  });

  // ── Comp ──

  describe("POST /submit/comp", () => {
    it("returns 400 when address is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/comp"))
        .send({ compType: "Lease Comp" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/address/);
    });

    it("returns 400 when compType is missing", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/comp"))
        .send({ address: "123 Main St" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/compType/);
    });

    it("returns 200 on valid payload", async () => {
      const res = await withApiKey(request(app)
        .post("/api/v1/submit/comp"))
        .send({ address: "123 Main St", compType: "Lease Comp", lanbSource: "Taylor Barnes" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.formType).toBe("comp");
    });
  });

  // ── Submissions list ──

  describe("GET /submissions", () => {
    it("returns 200 with empty array when no submissions exist", async () => {
      const res = await withApiKey(request(app).get("/api/v1/submissions"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── Files ──

  describe("GET /files", () => {
    it("returns 200 with empty array when no files exist", async () => {
      const res = await withApiKey(request(app).get("/api/v1/files"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("does not enumerate private BrokerAdmin or DocuSign file keys", async () => {
      const rows = [
        {
          fileKey: "broker-admin/request-1/confidential.pdf",
          filename: "confidential.pdf",
          url: "/api/files/content?key=broker-admin%2Frequest-1%2Fconfidential.pdf",
          mimeType: "application/pdf",
          fileSize: 123,
          category: "admin_request_attachment",
          reference: "request-1",
          uploaderName: "Broker",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          fileKey: "broker-docusign/executed/signed.pdf",
          filename: "signed.pdf",
          url: "/api/files/content?key=broker-docusign%2Fexecuted%2Fsigned.pdf",
          mimeType: "application/pdf",
          fileSize: 456,
          category: "docusign_executed",
          reference: "envelope-1",
          uploaderName: "Admin",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          fileKey: "broker-docs/listing/allowed.pdf",
          filename: "allowed.pdf",
          url: "/api/files/content?key=broker-docs%2Flisting%2Fallowed.pdf",
          mimeType: "application/pdf",
          fileSize: 789,
          category: "listing_agreement",
          reference: "listing-1",
          uploaderName: "Broker",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ];
      vi.mocked(getDb).mockResolvedValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      } as never);

      const res = await withApiKey(request(app).get("/api/v1/files"));

      expect(res.status).toBe(200);
      expect(res.body.data.map((row: { fileKey: string }) => row.fileKey)).toEqual([
        "broker-docs/listing/allowed.pdf",
      ]);
    });
  });

  describe("GET /files/url", () => {
    it("returns 400 when key is missing", async () => {
      const res = await withApiKey(request(app).get("/api/v1/files/url"));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/key/);
    });

    it("returns 200 with a download URL when key is provided", async () => {
      const res = await withApiKey(request(app).get("/api/v1/files/url?key=broker-docs%2Ftest-file.pdf"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();
    });

    it("rejects private BrokerAdmin and DocuSign keys", async () => {
      const brokerAdmin = await withApiKey(
        request(app).get("/api/v1/files/url?key=broker-admin%2Frequest-1%2Fconfidential.pdf")
      );
      const docusign = await withApiKey(
        request(app).get("/api/v1/files/url?key=%2Fapi%2Ffiles%2Fcontent%3Fkey%3Dbroker-docusign%252Fexecuted%252Fsigned.pdf")
      );

      expect(brokerAdmin.status).toBe(403);
      expect(docusign.status).toBe(403);
      expect(storageGet).not.toHaveBeenCalled();
    });
  });
});
