import { describe, expect, it } from "vitest";
import { fileProxyUrlFromKey, listingSupportingFilesFromDocs } from "./listingSupportingFiles";

describe("listing supporting files", () => {
  it("keeps local stored-file references in the admin submission payload", () => {
    const fileKey = "broker-docs/listing_deal_documents/agreement.pdf";

    expect(fileProxyUrlFromKey(fileKey)).toBe(
      "/api/files/content?key=broker-docs%2Flisting_deal_documents%2Fagreement.pdf"
    );
    expect(
      listingSupportingFilesFromDocs([
        {
          filename: "Exclusive Listing Agreement.pdf",
          url: fileProxyUrlFromKey(fileKey),
          fileKey,
        },
      ])
    ).toEqual([
      {
        filename: "Exclusive Listing Agreement.pdf",
        url: "/api/files/content?key=broker-docs%2Flisting_deal_documents%2Fagreement.pdf",
        fileKey,
        category: "listing_deal_documents",
        label: "Deal Document",
      },
    ]);
  });
});
