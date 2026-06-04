import { describe, expect, it } from "vitest";
import { buildAssignmentPatchForStatusTransition } from "./submissionStatusUpdate";

describe("buildAssignmentPatchForStatusTransition", () => {
  const actor = { openId: "local:tbarnes@lee-associates.com", name: "Taylor Barnes" };

  it("assigns on move to in_review", () => {
    const patch = buildAssignmentPatchForStatusTransition({
      previousStatus: "pending",
      nextStatus: "in_review",
      actor,
    });
    expect(patch.assignedTo).toBe("Taylor Barnes");
    expect(patch.assignedToOpenId).toBe(actor.openId);
    expect(patch.assignedAt).toBeInstanceOf(Date);
  });

  it("records completion on approved", () => {
    const patch = buildAssignmentPatchForStatusTransition({
      previousStatus: "in_review",
      nextStatus: "approved",
      actor,
    });
    expect(patch.completedBy).toBe("Taylor Barnes");
    expect(patch.completedAt).toBeInstanceOf(Date);
  });

  it("returns empty patch when status unchanged", () => {
    const patch = buildAssignmentPatchForStatusTransition({
      previousStatus: "pending",
      nextStatus: "pending",
      actor,
    });
    expect(patch).toEqual({});
  });

  it("respects availableColumns guard", () => {
    const patch = buildAssignmentPatchForStatusTransition({
      previousStatus: "pending",
      nextStatus: "in_review",
      actor,
      availableColumns: new Set(["status", "updatedAt"]),
    });
    expect(patch).toEqual({});
  });
});
