import { describe, expect, it } from "vitest";
import {
  DEFAULT_BROKER_ADMIN_EMAIL,
  formatBrokerAdminInboxHint,
  getBrokerAdminRecipientEmail,
} from "./recipientEmail";

describe("recipientEmail", () => {
  it("falls back to the Newport Beach broker admin inbox", () => {
    expect(getBrokerAdminRecipientEmail()).toBe(DEFAULT_BROKER_ADMIN_EMAIL);
    expect(getBrokerAdminRecipientEmail("  ")).toBe(DEFAULT_BROKER_ADMIN_EMAIL);
  });

  it("uses configured support_email when present", () => {
    expect(getBrokerAdminRecipientEmail("custom@lee-associates.com")).toBe(
      "custom@lee-associates.com"
    );
  });

  it("formats the broker tool inbox hint copy", () => {
    expect(formatBrokerAdminInboxHint()).toBe(`Admin inbox: ${DEFAULT_BROKER_ADMIN_EMAIL}`);
  });
});
