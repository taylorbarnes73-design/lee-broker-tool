import { beforeEach, describe, expect, it, vi } from "vitest";
import { submissionsRouter } from "./submissions";
import { testCtx } from "../testCtx";

const { getDbMock, createSubmissionRecordMock, applySubmissionStatusChangeMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  createSubmissionRecordMock: vi.fn(),
  applySubmissionStatusChangeMock: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: getDbMock,
}));

vi.mock("../services/submissionCreate", () => ({
  createSubmissionRecord: createSubmissionRecordMock,
}));

vi.mock("../services/submissionStatusUpdate", () => ({
  applySubmissionStatusChange: applySubmissionStatusChangeMock,
}));

vi.mock("../services/adminNotification", () => ({
  notifyAdminOfSubmission: vi.fn(),
}));

vi.mock("../services/compData", () => ({
  addSingleComp: vi.fn(),
}));

vi.mock("../auth/platformSession", () => ({
  findAppUserByUsernameOrEmail: vi.fn().mockResolvedValue(null),
}));

vi.mock("../storage", () => ({
  normalizeStoredFileUrl: vi.fn((url: string | null) => url),
}));

const SUBMISSION_COLUMNS = [
  "id",
  "formType",
  "status",
  "payload",
  "reference",
  "submittedBy",
  "submittedByOpenId",
  "submittedByEmail",
  "pdfFileKey",
  "pdfUrl",
  "source",
  "source_email_message_id",
  "source_email_web_link",
  "parsed_fields",
  "assignedTo",
  "assignedToOpenId",
  "assignedAt",
  "completedBy",
  "completedAt",
  "createdAt",
  "updatedAt",
];

const sampleRow = {
  id: 1,
  formType: "voucher",
  status: "pending",
  payload: '{"type":"voucher"}',
  reference: "123 Main St",
  submittedBy: "Test User",
  submittedByOpenId: "local:test-user",
  submittedByEmail: "test@lee-associates.com",
  pdfFileKey: null,
  pdfUrl: null,
  source: "tool",
  sourceEmailMessageId: null,
  sourceEmailWebLink: null,
  parsedFields: null,
  assignedTo: null,
  assignedToOpenId: null,
  assignedAt: null,
  completedBy: null,
  completedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeDb(rows: typeof sampleRow[] = [sampleRow]) {
  return {
    execute: vi.fn(async (query: { sql?: string } | string) => {
      const sql = String(typeof query === "object" && query && "sql" in query ? query.sql : query);
      if (sql.includes("show columns")) {
        return SUBMISSION_COLUMNS.map(column => ({ Field: column }));
      }
      return rows;
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: rows.length }]),
      })),
    })),
  };
}

describe("submissionsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue(makeDb());
    createSubmissionRecordMock.mockResolvedValue({ submissionId: 42 });
    applySubmissionStatusChangeMock.mockResolvedValue(undefined);
  });

  it("create stores a submission for the signed-in broker", async () => {
    const caller = submissionsRouter.createCaller(testCtx());
    const result = await caller.create({
      type: "voucher",
      address: "123 Main St",
      city: "Newport Beach",
    });

    expect(result).toEqual({ success: true, stored: true, submissionId: 42 });
    expect(createSubmissionRecordMock).toHaveBeenCalledOnce();
  });

  it("create ignores client-supplied status and always queues broker submissions as pending", async () => {
    const caller = submissionsRouter.createCaller(testCtx({ role: "user" }));

    await caller.create({
      type: "marketing-request",
      status: "approved",
      address: "123 Main St",
    });

    expect(createSubmissionRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          status: "pending",
        }),
      })
    );
  });

  it("create returns error when database is unavailable", async () => {
    getDbMock.mockResolvedValue(null);
    const caller = submissionsRouter.createCaller(testCtx());
    const result = await caller.create({ type: "voucher" });
    expect(result).toEqual({ success: false, stored: false, error: "Database unavailable" });
  });

  it("byId returns submission for owner", async () => {
    const caller = submissionsRouter.createCaller(testCtx());
    const result = await caller.byId({ id: 1 });
    expect(result.id).toBe(1);
    expect(result.formType).toBe("voucher");
  });

  it("byId rejects access for another broker", async () => {
    const caller = submissionsRouter.createCaller(
      testCtx({ openId: "local:other@lee-associates.com", role: "user" })
    );
    await expect(caller.byId({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("adminList requires admin role", async () => {
    const caller = submissionsRouter.createCaller(testCtx({ role: "user" }));
    await expect(caller.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adminList returns submissions for admin", async () => {
    const caller = submissionsRouter.createCaller(testCtx({ role: "admin" }));
    const rows = await caller.adminList();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(1);
  });

  it("mine returns normalized broker submissions", async () => {
    const caller = submissionsRouter.createCaller(testCtx());
    const rows = await caller.mine({ limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(1);
    expect(rows[0]?.formType).toBe("voucher");
    expect(rows[0]?.reference).toBe("123 Main St");
    expect(rows[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("updateStatus applies status change for admin", async () => {
    const caller = submissionsRouter.createCaller(testCtx({ role: "admin" }));
    const result = await caller.updateStatus({ id: 1, status: "approved" });
    expect(result).toEqual({ success: true });
    expect(applySubmissionStatusChangeMock).toHaveBeenCalledOnce();
  });

  it("updateStatus rejects non-admin users", async () => {
    const caller = submissionsRouter.createCaller(testCtx({ role: "user" }));
    await expect(caller.updateStatus({ id: 1, status: "approved" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
