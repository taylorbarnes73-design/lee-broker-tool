import { describe, expect, it } from "vitest";
import { parseLeeLoginIdentifier } from "./leeLogin";

describe("parseLeeLoginIdentifier", () => {
  it("accepts a Lee username without domain", () => {
    const result = parseLeeLoginIdentifier("TBarnes");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      email: "tbarnes@lee-associates.com",
      username: "tbarnes",
      lookupKey: "tbarnes",
    });
  });

  it("accepts a full Lee email", () => {
    const result = parseLeeLoginIdentifier("tbarnes@lee-associates.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("tbarnes@lee-associates.com");
    expect(result.value.lookupKey).toBe("tbarnes@lee-associates.com");
  });

  it("rejects non-Lee email domains", () => {
    const result = parseLeeLoginIdentifier("tbarnes@gmail.com");
    expect(result).toEqual({
      ok: false,
      error: "Use your @lee-associates.com email or Lee username only (e.g. jsmith).",
    });
  });

  it("rejects malformed identifiers", () => {
    expect(parseLeeLoginIdentifier("@lee-associates.com").ok).toBe(false);
    expect(parseLeeLoginIdentifier("bad user").ok).toBe(false);
    expect(parseLeeLoginIdentifier("").ok).toBe(false);
  });
});
