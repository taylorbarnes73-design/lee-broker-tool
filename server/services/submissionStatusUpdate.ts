import type { Request } from "express";
import { eq } from "drizzle-orm";
import { submissions } from "../../drizzle/schema";
import { logSubmissionStatusChange } from "./submissionAudit";
import { maybeNotifySubmissionStatusChange } from "./submissionNotifications";

export const ACTIVE_QUEUE_STATUSES = ["pending", "in_review"] as const;

export type SubmissionStatusActor = {
  openId: string;
  name: string;
  email?: string | null;
  platformUserId?: string | null;
};

export function buildAssignmentPatchForStatusTransition(params: {
  previousStatus: string;
  nextStatus: string;
  actor: SubmissionStatusActor;
  availableColumns?: Set<string> | null;
  now?: Date;
}): Record<string, unknown> {
  if (params.nextStatus === params.previousStatus) return {};

  const now = params.now ?? new Date();
  const has = (column: string) => !params.availableColumns || params.availableColumns.has(column);
  const patch: Record<string, unknown> = {};

  if (params.nextStatus === "in_review") {
    if (has("assignedTo")) patch.assignedTo = params.actor.name;
    if (has("assignedToOpenId")) patch.assignedToOpenId = params.actor.openId;
    if (has("assignedAt")) patch.assignedAt = now;
  } else if (params.nextStatus === "approved" || params.nextStatus === "closed") {
    if (has("completedBy")) patch.completedBy = params.actor.name;
    if (has("completedAt")) patch.completedAt = now;
  }

  return patch;
}

export type ApplySubmissionStatusChangeResult = {
  previousStatus: string;
  nextStatus: string;
  statusChanged: boolean;
  assignmentPatch: Record<string, unknown>;
};

/**
 * Updates submission status with shared assignment side-effects, notifications, and audit logging.
 */
type AppDb = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export async function applySubmissionStatusChange(params: {
  db: AppDb;
  submissionId: number;
  previousStatus: string;
  nextStatus: string;
  actor: SubmissionStatusActor;
  req: Request;
  availableColumns?: Set<string> | null;
}): Promise<ApplySubmissionStatusChangeResult> {
  const now = new Date();
  const assignmentPatch = buildAssignmentPatchForStatusTransition({
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    actor: params.actor,
    availableColumns: params.availableColumns,
    now,
  });

  await params.db
    .update(submissions)
    .set({
      status: params.nextStatus,
      updatedAt: now,
      ...(assignmentPatch as Record<string, unknown>),
    })
    .where(eq(submissions.id, params.submissionId));

  const statusChanged = params.nextStatus !== params.previousStatus;
  if (statusChanged) {
    void maybeNotifySubmissionStatusChange({
      submissionId: params.submissionId,
      previousStatus: params.previousStatus,
      nextStatus: params.nextStatus,
    });
    void logSubmissionStatusChange(params.req, {
      platformUserId: params.actor.platformUserId ?? null,
      actorName: params.actor.name,
      actorOpenId: params.actor.openId,
      submissionId: params.submissionId,
      fromStatus: params.previousStatus,
      toStatus: params.nextStatus,
      assignedTo: (assignmentPatch.assignedTo as string | undefined) ?? null,
      completedBy: (assignmentPatch.completedBy as string | undefined) ?? null,
    });
  }

  return {
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    statusChanged,
    assignmentPatch,
  };
}
