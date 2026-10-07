import { describe, expect, it } from "vitest";
import {
  SUBMISSION_PAYLOAD_MAX_BYTES,
  SubmissionPayloadTooLargeError,
  assertDealiusPushCanBeStored,
  jsonUtf8ByteLength,
  planDealiusPushPayload,
} from "./dealiusPushPayload";

const pushedAt = "2026-10-07T08:00:00.000Z";

describe("planDealiusPushPayload", () => {
  it("keeps the submitted entry when the payload fits in the text column", () => {
    const plan = planDealiusPushPayload({
      payload: { address: "1 Main", city: "Irvine" },
      result: { dealID: 42, steps: [{ key: "deal", ok: true }] },
      submittedEntry: { address: "1 Main", feePercent: 6 },
      pushedAt,
      entryMode: "deal",
      feePercentOverride: null,
    });

    expect(plan.storedCompact).toBe(false);
    expect(plan.nextPayload.address).toBe("1 Main");
    expect(plan.nextPayload.dealiusPush).toMatchObject({
      dealID: 42,
      entryMode: "deal",
      submittedEntry: { address: "1 Main", feePercent: 6 },
    });
    expect(jsonUtf8ByteLength(plan.nextPayload)).toBeLessThanOrEqual(SUBMISSION_PAYLOAD_MAX_BYTES);
  });

  it("drops the nested entry and still stores the deal id when the full snapshot exceeds TEXT", () => {
    const payload = {
      address: "1 Main",
      body: "x".repeat(60_000),
    };
    const submittedEntry = { notes: "y".repeat(8_000), address: "1 Main" };

    expect(
      jsonUtf8ByteLength({
        ...payload,
        dealiusPush: { dealID: 99, submittedEntry, pushedAt, entryMode: "deal" },
      })
    ).toBeGreaterThan(SUBMISSION_PAYLOAD_MAX_BYTES);

    const plan = planDealiusPushPayload({
      payload,
      result: { dealID: 99, steps: [{ key: "deal", ok: true, detail: "z".repeat(5_000) }] },
      submittedEntry,
      pushedAt,
      entryMode: "deal",
      feePercentOverride: 6,
    });

    expect(() =>
      assertDealiusPushCanBeStored({
        payload,
        entryMode: "deal",
        feePercentOverride: 6,
      })
    ).not.toThrow();

    expect(plan.storedCompact).toBe(true);
    const stored = plan.nextPayload.dealiusPush as Record<string, unknown>;
    expect(stored.dealID).toBe(99);
    expect(stored.submittedEntry).toBeUndefined();
    expect(stored.steps).toBeUndefined();
    expect(plan.nextPayload.body).toBe(payload.body);
    expect(Buffer.byteLength(plan.payloadJson, "utf8")).toBeLessThanOrEqual(SUBMISSION_PAYLOAD_MAX_BYTES);
  });

  it("refuses before an external create when even a compact id record cannot fit", () => {
    const payload = { body: "x".repeat(65_400) };
    expect(() =>
      assertDealiusPushCanBeStored({
        payload,
        entryMode: "deal",
        feePercentOverride: null,
      })
    ).toThrow(SubmissionPayloadTooLargeError);
  });
});
