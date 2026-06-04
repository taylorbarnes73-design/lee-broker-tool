import type { Request } from "express";
import { submissions } from "../../drizzle/schema";
import { logSubmissionCreated } from "./submissionAudit";
import { maybeNotifySubmissionReceived } from "./submissionNotifications";
import type { SubmissionStatusActor } from "./submissionStatusUpdate";

type AppDb = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export type CreateSubmissionInput = {
  formType: string;
  status?: string;
  payload?: unknown;
  reference?: string | null;
  submittedBy: string;
  submittedByOpenId: string | null;
  submittedByEmail?: string | null;
  pdfFileKey?: string | null;
  pdfUrl?: string | null;
  source?: string;
};

export function normalizeSubmissionPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload ?? {});
}

export async function createSubmissionRecord(params: {
  db: AppDb;
  input: CreateSubmissionInput;
  actor: SubmissionStatusActor;
  req: Request;
}): Promise<{ submissionId: number | null; status: string }> {
  const status = params.input.status?.trim() || "pending";
  const payload = normalizeSubmissionPayload(params.input.payload);

  const [result] = await params.db.insert(submissions).values({
    formType: params.input.formType,
    status,
    payload,
    reference: params.input.reference ?? null,
    submittedBy: params.input.submittedBy,
    submittedByOpenId: params.input.submittedByOpenId,
    submittedByEmail: params.input.submittedByEmail ?? null,
    pdfFileKey: params.input.pdfFileKey ?? null,
    pdfUrl: params.input.pdfUrl ?? null,
    source: params.input.source ?? "tool",
  });

  const submissionId = (result as { insertId?: number }).insertId ?? null;
  if (submissionId) {
    void maybeNotifySubmissionReceived(submissionId);
    void logSubmissionCreated(params.req, {
      platformUserId: params.actor.platformUserId ?? null,
      actorName: params.actor.name,
      actorOpenId: params.actor.openId,
      submissionId,
      formType: params.input.formType,
      status,
    });
  }

  return { submissionId, status };
}
