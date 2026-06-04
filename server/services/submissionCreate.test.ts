import { describe, expect, it } from "vitest";
import { normalizeSubmissionPayload } from "./submissionCreate";

describe("normalizeSubmissionPayload", () => {
  it("stringifies objects", () => {
    expect(normalizeSubmissionPayload({ a: 1 })).toBe('{"a":1}');
  });

  it("passes through existing strings", () => {
    expect(normalizeSubmissionPayload('{"b":2}')).toBe('{"b":2}');
  });
});
