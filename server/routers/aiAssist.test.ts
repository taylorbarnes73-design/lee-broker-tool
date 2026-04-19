import { describe, expect, it, vi, beforeEach } from "vitest";
import { aiAssistRouter } from "./aiAssist";
import type { TrpcContext } from "../_core/context";

// Mock the LLM to avoid real API calls in tests
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../_core/llm";

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
       "term","leaseType","buildingSf","suiteSf","askingPrice","listingAgentName",
       "listingAgentLicense","comments"].map(k => [k, "value"])
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
