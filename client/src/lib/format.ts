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

/** Plain-language explanation of what "in progress" (in_review) means for brokers. */
export function brokerInReviewExplainer(): string {
  return "A member of the admin team has claimed your submission and is working on it—reviewing details, preparing documents, or coordinating vendors. You usually do not need to do anything unless they reach out.";
}

/** Short broker-facing status phrase (no queue position). */
export function brokerQueueStatusText(status: string | null | undefined): string {
  if (!status) return "Submitted";
  switch (status) {
    case "pending":
      return "Submitted — waiting for the office to start review";
    case "in_review":
      return "In progress — an admin is working on this request";
    case "approved":
    case "closed":
      return "Complete — no further action needed";
    case "rejected":
    case "cancelled":
      return "Not accepted — contact the admin team if you have questions";
    default:
      return formatSubmissionStatus(status);
  }
}

/** Deep link into the legacy HTML broker tool (`?tab=` or hash). */
export function brokerToolTabUrl(tab: "voucher" | "listing" | "sign" | "comp"): string {
  return `/tool?tab=${tab}`;
}

/**
 * Short broker-facing guidance for what happens next on a submission.
 */
export function brokerSubmissionNextSteps(
  status: string | null | undefined,
  formType?: string | null
): string {
  const kind = formatFormType(formType).toLowerCase();
  switch (status) {
    case "pending":
      return `Your ${kind} was submitted and is waiting for review. You'll get an email when an admin starts working on it (if notifications are on).`;
    case "in_review":
      return `In progress means an admin claimed your ${kind} and is processing it. ${brokerInReviewExplainer()}`;
    case "approved":
    case "closed":
      return `This ${kind} is complete. If you need a correction, submit an updated request from the broker tool or email the admin team.`;
    case "rejected":
    case "cancelled":
      return `This ${kind} was not accepted. Check Activity below for context, or contact the admin team to resubmit.`;
    case "waiting_on_broker":
      return `The office needs something from you before they can finish this ${kind}. Reply to their email or submit an update from the broker tool.`;
    default:
      return "Track status here and open the broker tool if you need to submit a new or updated request.";
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
  "sign-request": "Sign request",
  "admin-request": "Admin request",
  listing: "Listing",
  "listing-mod": "Listing modification",
  listing_modification: "Listing modification",
  lease: "Lease",
  sale: "Sale",
  item: "Item",
  comp: "Comp input",
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
