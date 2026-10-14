import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildCellOps, type VoucherExcelData } from "./voucherExcel";

function voucher(overrides: Partial<VoucherExcelData> = {}): VoucherExcelData {
  return {
    txnType: "Lease",
    propType: "Industrial",
    otherType: "",
    activeListing: "no",
    closeListing: "",
    confidential: "no",
    dateFilled: "2026-07-01",
    address: "100 Main",
    city: "Irvine",
    zip: "92618",
    suite: "",
    occType: "Direct",
    dealType: "New",
    priorLoc: "",
    dealSf: "",
    submarket: "",
    landSf: "",
    bldgSf: "",
    bldgClass: "A",
    yearBuilt: "",
    lsCompany: "Owner LLC",
    lbCompany: "Tenant LLC",
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
    lStart: "2026-07-01",
    lEnd: "2031-06-30",
    lOcc: "",
    lTerm: "60",
    lRate: "",
    lRateType: "NNN",
    lAskingRate: "",
    sPrice: "",
    sBuyerType: "",
    sAsking: "",
    sCap: "",
    sEscrow: "",
    sEscrowCheck: "",
    rentRows: [{ monthly: 18750, months: 60, commPct: "6" }],
    commBonus: "",
    commConsulting: "",
    sCommPct: "",
    invoiceTo: "lessor",
    invCompany: "",
    invAddress: "",
    invInstructions: "",
    paymentRows: [],
    sameAgent: false,
    laName: "Taylor Barnes",
    laHouse: "Lee & Associates",
    laAddress: "",
    laCity: "",
    laState: "",
    laZip: "",
    laPhone: "",
    laPayFee: "no",
    paName: "",
    paHouse: "",
    paAddress: "",
    paCity: "",
    paState: "",
    paZip: "",
    paPhone: "",
    paPayFee: "no",
    outsideRows: [],
    distRows: [],
    notes: "",
    ...overrides,
  };
}

describe("voucher rent consideration without deal SF", () => {
  it("template consideration and effective rate divide by deal SF", async () => {
    const template = readFileSync(
      resolve(process.cwd(), "client/public/templates/commission-voucher-template.xlsm")
    );
    const zip = await JSZip.loadAsync(template);
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain("IF(A53&gt;0,D53*C53*$C$36,\"\")");
    expect(xml).toContain("IF(A53&gt;0,A53/$C$36,\"\")");
    expect(xml).toContain('IF(C41="NNN",(F68/D68)/C36,"")');
  });

  it("writes monthly × months when deal SF is blank so the invoice is not #DIV/0!", () => {
    const ops = buildCellOps(voucher());

    expect(ops.C23).toEqual({ type: "clear" });
    expect(ops.A53).toEqual({ type: "number", value: 18750 });
    expect(ops.D53).toEqual({ type: "number", value: 60 });
    expect(ops.K53).toEqual({ type: "number", value: 0.06 });
    expect(ops.F53).toEqual({ type: "number", value: 1_125_000 });
    expect(ops.C53).toEqual({ type: "clear" });
    expect(ops.J42).toEqual({ type: "clear" });
    expect(ops.J43).toEqual({ type: "clear" });
    expect(ops.J44).toEqual({ type: "clear" });
    expect(ops.L53).toBeUndefined();
  });

  it("leaves the template formulas in place when deal SF is present", () => {
    const ops = buildCellOps(voucher({ dealSf: "12500" }));

    expect(ops.C23).toEqual({ type: "number", value: 12500 });
    expect(ops.F53).toBeUndefined();
    expect(ops.C53).toBeUndefined();
    expect(ops.J44).toBeUndefined();
  });

  it("does not invent consideration for free rent or a missing term", () => {
    const ops = buildCellOps(
      voucher({
        rentRows: [
          { monthly: 0, months: 2, commPct: "6" },
          { monthly: 18750, months: null, commPct: "6" },
        ],
      })
    );

    expect(ops.F53).toBeUndefined();
    expect(ops.C53).toBeUndefined();
    expect(ops.F54).toEqual({ type: "clear" });
    expect(ops.C54).toEqual({ type: "clear" });
  });
});
