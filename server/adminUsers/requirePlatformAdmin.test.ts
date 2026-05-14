import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { requirePlatformAdmin } from "./requirePlatformAdmin";
import { ENV } from "../_core/env";

vi.mock("../auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
  findAppUserByUsernameOrEmail: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

import { sdk } from "../_core/sdk";
import { findAppUserByUsernameOrEmail, resolvePlatformUserFromRequest } from "../auth/platformSession";

function buildApp() {
  const app = express();
  app.get("/admin-only", requirePlatformAdmin, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("requirePlatformAdmin legacy fallback", () => {
  const originalLocalAdminNames = [...ENV.localAdminNames];

  beforeEach(() => {
    vi.clearAllMocks();
    ENV.localAdminNames = [...originalLocalAdminNames];
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
  });

  afterEach(() => {
    ENV.localAdminNames = [...originalLocalAdminNames];
    vi.restoreAllMocks();
  });

  it("does not grant admin from the legacy JWT display name", async () => {
    ENV.localAdminNames = ["trusted admin"];
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({
      id: 1,
      openId: "local:jdoe@lee-associates.com",
      name: "Trusted Admin",
      email: "jdoe@lee-associates.com",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(findAppUserByUsernameOrEmail).mockResolvedValue({
      id: "user-1",
      email: "jdoe@lee-associates.com",
      username: "jdoe",
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

    const res = await request(buildApp()).get("/admin-only");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
