import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { submissionsApiRouter } from "./submissionsApi";

vi.mock("./auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  localAuth: {
    normalizeEmail: (value: string) => value.trim().toLowerCase(),
    toLocalOpenId: (email: string) => `local:${email.trim().toLowerCase()}`,
    isEnabled: () => true,
  },
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
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/submissions", submissionsApiRouter);
  return app;
}

describe("submissions REST auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue(null);
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("no legacy session"));
    vi.mocked(getDb).mockResolvedValue(null);
  });

  it("returns 401 when neither portal nor legacy auth is present", async () => {
    const res = await request(buildApp()).get("/api/submissions");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: "Not authenticated" });
  });

  it("accepts platform sessions for the submissions API", async () => {
    vi.mocked(resolvePlatformUserFromRequest).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "tbarnes@lee-associates.com",
      username: "tbarnes",
      fullName: "Taylor Barnes",
      role: "admin",
      office: null,
    });

    const res = await request(buildApp()).get("/api/submissions");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: "Database unavailable" });
    expect(sdk.authenticateRequest).not.toHaveBeenCalled();
  });

  it("keeps accepting legacy broker sessions", async () => {
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

    const res = await request(buildApp()).get("/api/submissions");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: "Database unavailable" });
  });
});
