import { describe, expect, it, vi, beforeEach } from "vitest";
import { aiAssistRouter } from "./aiAssist";
import type { TrpcContext } from "../_core/context";

const { storageGetBytesMock } = vi.hoisted(() => ({
  storageGetBytesMock: vi.fn(),
}));

// Mock the LLM to avoid real API calls in tests
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
  invokeLLMWithFile: vi.fn(),
  isGeminiDirectAvailable: vi.fn().mockReturnValue(false),
  isClaudeFallbackAvailable: vi.fn().mockReturnValue(false),
  invokeClaudeWithFile: vi.fn(),
}));

vi.mock("../storage", () => ({
  storageGetBytes: storageGetBytesMock,
  isStoredFileReference: vi.fn((value: string) =>
    Boolean(
      value?.startsWith("/api/files/content") ||
      value?.startsWith("/local-uploads/") ||
      value?.includes("/api/files/content?key=") ||
      /^(broker-docs|broker-admin|broker-docusign)\//.test(value ?? "")
    )
  ),
}));

// Mock PDF parsing so brochure tests don't need real PDFs.
// The production code uses the default export as a callable: (mod.default ?? mod)(buffer)
const mockPdfParse = vi.fn().mockResolvedValue({
  text: "Mock brochure text: 123 Commerce Way, Irvine CA 92618, 12,500 SF, $1.10/SF/Mo NNN",
});
vi.mock("pdf-parse", () => ({
  default: mockPdfParse,
}));

import { invokeLLM, invokeLLMWithFile, isGeminiDirectAvailable } from "../_core/llm";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("aiAssist.parse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed fields from a listing description", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Industrial",
              transactionType: "Lease",
              rateSfMo: "1.10",
              term: "60",
              city: "Irvine",
              state: "CA",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.parse({
      description: "5-year NNN lease at $1.10/SF/mo on 8,500 SF industrial in Irvine CA",
      tab: "listing",
    });

    expect(result.success).toBe(true);
    expect(result.tab).toBe("listing");
    expect(result.fields).toMatchObject({
      propertyType: "Industrial",
      transactionType: "Lease",
      rateSfMo: "1.10",
      term: "60",
      city: "Irvine",
    });
  });

  it("returns parsed fields from a voucher description", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              representationType: "Tenant Rep",
              clientName: "Acme Corp",
              dealSf: "8500",
              commissionRate: "4",
              transactionType: "Lease",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.parse({
      description: "Tenant rep deal for Acme Corp, 8500 SF, 4% commission",
      tab: "voucher",
    });

    expect(result.success).toBe(true);
    expect(result.fields.representationType).toBe("Tenant Rep");
    expect(result.fields.clientName).toBe("Acme Corp");
    expect(result.fields.dealSf).toBe("8500");
  });

  it("filters out empty string values from LLM response", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Office",
              transactionType: "",
              rateSfMo: "",
              city: "Newport Beach",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.parse({
      description: "Office space in Newport Beach",
      tab: "listing",
    });

    expect(result.fields.propertyType).toBe("Office");
    expect(result.fields.city).toBe("Newport Beach");
    expect(result.fields.transactionType).toBeUndefined();
    expect(result.fields.rateSfMo).toBeUndefined();
  });

  it("keeps Medical as a listing property type from AI responses", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Medical",
              transactionType: "Lease",
              city: "Irvine",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.parse({
      description: "Medical office lease in Irvine",
      tab: "listing",
    });

    expect(result.fields.propertyType).toBe("Medical");
    expect(result.fields.transactionType).toBe("Lease");
  });

  it("handles malformed JSON from LLM gracefully", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json {{{" } }],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.parse({
      description: "Some deal description",
      tab: "comp",
    });

    expect(result.success).toBe(true);
    expect(result.fields).toEqual({});
  });
});

