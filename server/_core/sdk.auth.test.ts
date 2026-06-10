import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
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
});
