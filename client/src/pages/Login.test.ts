import { describe, expect, it } from "vitest";
import { buildLoginRequestBody } from "./Login";

describe("buildLoginRequestBody", () => {
  it("uses the password login payload when a password is provided", () => {
    expect(buildLoginRequestBody(" TBarnes ", " secret ")).toEqual({
      normalizedIdentifier: "tbarnes",
      requestBody: {
        username_or_email: "tbarnes",
        password: "secret",
      },
    });
  });

  it("falls back to the legacy email-only payload when the password is blank", () => {
    expect(buildLoginRequestBody(" TBarnes ", "   ")).toEqual({
      normalizedIdentifier: "tbarnes",
      requestBody: {
        email: "tbarnes",
      },
    });
  });
});
