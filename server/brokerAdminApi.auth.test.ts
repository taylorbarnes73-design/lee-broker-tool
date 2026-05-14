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

import { resolvePlatformUserFromRequest } from "./auth/platformSession";
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
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("no legacy session"));
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
    expect(res.body).toMatchObject({ success: false, error: "Database unavailable" });
  });
});
