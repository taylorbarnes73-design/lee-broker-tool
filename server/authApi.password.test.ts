import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { authApiRouter } from "./authApi";
import { ENV } from "./_core/env";

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

import { getDb } from "./db";

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
});

describe("legacy auth login admin-policy name escalation", () => {
  const originalAdminNames = ENV.localAdminNames;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    ENV.localAdminNames = ["trusted admin"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ENV.localAdminNames = originalAdminNames;
  });

  function dbWithAppUser(row: Record<string, unknown> | undefined) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(row ? [row] : []),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
    };
  }

  it("does not grant admin from a client-supplied login name, even when the stored full name is blank", async () => {
    vi.mocked(getDb).mockResolvedValue(
      dbWithAppUser({
        id: "user-1",
        email: "fadler@lee-associates.com",
        username: "fadler",
        fullName: "",
        role: "broker",
        office: null,
        isActive: true,
      }) as never
    );

    const res = await request(buildApp()).post("/api/auth/login").send({
      email: "fadler@lee-associates.com",
      name: "Trusted Admin",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("AGENT");
  });

  it("does not grant admin via the broker-directory fallback name either", async () => {
    vi.mocked(getDb).mockResolvedValue(dbWithAppUser(undefined) as never);

    const res = await request(buildApp()).post("/api/auth/login").send({
      email: "fadler@lee-associates.com",
      name: "Trusted Admin",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("AGENT");
  });
});
