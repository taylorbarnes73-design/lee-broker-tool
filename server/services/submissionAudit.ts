import type { Request } from "express";
import { writeAuditLog } from "../auth/writeAuditLog";

export const SUBMISSION_AUDIT_TARGET = "submission";

export type SubmissionAuditAction =
  | "submission.created"
  | "submission.status_changed"
  | "submission.payload_updated";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In progress",
  approved: "Complete",
  rejected: "Rejected",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function formatSubmissionStatusForAudit(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function describeSubmissionActivity(
  action: string,
  metadata: Record<string, unknown> | null | undefined
): string {
  const meta = metadata ?? {};
  switch (action) {
    case "submission.created":
      return "Submitted to admin queue";
    case "submission.status_changed": {
      const from = String(meta.fromStatus ?? "");
      const to = String(meta.toStatus ?? "");
      if (from && to) {
        return `Status changed from ${formatSubmissionStatusForAudit(from)} to ${formatSubmissionStatusForAudit(to)}`;
      }
      return "Status updated";
    }
    case "submission.payload_updated":
      return "Submission data updated";
    default:
      return action.replace(/\./g, " ").replace(/_/g, " ");
  }
}

export async function logSubmissionAudit(
  req: Request,
  params: {
    platformUserId?: string | null;
    actorName: string;
    actorOpenId?: string | null;
    submissionId: number;
    action: SubmissionAuditAction;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await writeAuditLog(
    params.platformUserId ?? null,
    params.action,
    SUBMISSION_AUDIT_TARGET,
    String(params.submissionId),
    {
      ...(params.metadata ?? {}),
      actorName: params.actorName,
      actorOpenId: params.actorOpenId ?? null,
    },
    req
  );
}

export async function logSubmissionCreated(
  req: Request,
  params: {
    platformUserId?: string | null;
    actorName: string;
    actorOpenId?: string | null;
    submissionId: number;
    formType: string;
    status: string;
  }
): Promise<void> {
  await logSubmissionAudit(req, {
    ...params,
    action: "submission.created",
    metadata: { formType: params.formType, status: params.status },
  });
}

export async function logSubmissionStatusChange(
  req: Request,
  params: {
    platformUserId?: string | null;
    actorName: string;
    actorOpenId?: string | null;
    submissionId: number;
    fromStatus: string;
    toStatus: string;
    assignedTo?: string | null;
    completedBy?: string | null;
  }
): Promise<void> {
  await logSubmissionAudit(req, {
    platformUserId: params.platformUserId,
    actorName: params.actorName,
    actorOpenId: params.actorOpenId,
    submissionId: params.submissionId,
    action: "submission.status_changed",
    metadata: {
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      assignedTo: params.assignedTo ?? null,
      completedBy: params.completedBy ?? null,
    },
  });
}
