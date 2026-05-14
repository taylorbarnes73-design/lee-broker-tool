import { describe, expect, it } from "vitest";
import { isAdminByPolicy } from "./isAdminByPolicy";

describe("isAdminByPolicy", () => {
  it("recognizes broker-directory admins by full email", () => {
    expect(isAdminByPolicy("tbarnes@lee-associates.com", "Taylor Barnes")).toBe(true);
  });

  it("recognizes broker-directory admins by Lee username", () => {
    expect(isAdminByPolicy("tbarnes", "Taylor Barnes")).toBe(true);
    expect(isAdminByPolicy(null, "Taylor Barnes", "tbarnes")).toBe(true);
  });

  it("does not promote ordinary broker usernames", () => {
    expect(isAdminByPolicy("fadler", "Frank Adler")).toBe(false);
    expect(isAdminByPolicy(null, "Frank Adler", "fadler")).toBe(false);
  });
});
