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

import { getDb, upsertUser } from "./db";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authApiRouter);
  return app;
}

describe("password platform login", () => {
  const originalLocalAdminNames = [...ENV.localAdminNames];

  beforeEach(() => {
    vi.clearAllMocks();
    ENV.localAdminNames = [...originalLocalAdminNames];
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

describe("legacy auth login", () => {
  const originalLocalAdminNames = [...ENV.localAdminNames];

  beforeEach(() => {
    vi.clearAllMocks();
    ENV.localAdminNames = [...originalLocalAdminNames];
    vi.mocked(upsertUser).mockResolvedValue(undefined);
  });

  afterEach(() => {
    ENV.localAdminNames = [...originalLocalAdminNames];
    vi.restoreAllMocks();
  });

  it("does not grant admin from client-supplied name for app_users without a stored name", async () => {
    ENV.localAdminNames = ["trusted admin"];

    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    }));
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "user-1",
                  email: "jdoe@lee-associates.com",
                  username: "jdoe",
                  fullName: "",
                  role: "broker",
                  office: null,
                  isActive: true,
                },
              ]),
          }),
        }),
      }),
      update,
    } as never);

    const res = await request(buildApp()).post("/api/auth/login").send({
      email: "jdoe@lee-associates.com",
      name: "Trusted Admin",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      email: "jdoe@lee-associates.com",
      name: "jdoe@lee-associates.com",
      role: "AGENT",
    });
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "jdoe@lee-associates.com",
        name: "jdoe@lee-associates.com",
        role: "user",
      })
    );
    expect(update).not.toHaveBeenCalled();
  });
});