describe("aiAssist.scrapeBrochure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    );
  });

  it("returns extracted fields from a brochure PDF URL", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Industrial",
              address: "123 Commerce Way",
              city: "Irvine",
              state: "CA",
              zip: "92618",
              buildingSf: "12500",
              rateSfMo: "1.10",
              leaseType: "NNN",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.scrapeBrochure({
      fileUrl: "https://example.com/brochure.pdf",
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.tab).toBe("listing");
    expect(result.fields.propertyType).toBe("Industrial");
    expect(result.fields.city).toBe("Irvine");
    expect(result.fields.buildingSf).toBe("12500");
    expect(result.fieldCount).toBe(8);
    expect(mockPdfParse).toHaveBeenCalledTimes(1);
  });

  it("handles image brochure URLs", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Office",
              city: "Newport Beach",
              state: "CA",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.scrapeBrochure({
      fileUrl: "https://example.com/flyer.jpg",
      mimeType: "image/jpeg",
    });

    expect(result.success).toBe(true);
    expect(result.fields.propertyType).toBe("Office");
    expect(result.fields.city).toBe("Newport Beach");
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("filters empty fields from brochure scrape result", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Retail",
              address: "",
              city: "Costa Mesa",
              rateSfMo: "  ",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.scrapeBrochure({
      fileUrl: "https://example.com/retail.pdf",
      mimeType: "application/pdf",
    });

    expect(result.fields.propertyType).toBe("Retail");
    expect(result.fields.city).toBe("Costa Mesa");
    expect(result.fields.address).toBeUndefined();
    expect(result.fields.rateSfMo).toBeUndefined();
  });

  it("handles malformed JSON from brochure scrape gracefully", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.scrapeBrochure({
      fileUrl: "https://example.com/bad.pdf",
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.fields).toEqual({});
    expect(result.fieldCount).toBe(0);
  });
});

