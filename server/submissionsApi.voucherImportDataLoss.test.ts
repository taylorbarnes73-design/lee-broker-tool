import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import XLSX from "xlsx";
import { submissionsApiRouter } from "./submissionsApi";

const { getDbMock, persistedSetMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  persistedSetMock: vi.fn(),
}));

vi.mock("./auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@lee-associates.com",
    username: "admin",
    fullName: "Voucher Admin",
    role: "admin",
    office: null,
  }),
}));

vi.mock("./_core/sdk", () => ({
  localAuth: {
    normalizeEmail: (value: string) => value.trim().toLowerCase(),
    toLocalOpenId: (email: string) => `local:${email.trim().toLowerCase()}`,
    isEnabled: () => true,
  },
  sdk: {
    authenticateRequest: vi.fn(),
    verifySession: vi.fn(),
  },
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

vi.mock("../drizzle/schema", () => ({
  submissions: { id: "id" },
  uploads: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn((column, value) => ({ column, value })),
  inArray: vi.fn(),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
}));

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/submissions", submissionsApiRouter);
  return app;
}

function minimalVoucherWorkbook(): Buffer {
  const ws: XLSX.WorkSheet = {
    A34: { v: "LEASE TRANSACTION DETAILS", t: "s" },
    B5: { v: "Lease", t: "s" },
    B9: { v: "100 Existing Field Way", t: "s" },
    K9: { v: "Irvine", t: "s" },
    N9: { v: "92618", t: "s" },
    C12: { v: "Landlord LLC", t: "s" },
    K12: { v: "Tenant LLC", t: "s" },
    C85: { v: "Lee & Associates Newport Beach", t: "s" },
    K85: { v: "Other Brokerage", t: "s" },
    "!ref": "A1:P140",
  };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "Voucher");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("POST /api/submissions/:id/import-voucher-excel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const existingPayload = JSON.stringify({
      dealName: "Existing Deal",
      suite: "Suite 900",
      clientContactName: "Existing Contact",
      commissionRate: "6",
      feePercent: 6,
      startDate: "2026-01-01",
      rentRows: [{ monthly: 2500, months: 12, free: false }],
      listingAgentName: "Existing Agent",
      supportingFiles: [{ fileKey: "broker-docs/supporting/control.pdf" }],
    });
    const row = {
      id: 42,
      formType: "voucher",
      payload: existingPayload,
    };
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([row]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: persistedSetMock.mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    getDbMock.mockResolvedValue(db);
  });

  it("preserves existing payload fields when optional Excel cells are blank", async () => {
    const workbook = minimalVoucherWorkbook();
    const response = await request(buildApp())
      .post("/api/submissions/42/import-voucher-excel")
      .send({ filename: "admin-reimport.xlsx", base64Data: workbook.toString("base64") });

    expect(response.status).toBe(200);
    expect(persistedSetMock).toHaveBeenCalledOnce();

    const persistedJson = persistedSetMock.mock.calls[0][0].payload as string;
    const persistedPayload = JSON.parse(persistedJson) as Record<string, unknown>;
    expect(persistedPayload).toHaveProperty("dealName", "Leased: 100 Existing Field Way");
    expect(persistedPayload).toHaveProperty("suite", "Suite 900");
    expect(persistedPayload).toHaveProperty("clientContactName", "Existing Contact");
    expect(persistedPayload).toHaveProperty("commissionRate", "6");
    expect(persistedPayload).toHaveProperty("feePercent", 6);
    expect(persistedPayload).toHaveProperty("startDate", null);
    expect(persistedPayload).toHaveProperty("rentRows", []);
    expect(persistedPayload).toHaveProperty("listingAgentName", "Existing Agent");
    expect(persistedPayload).toHaveProperty("supportingFiles");
  });
});
