import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

function makeReq(input: Pick<Request, "protocol" | "headers">): Request {
  return input as Request;
}

describe("getSessionCookieOptions", () => {
  it("marks cookies secure for direct https requests", () => {
    const req = makeReq({ protocol: "https", headers: {} });

    expect(getSessionCookieOptions(req)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("marks cookies insecure for plain http without forwarding headers", () => {
    const req = makeReq({ protocol: "http", headers: {} });

    expect(getSessionCookieOptions(req)).toMatchObject({
      secure: false,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("detects https in comma-separated x-forwarded-proto", () => {
    const req = makeReq({
      protocol: "http",
      headers: { "x-forwarded-proto": "http, https" },
    });

    expect(getSessionCookieOptions(req).secure).toBe(true);
  });

  it("detects https in array x-forwarded-proto values", () => {
    const req = makeReq({
      protocol: "http",
      headers: { "x-forwarded-proto": ["http", " HTTPS "] },
    });

    expect(getSessionCookieOptions(req).secure).toBe(true);
  });
});
