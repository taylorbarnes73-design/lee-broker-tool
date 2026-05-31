import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { submissionsApiRouter } from "./submissionsApi";

const { getDbMock, storageGetBytesMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  storageGetBytesMock: vi.fn(),
}));

vi.mock("./auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  localAuth: {
    normalizeEmail: (value: string) => value.trim().toLowerCase(),
    toLocalOpenId: (email: string) => `local:${email.trim().toLowerCase()}`,
    isEnabled: () => true,
  },
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageGetBytes: storageGetBytesMock,
  resolveStoredFileKey: vi.fn((value: string) => {
    if (value.startsWith("/api/files/content")) {
      return new URLSearchParams(value.split("?", 2)[1] ?? "").get("key");
    }
    if (value.startsWith("/local-uploads/")) return value.slice("/local-uploads/".length);
    if (/^(broker-docs|broker-admin|broker-docusign)\//.test(value)) return value;
    return null;
  }),
}));

vi.mock("../drizzle/schema", () => ({
  submissions: { id: "id" },
  uploads: { fileKey: "fileKey", uploaderOpenId: "uploaderOpenId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    {
      join: (values: unknown[]) => values,
    }
  ),
}));

import { resolvePlatformUserFromRequest } from "./auth/platformSession";
import { sdk } from "./_core/sdk";

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/submissions", submissionsApiRouter);
  return app;
}

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function makeDb(row: Record<string, unknown> | null, uploadRows: Array<Record<string, unknown>> = []) {
  return {
    select: vi.fn((fields?: Record<string, unknown>) => {
      if (fields && Object.prototype.hasOwnProperty.call(fields, "uploaderOpenId")) {
        return makeSelectBuilder(uploadRows);
      }
      return makeSelectBuilder(row ? [row] : []);
    }),
  };
}

const submissionRow = {
  id: 42,
  formType: "voucher",
  status: "pending",
  reference: "123 Main St",
  submittedBy: "Broker Person",
  submittedByOpenId: "local:broker@example.test",
  submittedByEmail: "broker@example.test",
  createdAt: new Date("2026-05-20T18:00:00.000Z"),
  updatedAt: new Date("2026-05-20T18:05:00.000Z"),
  pdfFileKey: "broker-docs/submissions/voucher/generated.pdf",
  pdfUrl: "https://cdn.example.com/generated.pdf",
  payload: JSON.stringify({
    archivedFile: {
      fileKey: "broker-docs/submissions/voucher/generated.pdf",
      url: "https://cdn.example.com/generated.pdf",
      filename: "Generated Voucher.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      category: "submission_pdf",
    },
    excelFile: {
      fileKey: "broker-docs/submissions/voucher/generated.xlsm",
      url: "https://cdn.example.com/generated.xlsm",
      filename: "Filled Voucher.xlsm",
      fileSize: 4096,
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      category: "voucher_excel",
    },
    supportingFiles: [
      {
        fileKey: "broker-docs/supporting/agency.pdf",
        url: "https://cdn.example.com/agency.pdf",
        filename: "Agency Disclosure.pdf",
        fileSize: 512,
        mimeType: "application/pdf",
        category: "agency_disclosure",
        label: "Agency Disclosure",
      },
    ],
  }),
};

const ownedUploadRows = [
  { uploaderOpenId: "local:broker@example.test" },
];

describe("submissions attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "local:broker@example.test",
      name: "Broker Person",
      email: "broker@example.test",
      loginMethod: "local",
      role: "broker",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    getDbMock.mockResolvedValue(makeDb(submissionRow, ownedUploadRows));
    storageGetBytesMock.mockResolvedValue({
      key: "broker-docs/submissions/voucher/generated.xlsm",
      bytes: Buffer.from("excel-bytes"),
    });
  });

  it("returns generated files and supporting uploads as normalized submission attachments", async () => {
    const res = await request(buildApp()).get("/api/submissions/42");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attachments).toHaveLength(3);
    expect(res.body.data.attachments[0]).toMatchObject({
      title: "Generated submission PDF",
      filename: "Generated Voucher.pdf",
      category: "submission_pdf",
      downloadUrl: "/api/submissions/42/attachments/0/download",
    });
    expect(res.body.data.attachments[1]).toMatchObject({
      title: "Generated Excel Voucher",
      filename: "Filled Voucher.xlsm",
      category: "voucher_excel",
      downloadUrl: "/api/submissions/42/attachments/1/download",
    });
    expect(res.body.data.attachments[2]).toMatchObject({
      title: "Agency Disclosure",
      filename: "Agency Disclosure.pdf",
      category: "agency_disclosure",
    });
  });

  it("downloads stored submission attachments through the dedicated route", async () => {
    const res = await request(buildApp())
      .get("/api/submissions/42/attachments/1/download")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(storageGetBytesMock).toHaveBeenCalledWith("broker-docs/submissions/voucher/generated.xlsm");
    expect(String(res.header["content-type"]).toLowerCase()).toContain("application/vnd.ms-excel.sheet.macroenabled.12");
    expect(res.header["content-disposition"]).toContain('attachment; filename="Filled_Voucher.xlsm"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(Buffer.from(res.body).toString()).toBe("excel-bytes");
  });

  it("rejects a submission attachment key owned by a different broker", async () => {
    const forgedSubmissionRow = {
      ...submissionRow,
      pdfFileKey: null,
      pdfUrl: null,
      payload: JSON.stringify({
        supportingFiles: [
          {
            fileKey: "broker-admin/12/secret.pdf",
            url: "/api/files/content?key=broker-admin%2F12%2Fsecret.pdf",
            filename: "secret.pdf",
            mimeType: "application/pdf",
            category: "inbox",
            label: "Forged admin document",
          },
        ],
      }),
    };
    getDbMock.mockResolvedValue(makeDb(forgedSubmissionRow, [{ uploaderOpenId: "local:other@example.test" }]));

    const res = await request(buildApp()).get("/api/submissions/42/attachments/0/download");

    expect(res.status).toBe(403);
    expect(storageGetBytesMock).not.toHaveBeenCalled();
  });
});
