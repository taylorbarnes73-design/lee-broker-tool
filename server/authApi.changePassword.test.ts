import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { authApiRouter } from "./authApi";

const compareMock = vi.fn();
const hashMock = vi.fn();
const writeAuditLogMock = vi.fn();

vi.mock("bcryptjs", () => ({
  compare: (...args: unknown[]) => compareMock(...args),
  hash: (...args: unknown[]) => hashMock(...args),
}));

vi.mock("./auth/writeAuditLog", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args),
}));

const selectLimitMock = vi.fn();
const updateWhereMock = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimitMock,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhereMock,
      })),
    })),
  }),
  upsertUser: vi.fn(),
}));

vi.mock("./middleware/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "test@lee-associates.com",
      username: "testuser",
      fullName: "Test User",
      role: "broker",
      office: null,
    };
    next();
  },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authApiRouter);
  return app;
}

describe("PUT /api/auth/me/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitMock.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        passwordHash: "$2a$10$hash",
      },
    ]);
    compareMock.mockResolvedValue(true);
    hashMock.mockResolvedValue("$2a$10$newhash");
  });

  it("updates password when current password is valid", async () => {
    const res = await request(buildApp()).put("/api/auth/me/password").send({
      currentPassword: "old-password",
      newPassword: "new-password-123",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(hashMock).toHaveBeenCalledWith("new-password-123", 10);
    expect(writeAuditLogMock).toHaveBeenCalled();
  });

  it("rejects incorrect current password", async () => {
    compareMock.mockResolvedValue(false);

    const res = await request(buildApp()).put("/api/auth/me/password").send({
      currentPassword: "wrong",
      newPassword: "new-password-123",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Current password");
  });
});
