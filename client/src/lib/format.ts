export type StatusTone = {
  bg: string;
  fg: string;
  border: string;
};

export function titleize(input: string): string {
  if (!input) return "";
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In progress",
  approved: "Complete",
  rejected: "Rejected",
  waiting_on_broker: "Waiting on broker",
  waiting_on_admin: "Waiting on admin",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function formatSubmissionStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return SUBMISSION_STATUS_LABELS[status] ?? titleize(status);
}

/**
 * Returns a short broker-facing status phrase.
 * queuePosition is 1-based (1 = next in line, so 0 submissions are ahead).
 * Pass null when position is not available.
 */
export function brokerQueueStatusText(
  status: string | null | undefined,
  queuePosition: number | null
): string {
  if (!status) return "Submitted";
  switch (status) {
    case "pending":
      if (queuePosition !== null && queuePosition > 1) {
        const ahead = queuePosition - 1;
        return `${ahead} submission${ahead === 1 ? "" : "s"} ahead of yours`;
      }
      return "You're next in queue";
    case "in_review":
      return "Your submission is being processed";
    case "approved":
    case "closed":
      return "Completed ✓";
    case "rejected":
    case "cancelled":
      return "Not accepted";
    default:
      return formatSubmissionStatus(status);
  }
}

const BROKER_ADMIN_STATUS_LABELS: Record<string, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_on_broker: "Waiting on broker",
  waiting_on_vendor: "Waiting on vendor",
  done: "Done",
  cancelled: "Cancelled",
};

export function formatBrokerAdminStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return BROKER_ADMIN_STATUS_LABELS[status] ?? titleize(status);
}

const FORM_TYPE_LABELS: Record<string, string> = {
  voucher: "Commission voucher",
  sign: "Sign request",
  listing: "Listing",
  lease: "Lease",
  sale: "Sale",
  item: "Item",
  psa: "Purchase & sale",
  price_change: "Price change",
  amendment: "Amendment",
  docusign: "DocuSign",
  invoice: "Invoice",
  offer: "Offer",
  comp_request: "Comp request",
  activity_report: "Activity report",
  general: "General",
};

export function formatFormType(type: string | null | undefined): string {
  if (!type) return "Unknown";
  return FORM_TYPE_LABELS[type] ?? titleize(type);
}

// Lee brand status pills — refined, semantic, never a scattered red dot.
// Pending/in-review use slate, approved uses navy, completed uses Lee green,
// rejected uses Lee bright-red (always with a text label).
const TONE_GREEN: StatusTone = { bg: "rgba(138, 148, 30, 0.12)", fg: "#6B7517", border: "rgba(138, 148, 30, 0.30)" };
const TONE_RED: StatusTone = { bg: "rgba(205, 20, 66, 0.10)", fg: "#A1102F", border: "rgba(205, 20, 66, 0.28)" };
const TONE_BLUE: StatusTone = { bg: "rgba(0, 49, 70, 0.10)", fg: "#003146", border: "rgba(0, 49, 70, 0.22)" };
const TONE_SLATE: StatusTone = { bg: "rgba(126, 128, 131, 0.10)", fg: "#303C42", border: "rgba(126, 128, 131, 0.26)" };
const TONE_AMBER: StatusTone = { bg: "#FAEFDC", fg: "#6F4514", border: "#E8D9B6" };
const TONE_PURPLE: StatusTone = { bg: "#ECE6F3", fg: "#4B3A75", border: "#D4C9E3" };
const TONE_GRAY: StatusTone = { bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" };

export function submissionStatusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "closed":
    case "approved":
      return TONE_GREEN;
    case "rejected":
    case "cancelled":
      return TONE_RED;
    case "in_review":
      return TONE_BLUE;
    case "waiting_on_broker":
    case "waiting_on_admin":
      return TONE_AMBER;
    case "pending":
      return TONE_SLATE;
    default:
      return TONE_GRAY;
  }
}

export function brokerAdminStatusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "done":
      return TONE_GREEN;
    case "cancelled":
      return TONE_RED;
    case "in_progress":
      return TONE_SLATE;
    case "waiting_on_broker":
    case "waiting_on_vendor":
      return TONE_AMBER;
    case "triaged":
      return TONE_PURPLE;
    case "new":
      return TONE_GRAY;
    default:
      return TONE_GRAY;
  }
}
