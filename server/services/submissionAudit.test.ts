import { describe, expect, it } from "vitest";
import { describeSubmissionActivity } from "./submissionAudit";

describe("describeSubmissionActivity", () => {
  it("formats status changes", () => {
    expect(
      describeSubmissionActivity("submission.status_changed", {
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe("Status changed from Pending to In progress");
  });

  it("formats creation", () => {
    expect(describeSubmissionActivity("submission.created", {})).toBe("Submitted to admin queue");
  });
});
