import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { brokerAdminApiRouter } from "./brokerAdminApi";

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

import {
  findAppUserByUsernameOrEmail,
  resolvePlatformUserFromRequest,
} from "./auth/platformSession";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/broker-admin", brokerAdminApiRouter);
  return app;
}

describe("broker admin REST auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue(undefined);
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(
      new Error("no legacy session")
    );
    vi.mocked(getDb).mockResolvedValue(null);
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

    const res = await request(buildApp()).get("/api/broker-admin/requests");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      error: "Database unavailable",
    });
  });

  it("denies username-based admin policy through legacy sessions", async () => {
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

    const res = await request(buildApp()).get("/api/broker-admin/requests");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("denies legacy sessions for managed app users", async () => {
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
    vi.mocked(getDb).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof getDb>>
    );
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue({
      id: "tbarnes-id",
      username: "tbarnes",
      email: "tbarnes@lee-associates.com",
      fullName: "Taylor Barnes",
      role: "admin",
      office: null,
      isActive: true,
      inviteToken: null,
      inviteAcceptedAt: null,
      invitedByUserId: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: "hash",
    });

    const res = await request(buildApp()).get("/api/broker-admin/requests");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Not authenticated" });
  });
});
