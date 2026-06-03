import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  execSyncMock,
  storagePutMock,
  dbInsertValuesMock,
  sendMailMock,
} = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
  storagePutMock: vi.fn().mockResolvedValue({
    key: "broker-docs/submissions/listing/test-file.pdf",
    url: "https://cdn.example.com/broker-docs/submissions/listing/test-file.pdf",
  }),
  dbInsertValuesMock: vi.fn().mockResolvedValue([{ insertId: 101 }]),
  sendMailMock: vi.fn().mockResolvedValue({ messageId: "smtp-1" }),
}));

vi.mock("child_process", () => ({
  execSync: execSyncMock,
}));

vi.mock("../services/adminNotification", () => ({
  notifyAdminOfSubmission: vi.fn(),
}));

vi.mock("../storage", () => ({
  storagePut: storagePutMock,
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: dbInsertValuesMock,
    }),
  }),
}));

vi.mock("../settings/getSetting", () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === "branding.company_name") return "Test Company";
    if (key === "branding.support_email") return "support@example.test";
    return "";
  }),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}));

vi.mock("../_core/env", () => ({
  ENV: {
    adminEmail: "admin@example.test",
    forgeApiUrl: "",
    forgeApiKey: "",
    ownerOpenId: "",
    appId: "",
    cookieSecret: "",
    databaseUrl: "",
    oAuthServerUrl: "",
    isProduction: false,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  },
}));

import { execSync } from "child_process";
import { emailRouter } from "./email";

function makeCaller() {
  return emailRouter.createCaller({
    req: {} as any,
    res: {} as any,
    user: {
      openId: "local-test-user",
      name: "Test User",
      email: "testuser@example.test",
      role: "admin",
    },
  } as any);
}

