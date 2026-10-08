import { describe, expect, it } from "vitest";
import { commissionPercentPoints, percentPointsToFraction } from "@shared/commissionPercent";

describe("commission percent points", () => {
  it("keeps 1% as 1 and scales only bare fractions below 1", () => {
    expect(commissionPercentPoints(1)).toBe(1);
    expect(commissionPercentPoints("1%")).toBe(1);
    expect(commissionPercentPoints("0.5%")).toBe(0.5);
    expect(commissionPercentPoints(6)).toBe(6);
    expect(commissionPercentPoints(0.06)).toBe(6);
    expect(commissionPercentPoints("")).toBeNull();
  });

  it("writes percent points into an Excel percent-cell fraction", () => {
    expect(percentPointsToFraction("1")).toBe(0.01);
    expect(percentPointsToFraction("4")).toBeCloseTo(0.04);
    expect(percentPointsToFraction("100")).toBe(1);
  });
});
