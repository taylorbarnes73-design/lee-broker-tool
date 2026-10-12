import { describe, expect, it } from "vitest";
import {
  buildCellOps,
  excelDateSerial,
  type VoucherExcelData,
} from "./voucherExcel";

function voucher(patch: Partial<VoucherExcelData> = {}): VoucherExcelData {
  return {
    txnType: "Lease",
    propType: "Industrial",
    otherType: "",
    activeListing: "no",
    closeListing: "no",
    confidential: "no",
    dateFilled: "",
    address: "100 Main St",
    city: "Irvine",
    zip: "92618",
    suite: "",
    occType: "",
    dealType: "",
    priorLoc: "",
    dealSf: "",
    submarket: "",
    landSf: "",
    bldgSf: "",
    bldgClass: "",
    yearBuilt: "",
    lsCompany: "",
    lbCompany: "",
    lsContact: "",
    lbContact: "",
    lsEmail: "",
    lbEmail: "",
    lsAddress: "",
    lbAddress: "",
    lsCity: "",
    lbCity: "",
    lsState: "",
    lbState: "",
    lsZip: "",
    lbZip: "",
    lsPhone: "",
    lbPhone: "",
    lStart: "",
    lEnd: "",
    lOcc: "",
    lTerm: "",
    lRate: "",
    lRateType: "",
    lAskingRate: "",
    sPrice: "",
    sBuyerType: "",
    sAsking: "",
    sCap: "",
    sEscrow: "",
    sEscrowCheck: "",
    rentRows: [],
    commBonus: "",
    commConsulting: "",
    sCommPct: "",
    invoiceTo: "lessor",
    invCompany: "",
    invAddress: "",
    invInstructions: "",
    paymentRows: [],
    sameAgent: false,
    laName: "",
    laHouse: "",
    laAddress: "",
    laCity: "",
    laState: "",
    laZip: "",
    laPhone: "",
    laPayFee: "",
    paName: "",
    paHouse: "",
    paAddress: "",
    paCity: "",
    paState: "",
    paZip: "",
    paPhone: "",
    paPayFee: "",
    outsideRows: [],
    distRows: [],
    notes: "",
    ...patch,
  };
}

describe("excelDateSerial", () => {
  it("writes the calendar date the broker entered, including during daylight saving time", () => {
    // Excel serial 46204 is 2026-07-01. A local-midnight conversion in a DST
    // timezone is 46203.9583, which Excel displays as 6/30/2026.
    expect(excelDateSerial("2026-07-01")).toBe(46204);
    expect(excelDateSerial("2026-03-09")).toBe(46090);
    expect(excelDateSerial("2026-11-01")).toBe(46327);
  });

  it("keeps standard-time dates on the same serial", () => {
    expect(excelDateSerial("2026-01-15")).toBe(46037);
    expect(excelDateSerial("2026-12-15")).toBe(46371);
  });

  it("puts those serials on the voucher date cells used for download and submit", () => {
    const ops = buildCellOps(
      voucher({
        dateFilled: "2026-07-01",
        lStart: "2026-03-09",
        lEnd: "2026-11-01",
        lOcc: "2026-01-15",
        paymentRows: [
          { date1: "2026-07-01", amount1: "1000", date2: "", amount2: "" },
        ],
      })
    );
    expect(ops.N2).toEqual({ type: "number", value: 46204 });
    expect(ops.E36).toEqual({ type: "number", value: 46090 });
    expect(ops.H36).toEqual({ type: "number", value: 46327 });
    expect(ops.B38).toEqual({ type: "number", value: 46037 });
    expect(ops.K113).toEqual({ type: "number", value: 46204 });
  });

  it("clears blank and impossible dates", () => {
    expect(excelDateSerial("")).toBeNull();
    expect(excelDateSerial("   ")).toBeNull();
    expect(excelDateSerial("2026-02-31")).toBeNull();
    expect(excelDateSerial("not-a-date")).toBeNull();
  });
});