const sampleSections = [
  {
    title: "Property Details",
    fields: [
      { label: "Address", value: "123 Main St" },
      { label: "City", value: "Test City" },
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
    execSyncMock.mockReturnValue(Buffer.from("OK"));
    storagePutMock.mockResolvedValue({
      key: "broker-docs/submissions/listing/test-file.pdf",
      url: "https://cdn.example.com/broker-docs/submissions/listing/test-file.pdf",
    });
    dbInsertValuesMock.mockResolvedValue([{ insertId: 101 }]);
    sendMailMock.mockResolvedValue({ messageId: "smtp-1" });
  });

  it("sends a listing email and records the request", async () => {
    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Test Broker",
      propertyAddress: "123 Main St, Test City",
      sections: sampleSections,
      senderEmail: "testuser@example.test",
    });

    expect(result.success).toBe(true);
    expect(execSync).toHaveBeenCalledOnce();
    expect(dbInsertValuesMock).toHaveBeenCalledOnce();

    const callArg = execSyncMock.mock.calls[0][0] as string;
    expect(callArg).toContain("outlook_send_messages");
    expect(callArg).toContain("admin@example.test");
    expect(result.submissionId).toBe(101);
    expect(result.status).toBe("pending");
  });

  it("includes CC when senderEmail is provided", async () => {
    const caller = makeCaller();
    await caller.sendToAdmin({
      formType: "listing",
      brokerName: "Test Broker",
      propertyAddress: "789 Oak Ave",
      sections: sampleSections,
      senderEmail: "testuser@example.test",
    });

    const callArg = execSyncMock.mock.calls[0][0] as string;
    expect(callArg).toContain("testuser@example.test");
  });

  it("persists supporting upload metadata and includes document links in the email body", async () => {
    const caller = makeCaller();
    const supportingFiles = [
      {
        filename: "Agency Disclosure.pdf",
        url: "https://cdn.example.com/broker-docs/agency_disclosure/disclosure.pdf",
        fileKey: "broker-docs/agency_disclosure/disclosure.pdf",
        category: "agency_disclosure",
        label: "Agency Disclosure",
      },
      {
        filename: "Exclusive Listing Agreement.pdf",
        url: "https://cdn.example.com/broker-docs/listing_agreement/agreement.pdf",
        fileKey: "broker-docs/listing_agreement/agreement.pdf",
        category: "listing_agreement",
        label: "Exclusive Listing Agreement",
      },
    ];

    const result = await caller.sendToAdmin({
      formType: "voucher",
      brokerName: "Test Broker",
      propertyAddress: "456 Commerce Dr",
      sections: sampleSections,
      senderEmail: "testuser@example.test",
      supportingFiles,
    });

    expect(result.success).toBe(true);

    const callArg = execSyncMock.mock.calls[0][0] as string;
    expect(callArg).toContain("Supporting Documents");
    expect(callArg).toContain("Agency Disclosure");
    expect(callArg).toContain("agreement.pdf");

    expect(dbInsertValuesMock).toHaveBeenCalledOnce();
    const insertArg = dbInsertValuesMock.mock.calls[0][0] as Record<string, unknown>;
    const payload = JSON.parse(String(insertArg.payload));
    expect(payload.supportingFiles).toEqual(supportingFiles);
  });

  it("archives the generated PDF and voucher workbook and includes both as attachments for Outlook", async () => {
    const caller = makeCaller();
    storagePutMock
      .mockResolvedValueOnce({
        key: "broker-docs/submissions/voucher/test-file.pdf",
        url: "https://cdn.example.com/broker-docs/submissions/voucher/test-file.pdf",
      })
      .mockResolvedValueOnce({
        key: "broker-docs/submissions/voucher/test-file.xlsm",
        url: "https://cdn.example.com/broker-docs/submissions/voucher/test-file.xlsm",
      });

    const result = await caller.sendToAdmin({
      formType: "voucher",
      brokerName: "Test Broker",
      propertyAddress: "456 Commerce Dr",
      sections: sampleSections,
      senderEmail: "testuser@example.test",
      pdfAttachment: {
        filename: "Voucher Draft.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("pdf-data").toString("base64"),
      },
      excelAttachment: {
        filename: "Filled Voucher.xlsm",
        mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
        base64Data: Buffer.from("excel-data").toString("base64"),
      },
    });

    expect(result.success).toBe(true);
    expect(storagePutMock).toHaveBeenCalledTimes(2);
    expect(result.archivedFile?.url).toContain("https://cdn.example.com/");
    expect(result.excelFile?.url).toContain("https://cdn.example.com/");

    const callArg = execSyncMock.mock.calls[0][0] as string;
    expect(callArg).toContain("Voucher_Draft.pdf");
    expect(callArg).toContain("Filled_Voucher.xlsm");
    expect(callArg).toContain("Generated Excel Voucher");
    expect(callArg).toContain("contentBytes");

    const insertArg = dbInsertValuesMock.mock.calls.find(call => call[0] && "payload" in (call[0] as Record<string, unknown>))?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(insertArg).toBeTruthy();
    if (!insertArg) throw new Error("Expected submission payload insert call");
    const payload = JSON.parse(String(insertArg.payload));
    expect(payload.archivedFile?.filename).toBe("Voucher_Draft.pdf");
    expect(payload.excelFile?.filename).toBe("Filled_Voucher.xlsm");
  });

  it("queues sign submissions without sending an email", async () => {
    const caller = makeCaller();
    const result = await caller.sendToAdmin({
      formType: "sign",
      brokerName: "Test Broker",
      propertyAddress: "200 Commerce Dr, Test City",
      sections: sampleSections,
      senderEmail: "testuser@example.test",
      pdfAttachment: {
        filename: "Sign Request.pdf",
        mimeType: "application/pdf",
        base64Data: Buffer.from("pdf-data").toString("base64"),
      },
    });

    expect(result.success).toBe(true);
    expect(result.attachmentIncluded).toBe(false);
    expect(result.deliveryMethod).toBe("queue-only");
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it("uses SMTP with a true attachment when configured", async () => {
    const envMod = await import("../_core/env");
    const originalHost = (envMod.ENV as any).smtpHost;
    const originalFrom = (envMod.ENV as any).smtpFrom;
    (envMod.ENV as any).smtpHost = "smtp.example.test";
    (envMod.ENV as any).smtpFrom = "ops@example.test";

    try {
      const caller = makeCaller();
      const result = await caller.sendToAdmin({
        formType: "listing",
        brokerName: "Test Broker",
        propertyAddress: "100 Test Center Dr",
        sections: sampleSections,
        senderEmail: "testuser@example.test",
        pdfAttachment: {
          filename: "Listing Packet.pdf",
          mimeType: "application/pdf",
          base64Data: Buffer.from("pdf-data").toString("base64"),
        },
      });

      expect(result.success).toBe(true);
      expect(result.deliveryMethod).toBe("smtp");
      expect(result.attachmentIncluded).toBe(true);
      expect(sendMailMock).toHaveBeenCalledOnce();
      expect(execSyncMock).not.toHaveBeenCalled();

      const smtpCall = sendMailMock.mock.calls[0][0];
      expect(smtpCall.attachments[0].filename).toBe("Listing_Packet.pdf");
    } finally {
      (envMod.ENV as any).smtpHost = originalHost;
      (envMod.ENV as any).smtpFrom = originalFrom;
    }
  });

  it("returns error when adminEmail is not configured", async () => {
    const envMod = await import("../_core/env");
    const original = (envMod.ENV as any).adminEmail;
    (envMod.ENV as any).adminEmail = "";

    try {
      const caller = makeCaller();
      const result = await caller.sendToAdmin({
        formType: "listing",
        brokerName: "Test Broker",
        propertyAddress: "",
        sections: sampleSections,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Admin email not configured");
    } finally {
      (envMod.ENV as any).adminEmail = original;
    }
  });
});
