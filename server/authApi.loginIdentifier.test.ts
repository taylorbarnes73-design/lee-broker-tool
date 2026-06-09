import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { authApiRouter } from "./authApi";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authApiRouter);
  return app;
}

describe("POST /api/auth/login identifier validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOCAL_AUTH_ENABLED = "true";
  });

  it("rejects non-Lee email domains for password login", async () => {
    const res = await request(buildApp()).post("/api/auth/login").send({
      username_or_email: "tbarnes@gmail.com",
      password: "secret",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("lee-associates.com");
  });

  it("rejects non-Lee email domains for legacy email-only login", async () => {
    const res = await request(buildApp()).post("/api/auth/login").send({
      email: "tbarnes@gmail.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("lee-associates.com");
  });
});
