import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { ENV } from "./env";
import * as db from "../db";
import * as platformSession from "../auth/platformSession";

vi.mock("../db", () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("../auth/platformSession", () => ({
  findAppUserByUsernameOrEmail: vi.fn(),
}));

const legacyUser = {
  id: 1,
  openId: "local:inactive@lee-associates.com",
  name: "Inactive User",
  email: "inactive@lee-associates.com",
  loginMethod: "local",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("legacy local session auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserByOpenId).mockResolvedValue(legacyUser);
    vi.mocked(db.getDb).mockResolvedValue({} as never);
  });

  it("rejects a valid JWT when the matching app user is inactive", async () => {
    vi.mocked(platformSession.findAppUserByUsernameOrEmail).mockResolvedValue({
      id: "inactive-user-id",
      email: "inactive@lee-associates.com",
      username: "inactive",
      fullName: "Inactive User",
      role: "broker",
      office: null,
      phone: null,
      passwordHash: null,
      forcePasswordChangeNextLogin: false,
      isActive: false,
      lastLoginAt: null,
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      deactivatedAt: new Date(),
    });

    const token = await sdk.createSessionToken(legacyUser.openId, {
      name: legacyUser.name,
      email: legacyUser.email,
    });
    const req = {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    } as Request;

    await expect(sdk.authenticateRequest(req)).rejects.toThrow("User account is inactive");
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  describe("admin-policy name escalation", () => {
    const originalAdminNames = ENV.localAdminNames;

    beforeEach(() => {
      ENV.localAdminNames = ["trusted admin"];
    });

    afterEach(() => {
      ENV.localAdminNames = originalAdminNames;
    });

    it("does not grant admin from the session's client-supplied name, even when the stored full name is blank", async () => {
      vi.mocked(platformSession.findAppUserByUsernameOrEmail).mockResolvedValue({
        id: "broker-user-id",
        email: legacyUser.email,
        username: "inactive",
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
      });

      const token = await sdk.createSessionToken(legacyUser.openId, {
        name: "Trusted Admin",
        email: legacyUser.email,
      });
      const req = {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
      } as Request;

      const result = await sdk.authenticateRequest(req);
      expect(result.role).toBe("user");
    });
  });
});

describe("OAuth session auth", () => {
  const originalAdminNames = ENV.localAdminNames;
  const oauthUser = {
    ...legacyUser,
    openId: "oauth:broker-user-id",
    name: "Trusted Admin",
    email: "broker@lee-associates.com",
    loginMethod: "oauth",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ENV.localAdminNames = ["trusted admin"];
    vi.mocked(db.getUserByOpenId).mockResolvedValue(oauthUser);
    vi.mocked(platformSession.findAppUserByUsernameOrEmail).mockResolvedValue(undefined);
  });

  afterEach(() => {
    ENV.localAdminNames = originalAdminNames;
  });

  it("does not grant admin from the OAuth profile display name", async () => {
    const token = await sdk.createSessionToken(oauthUser.openId, {
      name: oauthUser.name,
      email: oauthUser.email,
    });
    const req = {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
    } as Request;

    const result = await sdk.authenticateRequest(req);

    expect(result.role).toBe("user");
    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: oauthUser.openId,
        role: "user",
      })
    );
  });
});
