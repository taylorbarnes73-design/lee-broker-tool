import { describe, expect, it } from "vitest";
import { leaseDetailCellOps } from "./voucherExcel";

describe("leaseDetailCellOps", () => {
  it("writes asking rate, NNN components, TI, escalation, and options into the template inputs", () => {
    const ops = leaseDetailCellOps({
      lAskingRate: "1.35",
      lTaxes: "0.10",
      lInsurance: "0.03",
      lMisc: "0.02",
      lTiSf: "15",
      dealSf: "10000",
      lEscPct: "3",
      lOptions: "2 x 5yr",
    });

    expect(ops.C42).toEqual({ type: "number", value: 1.35 });
    expect(ops.F40).toEqual({ type: "number", value: 0.1 });
    expect(ops.F41).toEqual({ type: "number", value: 0.03 });
    expect(ops.F42).toEqual({ type: "number", value: 0.02 });
    expect(ops.J40).toEqual({ type: "number", value: 15 });
    expect(ops.J41).toEqual({ type: "number", value: 150000 });
    expect(ops.C44).toEqual({ type: "number", value: 0.03 });
    expect(ops.C46).toEqual({ type: "text", value: "2 x 5yr" });
    expect(ops.H40).toBeUndefined();
  });

  it("uses the escalation note when the annual increase percent is blank", () => {
    const ops = leaseDetailCellOps({ lEscalations: "3% annual" });
    expect(ops.C44).toEqual({ type: "number", value: 0.03 });
  });

  it("keeps a 1% annual increase at 1 percent", () => {
    const ops = leaseDetailCellOps({ lEscPct: "1" });
    expect(ops.C44).toEqual({ type: "number", value: 0.01 });
  });

  it("omits blank lease-detail cells", () => {
    expect(leaseDetailCellOps({})).toEqual({});
  });
});