describe("aiAssist.extractDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetBytesMock.mockResolvedValue({
      key: "broker-docs/listing_brochure/sample.pdf",
      bytes: Buffer.from("%PDF-sample"),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    );
  });

  it("extracts voucher-shaped fields from an uploaded document", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              transactionType: "Lease",
              representationType: "Tenant Rep",
              clientName: "Acme Logistics",
              dealSf: "12500",
              baseRent: "1.25",
              totalConsideration: "2400000",
              address: "123 Commerce Way",
              city: "Irvine",
              state: "CA",
              zip: "92618",
              buildingSf: "99999",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "https://example.com/voucher.pdf",
      mimeType: "application/pdf",
      tab: "voucher",
    });

    expect(result.success).toBe(true);
    expect(result.tab).toBe("voucher");
    expect(result.fields).toMatchObject({
      transactionType: "Lease",
      representationType: "Tenant Rep",
      clientName: "Acme Logistics",
      dealSf: "12500",
      baseRent: "1.25",
      totalConsideration: "2400000",
      address: "123 Commerce Way",
      city: "Irvine",
      state: "CA",
      zip: "92618",
    });
    expect(result.fields.buildingSf).toBe("99999");
    expect(result.fieldCount).toBe(11);
    expect(mockPdfParse).toHaveBeenCalledTimes(1);
  });

  it("supports image documents for non-listing tabs", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyAddress: "9 Main Street",
              city: "Newport Beach",
              state: "CA",
              requestedBy: "Jane Broker",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "https://example.com/sign-request.png",
      mimeType: "image/png",
      tab: "sign",
    });

    expect(result.success).toBe(true);
    expect(result.tab).toBe("sign");
    expect(result.fields.propertyAddress).toBe("9 Main Street");
    expect(result.fields.requestedBy).toBe("Jane Broker");
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("returns a structured error when document fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "https://example.com/missing.pdf",
      mimeType: "application/pdf",
      tab: "voucher",
    });

    expect(result.success).toBe(false);
    expect(result.fields).toEqual({});
    expect(result.fieldCount).toBe(0);
    expect(result.error).toContain("File fetch failed: 404");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("filters document fields to the requested tab schema", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              propertyType: "Retail",
              address: "55 Coast Highway",
              city: "Newport Beach",
              buildingSf: "12000",
              dealSf: "7500",
              listingAgentName: "Wrong Tab Field",
              brokerName: "Right Comp Field",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "https://example.com/comp-sheet.png",
      mimeType: "image/png",
      tab: "comp",
    });

    expect(result.success).toBe(true);
    expect(result.tab).toBe("comp");
    expect(result.fields).toMatchObject({
      propertyType: "Retail",
      address: "55 Coast Highway",
      city: "Newport Beach",
      buildingSf: "12000",
      dealSf: "7500",
      brokerName: "Right Comp Field",
    });
    expect(result.fields.listingAgentName).toBeUndefined();
    expect(mockPdfParse).not.toHaveBeenCalled();
  });

  it("accepts uploaded proxy URLs and reads bytes from storage", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              transactionType: "Lease",
              clientName: "Proxy URL Client",
            }),
          },
        },
      ],
    } as any);

    const fetchMock = vi.mocked(globalThis.fetch);
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "/api/files/content?key=broker-docs%2Flisting_brochure%2Fsample.pdf",
      mimeType: "application/pdf",
      tab: "voucher",
    });

    expect(result.success).toBe(true);
    expect(result.fields.clientName).toBe("Proxy URL Client");
    expect(storageGetBytesMock).toHaveBeenCalledWith(
      "/api/files/content?key=broker-docs%2Flisting_brochure%2Fsample.pdf"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts absolute proxy URLs and reads bytes from storage", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              transactionType: "Lease",
              clientName: "Absolute Proxy URL Client",
            }),
          },
        },
      ],
    } as any);

    const fetchMock = vi.mocked(globalThis.fetch);
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractDocument({
      fileUrl: "https://broker.example.com/api/files/content?key=broker-docs%2Flisting_brochure%2Fsample.pdf",
      mimeType: "application/pdf",
      tab: "voucher",
    });

    expect(result.success).toBe(true);
    expect(result.fields.clientName).toBe("Absolute Proxy URL Client");
    expect(storageGetBytesMock).toHaveBeenCalledWith(
      "https://broker.example.com/api/files/content?key=broker-docs%2Flisting_brochure%2Fsample.pdf"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns voucher document detection alongside extracted fields", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: {
                transactionType: "Lease",
                clientName: "Detected Client",
              },
              documentDetection: {
                agencyDisclosure: {
                  found: true,
                  executed: false,
                  missingSignatures: ["Principal signature"],
                },
                listingAgreement: {
                  found: false,
                  executed: false,
                  missingSignatures: [],
                },
              },
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractVoucherDocument({
      fileUrl: "https://example.com/voucher-doc.pdf",
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.fields.clientName).toBe("Detected Client");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.documentDetection).toEqual({
      agencyDisclosure: {
        found: true,
        executed: false,
        missingSignatures: ["Principal signature"],
      },
      listingAgreement: {
        found: false,
        executed: false,
        missingSignatures: [],
      },
    });
  });

  it("returns listing document execution detection alongside extracted fields", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: {
                address: "123 Main Street",
                city: "Irvine",
                listingAgentName: "Test Broker",
              },
              documentDetection: {
                agencyDisclosure: {
                  found: true,
                  executed: true,
                  missingSignatures: [],
                },
                listingAgreement: {
                  found: true,
                  executed: false,
                  missingSignatures: ["Property owner/principal"],
                },
              },
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractListingDocument({
      fileUrl: "https://example.com/listing-doc.pdf",
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.fields.address).toBe("123 Main Street");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.documentDetection).toEqual({
      agencyDisclosure: {
        found: true,
        executed: true,
        missingSignatures: [],
      },
      listingAgreement: {
        found: true,
        executed: false,
        missingSignatures: ["Property owner/principal"],
      },
    });
  });

  it("uses Gemini direct file parsing for listing document fields and detection when available", async () => {
    vi.mocked(isGeminiDirectAvailable).mockReturnValueOnce(true);
    vi.mocked(invokeLLMWithFile).mockResolvedValueOnce(
      JSON.stringify({
        fields: {
          address: "16520 Bake Pkwy, Suite 115",
          city: "Irvine",
          listingAgentName: "Stephen A. Madigan",
        },
        documentDetection: {
          agencyDisclosure: { found: false, executed: false, missingSignatures: [] },
          listingAgreement: { found: true, executed: true, missingSignatures: [] },
        },
      })
    );

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractListingDocument({
      fileUrl: "https://example.com/executed-listing-agreement.pdf",
      mimeType: "application/pdf",
    });

    expect(invokeLLMWithFile).toHaveBeenCalledTimes(1);
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.fields.address).toBe("16520 Bake Pkwy, Suite 115");
    expect(result.documentDetection.listingAgreement).toEqual({
      found: true,
      executed: true,
      missingSignatures: [],
    });
  });

  it("uses extracted AIR CRE DocuSign text to recognize executed listing documents", async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: `
        EXCLUSIVE RIGHT TO REPRESENT OWNER FOR SALE OR LEASE OF REAL PROPERTY
        Dr. Marco M. Zahedi Owner Stephen A. Madigan Agent
        Docusign Envelope ID: 784C9DE7-AC3F-4683-8ED8-AE518BCD3D41
        By: Dr. Marco M. Zahedi By: Stephen A. Madigan
        May 20, 2026 | 8:58 AM PDT May 6, 2026 | 4:37 PM PDT
      `,
    });
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: {},
              documentDetection: {
                agencyDisclosure: { found: false, executed: false, missingSignatures: [] },
                listingAgreement: { found: false, executed: false, missingSignatures: [] },
              },
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractListingDocument({
      fileUrl: "https://example.com/exclusive-right.pdf",
      mimeType: "application/pdf",
    });

    expect(result.documentDetection.listingAgreement).toEqual({
      found: true,
      executed: true,
      missingSignatures: [],
    });
  });

  it("uses extracted AIR CRE DocuSign text to recognize executed agency disclosures", async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: `
        DISCLOSURE REGARDING REAL ESTATE AGENCY RELATIONSHIP
        Buyer Dr. Marco M. Zahedi Buyer Agent Lee & Associates - Newport Beach
        Docusign Envelope ID: 784C9DE7-AC3F-4683-8ED8-AE518BCD3D41
        May 20, 2026 | 8:58 AM PDT May 6, 2026 | 4:37 PM PDT
      `,
    });
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: {},
              documentDetection: {
                agencyDisclosure: { found: true, executed: false, missingSignatures: ["Client signature"] },
                listingAgreement: { found: false, executed: false, missingSignatures: [] },
              },
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.extractListingDocument({
      fileUrl: "https://example.com/agency-disclosure.pdf",
      mimeType: "application/pdf",
    });

    expect(result.documentDetection.agencyDisclosure).toEqual({
      found: true,
      executed: true,
      missingSignatures: [],
    });
  });
});

