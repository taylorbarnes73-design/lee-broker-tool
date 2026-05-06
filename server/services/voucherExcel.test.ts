import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  isLeeVoucher431Template,
  parseLeeVoucherExcelBuffer,
  parseLeeVoucherGrid,
  submissionPayloadPatchFromParsedVoucher,
} from "./voucherExcel";

function emptyGrid(rows: number, cols: number): unknown[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

describe("parseLeeVoucherGrid", () => {
  it("parses a minimal lease voucher grid", () => {
    const rows = emptyGrid(130, 20);
    rows[3][3] = "Lease";
    rows[8][1] = "100 Industrial Way";
    rows[8][10] = "Irvine";
    rows[8][13] = "92618";
    rows[11][2] = "Landlord LLC";
    rows[11][10] = "Tenant LLC";
    rows[84][2] = "Lee & Associates Newport Beach";
    rows[84][10] = "Other Brokerage";
    rows[42][12] = 6;
    rows[52][0] = 5000;
    rows[52][3] = 12;
    rows[123][0] = "SMITH, JANE";
    rows[123][3] = "Listing";
    rows[123][4] = 50;

    const p = parseLeeVoucherGrid(rows);
    expect(p.isLease).toBe(true);
    expect(p.address).toBe("100 Industrial Way");
    expect(p.city).toBe("Irvine");
    expect(p.zip).toBe("92618");
    expect(p.saleCommPct).toBe(6);
    expect(p.rentRows.length).toBe(1);
    expect(p.rentRows[0].months).toBe(12);
    expect(p.brokers.length).toBe(1);
    expect(p.brokers[0].name).toContain("SMITH");

    const patch = submissionPayloadPatchFromParsedVoucher(p);
    expect(patch.feePercent).toBe(6);
    expect(patch.commissionRate).toBe("6");
    expect(patch.listingAgentName).toBe("SMITH, JANE");
  });

  it("detects v431 template from A34 marker", () => {
    const rows = emptyGrid(140, 20);
    rows[33][0] = "LEASE TRANSACTION DETAILS";
    expect(isLeeVoucher431Template(rows)).toBe(true);
    rows[33][0] = "";
    expect(isLeeVoucher431Template(rows)).toBe(false);
  });

  it("parses v431-style xlsx (buffer path) with B85/J85 houses and rent on row 53", () => {
    const ws: XLSX.WorkSheet = {};
    ws["A34"] = { v: "LEASE TRANSACTION DETAILS", t: "s" };
    ws["A4"] = { v: "Transaction Type", t: "s" };
    ws["B9"] = { v: "555 Broker Ave", t: "s" };
    ws["K9"] = { v: "Costa Mesa", t: "s" };
    ws["N9"] = { v: "92626", t: "s" };
    ws["C12"] = { v: "Lessor Co", t: "s" };
    ws["K12"] = { v: "Lessee Co", t: "s" };
    ws["C85"] = { v: "Lee & Associates Newport Beach", t: "s" };
    ws["K85"] = { v: "Other Brokerage", t: "s" };
    ws["C36"] = { v: 12000, t: "n" };
    ws["A53"] = { v: 2500, t: "n" };
    ws["D53"] = { v: 12, t: "n" };
    ws["M43"] = { v: 4, t: "n" };
    ws["A124"] = { v: "DOE, JANE", t: "s" };
    ws["D124"] = { v: "Listing", t: "s" };
    ws["E124"] = { v: 25, t: "n" };
    ws["!ref"] = "A1:P140";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const p = parseLeeVoucherExcelBuffer(buf);
    expect(p._debug?.template).toBe("v431");
    expect(p.address).toBe("555 Broker Ave");
    expect(p.city).toBe("Costa Mesa");
    expect(p.zip).toBe("92626");
    expect(p.sqft).toBe(12000);
    expect(p.saleCommPct).toBe(4);
    expect(p.rentRows).toHaveLength(1);
    expect(p.rentRows[0].monthly).toBe(2500);
    expect(p.rentRows[0].months).toBe(12);
    expect(p.brokers[0].name).toContain("DOE");

    const patch = submissionPayloadPatchFromParsedVoucher(p);
    expect(patch.excelImport).toMatchObject({ parser: "lee_voucher_excel_v431" });
  });

  it("enters Lee both-side lease vouchers as Landlord Rep", () => {
    const ws: XLSX.WorkSheet = {};
    ws["A34"] = { v: "LEASE TRANSACTION DETAILS", t: "s" };
    ws["B9"] = { v: "777 Dual Side Rd", t: "s" };
    ws["K9"] = { v: "Irvine", t: "s" };
    ws["N9"] = { v: "92618", t: "s" };
    ws["C12"] = { v: "Owner Co", t: "s" };
    ws["K12"] = { v: "Tenant Co", t: "s" };
    ws["C85"] = { v: "Lee & Associates - Newport", t: "s" };
    ws["K85"] = { v: "Lee & Associates - Newport", t: "s" };
    ws["C36"] = { v: 5000, t: "n" };
    ws["A53"] = { v: 1000, t: "n" };
    ws["D53"] = { v: 12, t: "n" };
    ws["M43"] = { v: 6, t: "n" };
    ws["A124"] = { v: "DUAL, BROKER", t: "s" };
    ws["D124"] = { v: "Listing", t: "s" };
    ws["E124"] = { v: 50, t: "n" };
    ws["A125"] = { v: "DUAL, BROKER", t: "s" };
    ws["D125"] = { v: "Procuring", t: "s" };
    ws["E125"] = { v: 50, t: "n" };
    ws["!ref"] = "A1:P140";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const p = parseLeeVoucherExcelBuffer(buf);
    expect(p.repTypeID).toBe(4);
    expect(p.representationType).toBe("Landlord Rep");
    expect(p._debug?.representedBothSides).toBe(true);
  });

  it("does not duplicate suite when address already contains the suite number", () => {
    const rows = emptyGrid(140, 20);
    rows[3][3] = "Lease";
    rows[8][1] = "20201 SW Birch Street, #240";
    rows[8][10] = "Newport Beach";
    rows[8][13] = "92660";
    rows[21][2] = "240";
    rows[11][2] = "Owner LLC";
    rows[11][10] = "Tenant LLC";
    rows[84][10] = "Lee & Associates Newport Beach";
    rows[42][12] = 6;
    rows[52][0] = 1000;
    rows[52][3] = 12;

    const p = parseLeeVoucherGrid(rows);
    expect(p.dealName).toBe("Leased: 20201 SW Birch Street, #240");
  });
});
