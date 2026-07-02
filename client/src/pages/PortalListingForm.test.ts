import { describe, expect, it } from "vitest";
import { isListingSupportingFileUrl } from "@/lib/listingSupportingFiles";

describe("isListingSupportingFileUrl", () => {
  it("allows hosted and app-proxy file links", () => {
    expect(
      isListingSupportingFileUrl("https://cdn.example.com/listing.pdf")
    ).toBe(true);
    expect(
      isListingSupportingFileUrl(
        "/api/files/content?key=broker-docs%2Flisting.pdf"
      )
    ).toBe(true);
    expect(
      isListingSupportingFileUrl("/local-uploads/broker-docs/listing.pdf")
    ).toBe(true);
  });

  it("rejects unrelated relative links", () => {
    expect(isListingSupportingFileUrl("/portal/submissions")).toBe(false);
    expect(isListingSupportingFileUrl("listing.pdf")).toBe(false);
  });
});
