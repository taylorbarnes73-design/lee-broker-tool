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
  in_review: "In review",
  approved: "Approved",
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

// Nexus muted tone palette: status pills stay legible without ever feeling
// alarming. "Red" is now a muted plum; "green" and "blue" are de-saturated.
const TONE_GREEN: StatusTone = { bg: "#E6EDDB", fg: "#3C6E1F", border: "#C9DABA" };
const TONE_RED: StatusTone = { bg: "#F6E8EE", fg: "#7C2257", border: "#E6CFDC" };
const TONE_BLUE: StatusTone = { bg: "#E2EAF0", fg: "#2F4A66", border: "#C4D1DE" };
const TONE_AMBER: StatusTone = { bg: "#FAEFDC", fg: "#6F4514", border: "#E8D9B6" };
const TONE_PURPLE: StatusTone = { bg: "#ECE6F3", fg: "#4B3A75", border: "#D4C9E3" };
const TONE_GRAY: StatusTone = { bg: "var(--ink-100)", fg: "var(--ink-700)", border: "var(--ink-200)" };

export function submissionStatusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "approved":
    case "closed":
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
      return TONE_GRAY;
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
      return TONE_BLUE;
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
