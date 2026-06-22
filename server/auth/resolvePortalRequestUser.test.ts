import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { ENV } from "../_core/env";
import { resolvePortalRequestUser } from "./resolvePortalRequestUser";

vi.mock("./platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
  findAppUserByUsernameOrEmail: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  localAuth: {
    toLocalOpenId: (email: string) => `local:${email.trim().toLowerCase()}`,
  },
  sdk: {
    authenticateRequest: vi.fn(),
    verifySession: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "./platformSession";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";

const fakeReq = {} as Request;

describe("resolvePortalRequestUser admin-policy name escalation", () => {
  const originalAdminNames = ENV.localAdminNames;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    ENV.localAdminNames = ["trusted admin"];
  });

  afterEach(() => {
    ENV.localAdminNames = originalAdminNames;
  });

  it("does not grant admin from a legacy session's client-supplied name, even when the stored full name is blank", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "local:broker@lee-associates.com",
      name: "Trusted Admin",
      email: "broker@lee-associates.com",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);
    vi.mocked(getDb).mockResolvedValue({} as never);
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue({
      id: "broker-user-id",
      email: "broker@lee-associates.com",
      username: "broker",
      fullName: "",
      role: "broker",
      office: null,
      phone: null,
      passwordHash: null,
      forcePasswordChangeNextLogin: false,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      deactivatedAt: null,
    } as never);

    const result = await resolvePortalRequestUser(fakeReq);

    expect(result?.role).toBe("user");
  });

  it("does not grant admin from the no-DB fallback session name", async () => {
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("db down"));
    fakeReq.headers = { cookie: "lbt_session=should-not-match; app_session_id=fake.jwt.token" };
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "local:broker@lee-associates.com",
      appId: "lee-broker-tool",
      name: "Trusted Admin",
      email: "broker@lee-associates.com",
    } as never);

    const result = await resolvePortalRequestUser(fakeReq);

    expect(result?.role).toBe("user");
  });
});
