import { describe, expect, it } from "vitest";
import {
  isBrokerAdminNeedsActionStatus,
  isSubmissionNeedsActionStatus,
  parseNeedsActionQuery,
} from "../shared/needsAction";

describe("needsAction helpers", () => {
  it("parses query flags", () => {
    expect(parseNeedsActionQuery("1")).toBe(true);
    expect(parseNeedsActionQuery("true")).toBe(true);
    expect(parseNeedsActionQuery("")).toBe(false);
  });

  it("classifies submission statuses", () => {
    expect(isSubmissionNeedsActionStatus("pending")).toBe(true);
    expect(isSubmissionNeedsActionStatus("approved")).toBe(false);
  });

  it("classifies broker admin statuses", () => {
    expect(isBrokerAdminNeedsActionStatus("new")).toBe(true);
    expect(isBrokerAdminNeedsActionStatus("done")).toBe(false);
  });
});
