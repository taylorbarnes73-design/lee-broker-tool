import { describe, expect, it } from "vitest";
import { createUserBodySchema, usernameRegex } from "./schemas";

describe("usernameRegex", () => {
  it("accepts tbarnes-style usernames", () => {
    expect(usernameRegex.test("tbarnes")).toBe(true);
    expect(usernameRegex.test("a12")).toBe(true);
  });

  it("rejects uppercase and invalid first char", () => {
    expect(usernameRegex.test("Tbarnes")).toBe(false);
    expect(usernameRegex.test("1x")).toBe(false);
  });
});

describe("createUserBodySchema", () => {
  it("accepts a valid payload", () => {
    const r = createUserBodySchema.safeParse({
      email: "u@lee-associates.com",
      username: "newuser",
      full_name: "New User",
      role: "broker",
      send_invite: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = createUserBodySchema.safeParse({
      email: "not-an-email",
      username: "ab",
      full_name: "X",
      role: "broker",
    });
    expect(r.success).toBe(false);
  });
});
