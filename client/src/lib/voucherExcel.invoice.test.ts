import { describe, expect, it } from "vitest";
import { buildCellOps, type VoucherExcelData } from "./voucherExcel";

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
    dealSf: "10000",
    submarket: "",
    landSf: "",
    bldgSf: "",
    bldgClass: "",
    yearBuilt: "",
    lsCompany: "Owner LLC",
    lbCompany: "Tenant Co",
    lsContact: "",
    lbContact: "",
    lsEmail: "",
    lbEmail: "",
    lsAddress: "1 Owner Way",
    lbAddress: "",
    lsCity: "Irvine",
    lbCity: "",
    lsState: "CA",
    lbState: "",
    lsZip: "92618",
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
    laName: "Pat Agent",
    laHouse: "Lee & Associates",
    laAddress: "",
    laCity: "",
    laState: "",
    laZip: "",
    laPhone: "",
    laPayFee: "",
    paName: "",
    paHouse: "CBRE",
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

describe("voucher invoice recipient cells", () => {
  it("sets the lessor invoice flag and leaves the different-company line blank", () => {
    const ops = buildCellOps(voucher({ invoiceTo: "lessor", lsCompany: "Owner LLC" }));

    expect(ops.G11).toEqual({ type: "text", value: "y" });
    expect(ops.N11).toEqual({ type: "clear" });
    expect(ops.G84).toEqual({ type: "clear" });
    expect(ops.N84).toEqual({ type: "clear" });
    expect(ops.C12).toEqual({ type: "text", value: "Owner LLC" });
    expect(ops.G109).toEqual({ type: "clear" });
    expect(ops.G110).toEqual({ type: "clear" });
  });

  it("sets the lessee, listing-agent, and procuring-agent flags", () => {
    expect(buildCellOps(voucher({ invoiceTo: "lessee" })).N11).toEqual({ type: "text", value: "y" });
    expect(buildCellOps(voucher({ invoiceTo: "listing_agent" })).G84).toEqual({ type: "text", value: "y" });
    expect(buildCellOps(voucher({ invoiceTo: "procuring_agent" })).N84).toEqual({ type: "text", value: "y" });
    expect(buildCellOps(voucher({ invoiceTo: "listing_agent" })).C85).toEqual({
      type: "text",
      value: "Lee & Associates",
    });
    expect(buildCellOps(voucher({ invoiceTo: "procuring_agent" })).K85).toEqual({ type: "text", value: "CBRE" });
  });

  it("writes a third-party bill-to on the different-company line and sets no party flag", () => {
    const ops = buildCellOps(
      voucher({ invoiceTo: "third_party", invCompany: "Escrow Co", invAddress: "500 Escrow Rd" }),
    );

    expect(ops.G11).toEqual({ type: "clear" });
    expect(ops.N11).toEqual({ type: "clear" });
    expect(ops.G84).toEqual({ type: "clear" });
    expect(ops.N84).toEqual({ type: "clear" });
    expect(ops.G109).toEqual({ type: "text", value: "Escrow Co" });
    expect(ops.G110).toEqual({ type: "text", value: "500 Escrow Rd" });
  });
});
