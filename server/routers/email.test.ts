import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock execSync so tests never actually call Outlook MCP ──────────────────
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// ─── Mock ENV so we can control adminEmail ───────────────────────────────────
vi.mock("../_core/env", () => ({
  ENV: {
    adminEmail: "admin@lee-associates.com",
    forgeApiUrl: "",
    forgeApiKey: "",
    ownerOpenId: "",
    appId: "",
    cookieSecret: "",
    databaseUrl: "",
    oAuthServerUrl: "",
    isProduction: false,
  },
}));

import { execSync } from "child_process";
import { emailRouter } from "./email";

// Helper: create a minimal tRPC-like caller
function makeCaller() {
  const caller = emailRouter.createCaller({} as any);
  return caller;
}

const sampleSections = [
  {
    title: "Property Details",
    fields: [
      { label: "Address", value: "123 Main St" },
      { label: "City", value: "Newport Beach" },
    ],
  },
  {
    title: "Lease Pricing",
    fields: [
      { label: "Rate ($/SF/Mo)", value: "$1.25" },
      { label: "Lease Type", value: "NNN" },
    ],
  },
];

describe("email.sendToAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (execSync as any).mockReturnValue(Buffer.from("OK"));
  });

  it("sends a listing email and returns success", async () => {
    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Taylor Barnes",
      propertyAddress: "123 Main St, Newport Beach",
      sections: sampleSections,
      senderEmail: "tbarnes@lee-associates.com",
    });

    expect(result.success).toBe(true);
    expect(execSync).toHaveBeenCalledOnce();

    // Verify the MCP call contains the right tool name and recipient
    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("outlook_send_messages");
    expect(callArg).toContain("admin@lee-associates.com");
  });

  it("sends a voucher email and returns success", async () => {
    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "voucher",
      brokerName: "Taylor Barnes",
      propertyAddress: "456 Commerce Dr",
      sections: sampleSections,
      senderEmail: "tbarnes@lee-associates.com",
    });

    expect(result.success).toBe(true);
    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("Commission Voucher");
  });

  it("includes CC when senderEmail is provided", async () => {
    const caller = makeCaller();
    await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Taylor",
      propertyAddress: "789 Oak Ave",
      sections: sampleSections,
      senderEmail: "tbarnes@lee-associates.com",
    });

    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("tbarnes@lee-associates.com");
  });

  it("returns error when adminEmail is not configured", async () => {
    // Temporarily override ENV.adminEmail to empty
    const envMod = await import("../_core/env");
    const original = (envMod.ENV as any).adminEmail;
    (envMod.ENV as any).adminEmail = "";

    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Taylor",
      propertyAddress: "",
      sections: sampleSections,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Admin email not configured");

    // Restore
    (envMod.ENV as any).adminEmail = original;
  });

  it("returns error when execSync throws", async () => {
    (execSync as any).mockImplementation(() => {
      throw new Error("MCP connection failed");
    });

    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "voucher",
      brokerName: "Taylor",
      propertyAddress: "123 Test Blvd",
      sections: sampleSections,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("MCP connection failed");
  });

  it("includes property address in email subject", async () => {
    const caller = makeCaller();
    await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Taylor",
      propertyAddress: "100 Newport Center Dr",
      sections: sampleSections,
    });

    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("100 Newport Center Dr");
  });

  it("sends a sign request email and returns success", async () => {
    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "sign",
      brokerName: "Taylor Barnes",
      propertyAddress: "200 Commerce Dr, Irvine",
      sections: [
        {
          title: "Sign Order Details",
          fields: [
            { label: "Order Type", value: "Installation" },
            { label: "Property Address", value: "200 Commerce Dr" },
          ],
        },
      ],
      senderEmail: "tbarnes@lee-associates.com",
    });

    expect(result.success).toBe(true);
    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("Sign Request");
    expect(callArg).toContain("admin@lee-associates.com");
  });

  it("sign request email subject includes property address", async () => {
    const caller = makeCaller();
    await caller.sendToAdmin({
      formType: "sign",
      brokerName: "Taylor",
      propertyAddress: "555 Industrial Blvd",
      sections: sampleSections,
    });

    const callArg = (execSync as any).mock.calls[0][0] as string;
    expect(callArg).toContain("555 Industrial Blvd");
  });
});
