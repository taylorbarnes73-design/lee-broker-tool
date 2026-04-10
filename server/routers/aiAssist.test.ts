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

describe("aiAssist.smartComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns suggestions for empty fields based on filled context", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              leaseType: "NNN",
              term: "60",
              state: "CA",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.smartComplete({
      currentFields: {
        propertyType: "Industrial",
        city: "Irvine",
        rateSfMo: "1.25",
      },
      tab: "listing",
    });

    expect(result.success).toBe(true);
    expect(result.fields.leaseType).toBe("NNN");
    expect(result.fields.term).toBe("60");
    expect(result.fields.state).toBe("CA");
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

  it("filters out empty suggestions from LLM response", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              leaseType: "NNN",
              term: "",
              state: "  ",
            }),
          },
        },
      ],
    } as any);

    const caller = aiAssistRouter.createCaller(createCtx());
    const result = await caller.smartComplete({
      currentFields: { propertyType: "Industrial" },
      tab: "listing",
    });

    expect(result.fields.leaseType).toBe("NNN");
    expect(result.fields.term).toBeUndefined();
    expect(result.fields.state).toBeUndefined();
  });
});
