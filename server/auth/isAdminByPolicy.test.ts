import { describe, expect, it } from "vitest";
import { getTrustedAdminPolicyName, isAdminByPolicy } from "./isAdminByPolicy";

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

describe("getTrustedAdminPolicyName", () => {
  it("prefers a non-empty stored name over the broker directory", () => {
    expect(getTrustedAdminPolicyName("fadler@lee-associates.com", "Stored Name")).toBe("Stored Name");
  });

  it("falls back to the broker-directory entry when the stored name is blank", () => {
    expect(getTrustedAdminPolicyName("fadler@lee-associates.com", "")).toBe("Frank Adler");
    expect(getTrustedAdminPolicyName("fadler@lee-associates.com", undefined)).toBe("Frank Adler");
  });

  it("returns undefined when there is no stored name and no directory match", () => {
    expect(getTrustedAdminPolicyName("unknown@lee-associates.com", undefined)).toBeUndefined();
    expect(getTrustedAdminPolicyName(undefined, undefined)).toBeUndefined();
  });
});
