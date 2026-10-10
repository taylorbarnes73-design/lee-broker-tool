import { describe, expect, it } from "vitest";
import { buildVoucherCellOps, type VoucherExcelData } from "./voucherExcel";

function voucher(overrides: Partial<VoucherExcelData> = {}): VoucherExcelData {
  return {
    txnType: "Lease",
    propType: "Industrial",
    otherType: "",
    activeListing: "",
    closeListing: "",
    confidential: "",
    dateFilled: "",
    address: "100 Industrial Way",
    city: "Irvine",
    zip: "92618",
    suite: "",
    occType: "",
    dealType: "",
    priorLoc: "",
    dealSf: "10000",
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
    lTerm: "12",
    lRate: "1.25",
    lRateType: "",
    lAskingRate: "",
    sPrice: "",
    sBuyerType: "",
    sAsking: "",
    sCap: "",
    sEscrow: "",
    sEscrowCheck: "",
    rentRows: [{ monthly: 12500, months: 12, commPct: "" }],
    lCommRate: "6",
    commBonus: "",
    commConsulting: "",
    sCommPct: "",
    invoiceTo: "lessor",
    invCompany: "",
    invAddress: "",
    invInstructions: "",
    paymentRows: [],
    sameAgent: true,
    laName: "Taylor Barnes",
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
    ...overrides,
  };
}

describe("voucher Excel lease commission percent", () => {
  it("writes the header commission rate into a rent row whose Comm % cell is blank", () => {
    const ops = buildVoucherCellOps(voucher());
    // Template L53 = IF(K53>0, K53*F53, ""). A blank K53 drops the lease commission from the invoice.
    expect(ops.K53).toEqual({ type: "number", value: 0.06 });
  });

  it("keeps an explicit rent-row commission percent", () => {
    const ops = buildVoucherCellOps(
      voucher({ rentRows: [{ monthly: 12500, months: 12, commPct: "5" }] })
    );
    expect(ops.K53).toEqual({ type: "number", value: 0.05 });
  });

  it("does not stamp the header rate onto an empty rent row", () => {
    const ops = buildVoucherCellOps(
      voucher({ rentRows: [{ monthly: null, months: null, commPct: "" }] })
    );
    expect(ops.K53).toEqual({ type: "clear" });
  });
});
