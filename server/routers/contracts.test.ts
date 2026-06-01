import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ──
const { storageGetBytesMock } = vi.hoisted(() => ({
  storageGetBytesMock: vi.fn(),
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
  invokeLLMWithFile: vi.fn(),
  isGeminiDirectAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../_core/env", () => ({
  ENV: {
    adminEmail: "admin@lee-associates.com",
  },
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

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../fileAccess", () => ({
  requireStoredFileAccess: vi.fn(async (_db: unknown, _user: unknown, key: string) => ({
    key,
    upload: {
      fileKey: key,
      filename: "test.pdf",
      mimeType: "application/pdf",
      uploaderOpenId: "local:test@example.com",
      reference: null,
    },
  })),
}));

import { invokeLLM } from "../_core/llm";
import { execSync } from "child_process";
import { contractsRouter } from "./contracts";

// ── Helpers ──

const mockPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

global.fetch = vi.fn().mockImplementation(async (url: string) => {
  if (url === "https://example.com/test.pdf") {
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => mockPdfBuffer.buffer,
    };
  }
  return {
    ok: false,
    status: 404,
    statusText: "Not Found",
  };
});

/** Call a tRPC mutation directly (no HTTP) */
async function callMutation(procedure: string, input: unknown) {
  const caller = contractsRouter.createCaller({
    user: {
      id: 1,
      openId: "local:test@example.com",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: {},
  } as any);
  return (caller as Record<string, (input: unknown) => Promise<unknown>>)[procedure](input);
}

// ── extractContract tests ──

describe("contracts.extractContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetBytesMock.mockResolvedValue({
      key: "broker-docs/submissions/contracts/test.pdf",
      bytes: mockPdfBuffer,
    });
  });

  it("returns extracted data on successful AI response", async () => {
    const mockData = {
      contractType: "excl-sublease",
      party1Name: "Sinclair Pharma US Inc.",
      propAddress: "18 Technology Drive",
      propCity: "Irvine",
      propState: "CA",
      termStart: "2026-03-24",
      commType: "percent",
      commAmount: "6%",
      arbitration: "AAA",
      redlines: [
        { paragraph: "4.1(b)", type: "strikethrough", note: "Struck through per broker request" },
      ],
    };

    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockData) } }],
    });

    const result = await callMutation("extractContract", {
      pdfUrl: "https://example.com/test.pdf",
      contractType: "excl-sublease",
    }) as { success: boolean; data: typeof mockData; error: null };

    expect(result.success).toBe(true);
    expect(result.data.party1Name).toBe("Sinclair Pharma US Inc.");
    expect(result.data.redlines).toHaveLength(1);
    expect(result.data.redlines[0].paragraph).toBe("4.1(b)");
  });

  it("normalizes date fields to ISO format", async () => {
    const mockData = {
      contractType: "excl-sublease",
      agreementDate: "March 24, 2026",
      termStart: "2026-04-01",
    };

    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockData) } }],
    });

    const result = await callMutation("extractContract", {
      pdfUrl: "https://example.com/test.pdf",
      contractType: "excl-sublease",
    }) as { success: boolean; data: { agreementDate: string; termStart: string }; error: null };

    expect(result.success).toBe(true);
    // agreementDate should be normalized to ISO
    expect(result.data.agreementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.data.termStart).toBe("2026-04-01");
  });

  it("returns error when AI returns invalid JSON", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: "not valid json {{{" } }],
    });

    const result = await callMutation("extractContract", {
      pdfUrl: "https://example.com/test.pdf",
      contractType: "excl-sublease",
    }) as { success: boolean; data: null; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid JSON");
  });

  it("returns error when invokeLLM throws", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("LLM timeout"));

    const result = await callMutation("extractContract", {
      pdfUrl: "https://example.com/test.pdf",
      contractType: "excl-sublease",
    }) as { success: boolean; data: null; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain("LLM timeout");
  });

  it("accepts uploaded file proxy URLs", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contractType: "excl-sublease",
              party1Name: "Proxy Source",
            }),
          },
        },
      ],
    });

    const fetchMock = vi.mocked(global.fetch);
    const result = await callMutation("extractContract", {
      pdfUrl: "/api/files/content?key=broker-docs%2Fsubmissions%2Fcontracts%2Ftest.pdf",
      contractType: "excl-sublease",
    }) as { success: boolean; data: { party1Name?: string } | null; error: string | null };

    expect(result.success).toBe(true);
    expect(result.data?.party1Name).toBe("Proxy Source");
    expect(storageGetBytesMock).toHaveBeenCalledWith(
      "/api/files/content?key=broker-docs%2Fsubmissions%2Fcontracts%2Ftest.pdf"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── submitContractToAdmin tests ──

describe("contracts.submitContractToAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseContractData = {
    contractType: "Exclusive Listing Agreement — Sublease",
    party1Name: "Sinclair Pharma US Inc.",
    propAddress: "18 Technology Drive",
    propCity: "Irvine",
    propState: "CA",
    commAmount: "$25,000",
    arbitration: "AAA",
    redlines: [
      { paragraph: "4.1(b)", type: "strikethrough" as const, note: "Struck through" },
    ],
  };

  it("sends email via MCP and returns success", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from("ok"));

    const result = await callMutation("submitContractToAdmin", {
      contractData: baseContractData,
      brokerName: "Nick Dumke",
      senderEmail: "ndumke@lee-associates.com",
      notes: "Please review redlines carefully.",
    }) as { success: boolean; error: null };

    expect(result.success).toBe(true);
    expect(execSync).toHaveBeenCalledOnce();
    const call = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain("outlook_send_messages");
    expect(call).toContain("Contract Intake");
    expect(call).toContain("Sinclair Pharma");
  });

  it("includes redlines in the email body", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from("ok"));

    await callMutation("submitContractToAdmin", {
      contractData: baseContractData,
      brokerName: "Nick Dumke",
    }) as { success: boolean };

    const call = (execSync as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain("4.1(b)");
    expect(call).toContain("STRIKETHROUGH");
  });

  it("returns error when MCP throws", async () => {
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("MCP connection refused");
    });

    const result = await callMutation("submitContractToAdmin", {
      contractData: baseContractData,
    }) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain("MCP connection failed");
  });

  it("returns error when admin email is not configured", async () => {
    // Temporarily override ENV
    const { ENV } = await import("../_core/env");
    const original = ENV.adminEmail;
    (ENV as { adminEmail: string | undefined }).adminEmail = undefined;

    const result = await callMutation("submitContractToAdmin", {
      contractData: baseContractData,
    }) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain("Admin email not configured");

    (ENV as { adminEmail: string | undefined }).adminEmail = original;
  });
});