describe("aiAssist.smartComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives directly supported suggestions from the current form state", async () => {
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.smartComplete({
      currentFields: {
        address: "123 Commerce Way, Irvine, California 92618",
      },
      tab: "listing",
    });

    expect(result.success).toBe(true);
    expect(result.fields.city).toBe("Irvine");
    expect(result.fields.state).toBe("CA");
    expect(result.fields.zip).toBe("92618");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("returns message when all fields are already filled", async () => {
    const caller = aiAssistRouter.createCaller(createCtx());
    // Provide all fields filled
    const allFilled = Object.fromEntries(
      ["propertyType","transactionType","address","city","state","zip","rateSfMo",
       "term","leaseType","buildingSf","suiteSf","askingPrice","listingExpiration",
       "dateEntered","ownerName","commissionRate","crossStreets","yearBuilt",
       "listingAgentName","listingAgentLicense","comments"].map(k => [k, "value"])
    );
    const result = await caller.smartComplete({
      currentFields: allFilled,
      tab: "listing",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("already filled");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("returns an explanatory message when there is nothing safe to derive", async () => {
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.smartComplete({
      currentFields: { propertyType: "Industrial" },
      tab: "listing",
    });

    expect(result.fields).toEqual({});
    expect(result.message).toContain("No directly-supported suggestions");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});

describe("aiAssist.reviewVoucher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags deterministic lease issues without calling the LLM", async () => {
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.reviewVoucher({
      dealData: {
        isLease: true,
        isSale: false,
        address: "123 Commerce Way",
        city: "",
        sqft: 8500,
        startDate: "01/15/2026",
        endDate: "01/14/2031",
        term: 72,
        rentRowMonthTotal: 60,
      },
    });

    expect(result.success).toBe(true);
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "City", inputId: "dx_city" }),
        expect.objectContaining({ field: "Term", inputId: "dx_term" }),
        expect.objectContaining({ field: "Rent Schedule", inputId: "dx_term" }),
      ])
    );
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("flags missing sale consideration and commission", async () => {
    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.reviewVoucher({
      dealData: {
        isLease: false,
        isSale: true,
        address: "9 Main Street",
        city: "Newport Beach",
        totalConsideration: 0,
      },
    });

    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "Purchase Price", inputId: "dx_totalConsideration" }),
        expect.objectContaining({ field: "Commission", inputId: "dx_saleCommPct" }),
      ])
    );
  });
});
