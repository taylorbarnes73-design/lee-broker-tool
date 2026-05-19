import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { authApiRouter } from "./authApi";

const failingDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.reject(new Error("db down")),
      }),
    }),
  }),
};

function dbWithAppUser(user: { isActive: boolean } | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(user ? [user] : []),
        }),
      }),
    }),
  };
}

vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
}));

import { getDb, upsertUser } from "./db";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authApiRouter);
  return app;
}

describe("password platform login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 503 instead of crashing when the user query fails", async () => {
    vi.mocked(getDb).mockResolvedValue(failingDb as never);

    const res = await request(buildApp()).post("/api/auth/login").send({
      username_or_email: "tbarnes",
      password: "password",
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: "Sign-in service is temporarily unavailable.",
    });
  });

  it("rejects email-only login for managed app users", async () => {
    vi.mocked(getDb).mockResolvedValue(
      dbWithAppUser({ isActive: true }) as never
    );

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "tbarnes" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: "Enter your password to sign in.",
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("rejects email-only login for deactivated app users", async () => {
    vi.mocked(getDb).mockResolvedValue(
      dbWithAppUser({ isActive: false }) as never
    );

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "tbarnes" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "This account has been deactivated. Contact your admin.",
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
