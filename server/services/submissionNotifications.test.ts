import { describe, expect, it, vi, beforeEach } from "vitest";

const { getSettingMock, selectMock, sendMailMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  selectMock: vi.fn(),
  sendMailMock: vi.fn().mockResolvedValue({ messageId: "1" }),
}));

vi.mock("../settings/getSetting", () => ({
  getSetting: getSettingMock,
}));

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            selectMock(),
        }),
      }),
    }),
  })),
}));

vi.mock("../_core/env", () => ({
  ENV: {
    smtpHost: "smtp.test",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "user",
    smtpPass: "pass",
    smtpFrom: "noreply@test.com",
  },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock,
    }),
  },
}));

import {
  maybeNotifySubmissionReceived,
  maybeNotifySubmissionStatusChange,
} from "./submissionNotifications";

describe("submissionNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockImplementation(async (key: string) => {
      if (key.startsWith("notifications.")) return true;
      if (key === "branding.company_name") return "Lee Test";
      return "";
    });
    selectMock.mockResolvedValue([
      {
        id: 42,
        formType: "voucher",
        status: "pending",
        reference: "123 Main St",
        submittedByEmail: "broker@lee-associates.com",
      },
    ]);
  });

  it("sends status change email when enabled", async () => {
    await maybeNotifySubmissionStatusChange({
      submissionId: 42,
      previousStatus: "pending",
      nextStatus: "in_review",
    });

    expect(sendMailMock).toHaveBeenCalledOnce();
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.to).toBe("broker@lee-associates.com");
    expect(mail.subject).toContain("Submission update");
    expect(mail.text).toContain("In progress");
    expect(mail.text).toContain("/portal/submissions/42");
  });

  it("skips when status unchanged", async () => {
    await maybeNotifySubmissionStatusChange({
      submissionId: 42,
      previousStatus: "pending",
      nextStatus: "pending",
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("skips when notifications disabled", async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === "notifications.email_on_status_change") return false;
      return "Lee Test";
    });

    await maybeNotifySubmissionStatusChange({
      submissionId: 42,
      previousStatus: "pending",
      nextStatus: "approved",
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends submission received email", async () => {
    await maybeNotifySubmissionReceived(42);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(sendMailMock.mock.calls[0][0].subject).toContain("Submission received");
  });
});
