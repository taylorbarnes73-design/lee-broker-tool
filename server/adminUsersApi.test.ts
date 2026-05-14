import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { adminUsersRouter } from "./adminUsersApi";

vi.mock("./auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
  findAppUserByUsernameOrEmail: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { findAppUserByUsernameOrEmail, resolvePlatformUserFromRequest } from "./auth/platformSession";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/users", adminUsersRouter);
  return app;
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue(undefined);
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("no legacy session"));
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for non-admin platform users", async () => {
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue({
      id: "b1",
      email: "b@x.com",
      username: "broker",
      fullName: "B",
      role: "broker",
      office: null,
    });
    const app = buildApp();
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows office admins whose platform session is identified by Lee username", async () => {
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue({
      id: "tbarnes-id",
      email: "tbarnes",
      username: "tbarnes",
      fullName: "Taylor Barnes",
      role: "broker",
      office: null,
    });
    vi.mocked(getDb).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get("/api/admin/users");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NO_DATABASE");
  });

  it("allows username-based admins through legacy sessions", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "local:tbarnes@external.test",
      name: "Taylor Barnes",
      email: "tbarnes@external.test",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(getDb)
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof getDb>>)
      .mockResolvedValueOnce(null);
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue({
      id: "tbarnes-id",
      username: "tbarnes",
      email: "tbarnes@external.test",
      fullName: "Taylor Barnes",
      role: "broker",
      office: null,
      isActive: true,
      inviteToken: null,
      inviteAcceptedAt: null,
      invitedByUserId: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: null,
    });

    const app = buildApp();
    const res = await request(app).get("/api/admin/users");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NO_DATABASE");
  });

  it("keeps valid legacy admin sessions when the app_users lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "local:tbarnes@lee-associates.com",
      name: "Taylor Barnes",
      email: "tbarnes@lee-associates.com",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(getDb)
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof getDb>>)
      .mockResolvedValueOnce(null);
    vi.mocked(findAppUserByUsernameOrEmail).mockRejectedValue(new Error("app_users query failed"));

    const app = buildApp();
    const res = await request(app).get("/api/admin/users");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NO_DATABASE");
  });

  it("returns 503 when database is unavailable", async () => {
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue({
      id: "a1",
      email: "a@x.com",
      username: "admin",
      fullName: "Admin",
      role: "admin",
      office: null,
    });
    vi.mocked(getDb).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NO_DATABASE");
  });
});
