import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { notifyOwner } from "./_core/notification";
import { appRouter } from "./routers";

function createCtx(
  role: "admin" | "user" | null = null
): TrpcContext {
  const user =
    role === null
      ? null
      : ({
          id: 1,
          openId: "user-1",
          email: "user@example.com",
          name: "User",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as NonNullable<TrpcContext["user"]>);

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("system router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok from health endpoint with valid input", async () => {
    const caller = appRouter.createCaller(createCtx());

    const result = await caller.system.health({ timestamp: Date.now() });

    expect(result).toEqual({ ok: true });
  });

  it("rejects invalid health input", async () => {
    const caller = appRouter.createCaller(createCtx());

    await expect(caller.system.health({ timestamp: -1 })).rejects.toThrow(
      /timestamp cannot be negative/
    );
  });

  it("blocks notifyOwner for unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));

    await expect(
      caller.system.notifyOwner({ title: "x", content: "y" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("blocks notifyOwner for non-admin users", async () => {
    const caller = appRouter.createCaller(createCtx("user"));

    await expect(
      caller.system.notifyOwner({ title: "x", content: "y" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: NOT_ADMIN_ERR_MSG,
    });
  });

  it("allows admin users to notify owner", async () => {
    const caller = appRouter.createCaller(createCtx("admin"));
    vi.mocked(notifyOwner).mockResolvedValueOnce(true);

    const result = await caller.system.notifyOwner({
      title: "Notice",
      content: "Message body",
    });

    expect(result).toEqual({ success: true });
    expect(notifyOwner).toHaveBeenCalledWith({
      title: "Notice",
      content: "Message body",
    });
  });
});
