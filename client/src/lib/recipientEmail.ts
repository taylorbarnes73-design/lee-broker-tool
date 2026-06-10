export const DEFAULT_BROKER_ADMIN_EMAIL = "_NewportBeach-BrokerAdmin@lee-associates.com";

export function getBrokerAdminRecipientEmail(supportEmail?: string | null): string {
  const trimmed = String(supportEmail ?? "").trim();
  return trimmed || DEFAULT_BROKER_ADMIN_EMAIL;
}

export function formatBrokerAdminInboxHint(supportEmail?: string | null): string {
  return `Admin inbox: ${getBrokerAdminRecipientEmail(supportEmail)}`;
}
