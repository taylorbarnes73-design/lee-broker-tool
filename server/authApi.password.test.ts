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
    expect(res.body).toEqual({ error: "Sign-in service is temporarily unavailable." });
  });

  it("blocks local login when the matching app user is inactive", async () => {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "inactive-user-id",
                  email: "tbarnes@lee-associates.com",
                  username: "tbarnes",
                  fullName: "Taylor Barnes",
                  role: "admin",
                  office: null,
                  isActive: false,
                },
              ]),
          }),
        }),
      }),
    } as never);

    const res = await request(buildApp()).post("/api/auth/login").send({
      email: "tbarnes",
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: "Your account is inactive. Contact an administrator for access.",
    });
    expect(upsertUser).not.toHaveBeenCalled();
  });
});
