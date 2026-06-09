import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createLoginContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("auth.login", () => {
  it("accepts a Lee username and creates a broker session", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({ email: "tbarnes" });

    expect(result).toMatchObject({
      success: true,
      user: {
        name: "Taylor Barnes",
        email: "tbarnes@lee-associates.com",
        role: "admin",
      },
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
      },
    });
    expect(cookies[0]?.value).toEqual(expect.any(String));
  });

  it("rejects usernames that are not in the broker roster", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({ email: "unknown-user" });

    expect(result).toEqual({
      success: false,
      error: "Email not recognized. Use your @lee-associates.com email.",
    });
    expect(cookies).toHaveLength(0);
  });

  it("rejects non-Lee email domains", async () => {
    const { ctx, cookies } = createLoginContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({ email: "tbarnes@gmail.com" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("lee-associates.com");
    expect(cookies).toHaveLength(0);
  });
});
