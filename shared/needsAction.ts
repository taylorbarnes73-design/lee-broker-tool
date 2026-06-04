/** Submission queue statuses that still need admin attention. */
export const SUBMISSION_NEEDS_ACTION_STATUSES = ["pending", "in_review"] as const;

/** Broker Admin inbox statuses that still need triage or follow-up. */
export const BROKER_ADMIN_NEEDS_ACTION_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "waiting_on_broker",
  "waiting_on_vendor",
] as const;

export type SubmissionNeedsActionStatus = (typeof SUBMISSION_NEEDS_ACTION_STATUSES)[number];
export type BrokerAdminNeedsActionStatus = (typeof BROKER_ADMIN_NEEDS_ACTION_STATUSES)[number];

export function isSubmissionNeedsActionStatus(status: string): boolean {
  return (SUBMISSION_NEEDS_ACTION_STATUSES as readonly string[]).includes(status);
}

export function isBrokerAdminNeedsActionStatus(status: string): boolean {
  return (BROKER_ADMIN_NEEDS_ACTION_STATUSES as readonly string[]).includes(status);
}

export function parseNeedsActionQuery(value: unknown): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}
