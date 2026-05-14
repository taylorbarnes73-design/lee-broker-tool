import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { adminUsersRouter } from "./adminUsersApi";

vi.mock("./auth/platformSession", () => ({
  resolvePlatformUserFromRequest: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { resolvePlatformUserFromRequest } from "./auth/platformSession";
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
