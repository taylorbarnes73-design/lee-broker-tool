/**
 * `submissions.payload` is a MySQL TEXT column (65,535 bytes). Dealius push
 * creates a deal or listing before it writes that column. If the follow-up
 * JSON does not fit, the API returns an error while the external record
 * already exists, and the next click creates another one.
 */

export const SUBMISSION_PAYLOAD_MAX_BYTES = 65_535;

const COMPACT_STRING_MAX = 200;
const COMPACT_SPACE_ID_MAX = 20;

export class SubmissionPayloadTooLargeError extends Error {
  readonly code = "SUBMISSION_PAYLOAD_TOO_LARGE";

  constructor() {
    super(
      "This submission is too large to record a Dealius id. Shorten the stored email body or contract text, then try again."
    );
    this.name = "SubmissionPayloadTooLargeError";
  }
}

export function jsonUtf8ByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function capString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.length <= COMPACT_STRING_MAX ? value : value.slice(0, COMPACT_STRING_MAX);
}

function compactResult(result: Record<string, unknown>): Record<string, unknown> {
  const spaceIds = Array.isArray(result.propertySpaceIDs)
    ? result.propertySpaceIDs.slice(0, COMPACT_SPACE_ID_MAX).map(capString)
    : undefined;

  return {
    entryMode: result.entryMode,
    dealID: result.dealID,
    dealName: capString(result.dealName),
    listingID: result.listingID,
    listingName: capString(result.listingName),
    propertyID: result.propertyID,
    propertyName: capString(result.propertyName),
    propertySpaceID: result.propertySpaceID,
    propertySpaceIDs: spaceIds,
    estimatedCloseDate: capString(result.estimatedCloseDate),
    mockMode: result.mockMode,
  };
}

function minimalPushRecord(params: {
  result: Record<string, unknown>;
  pushedAt: string;
  entryMode: string;
}): Record<string, unknown> {
  return {
    entryMode: params.entryMode,
    dealID: params.result.dealID,
    listingID: params.result.listingID,
    propertyID: params.result.propertyID,
    pushedAt: params.pushedAt,
    storedCompact: true,
  };
}

export type DealiusPushStorePlan = {
  nextPayload: Record<string, unknown>;
  payloadJson: string;
  storedCompact: boolean;
};

function payloadWithPush(
  payload: Record<string, unknown>,
  dealiusPush: Record<string, unknown>
): { nextPayload: Record<string, unknown>; payloadJson: string } | null {
  const nextPayload = { ...payload, dealiusPush };
  const payloadJson = JSON.stringify(nextPayload);
  if (Buffer.byteLength(payloadJson, "utf8") > SUBMISSION_PAYLOAD_MAX_BYTES) return null;
  return { nextPayload, payloadJson };
}

export function planDealiusPushPayload(params: {
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  submittedEntry?: Record<string, unknown> | null;
  pushedAt: string;
  entryMode: string;
  feePercentOverride: number | null;
}): DealiusPushStorePlan {
  const meta = {
    pushedAt: params.pushedAt,
    entryMode: params.entryMode,
    feePercentOverride: params.feePercentOverride,
  };

  const fullPush: Record<string, unknown> = { ...params.result, ...meta };
  if (params.submittedEntry && typeof params.submittedEntry === "object") {
    fullPush.submittedEntry = params.submittedEntry;
  }
  const full = payloadWithPush(params.payload, fullPush);
  if (full) return { ...full, storedCompact: false };

  const compactBase: Record<string, unknown> = {
    ...compactResult(params.result),
    ...meta,
    storedCompact: true,
  };
  const warnings = Array.isArray(params.result.warnings) ? params.result.warnings : [];
  for (let kept = warnings.length; kept >= 0; kept -= 1) {
    const dealiusPush = { ...compactBase };
    if (kept > 0) dealiusPush.warnings = warnings.slice(0, kept);
    const compact = payloadWithPush(params.payload, dealiusPush);
    if (compact) return { ...compact, storedCompact: true };
  }

  const minimal = payloadWithPush(params.payload, minimalPushRecord(params));
  if (minimal) return { ...minimal, storedCompact: true };

  throw new SubmissionPayloadTooLargeError();
}

export function assertDealiusPushCanBeStored(params: {
  payload: Record<string, unknown>;
  entryMode: string;
  feePercentOverride: number | null;
}): void {
  const id = "0".repeat(32);
  planDealiusPushPayload({
    payload: params.payload,
    result: {
      entryMode: params.entryMode,
      dealID: id,
      listingID: id,
      propertyID: id,
    },
    submittedEntry: null,
    pushedAt: "2099-12-31T23:59:59.999Z",
    entryMode: params.entryMode,
    feePercentOverride: params.feePercentOverride,
  });
}

export function dealiusCreatedRecordLabel(result: Record<string, unknown>): string {
  if (result.dealID !== undefined && result.dealID !== null && String(result.dealID).trim()) {
    return `deal ${String(result.dealID)}`;
  }
  if (result.listingID !== undefined && result.listingID !== null && String(result.listingID).trim()) {
    return `listing ${String(result.listingID)}`;
  }
  if (result.propertyID !== undefined && result.propertyID !== null && String(result.propertyID).trim()) {
    return `property ${String(result.propertyID)}`;
  }
  return "record";
}
