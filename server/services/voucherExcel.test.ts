import fs from "node:fs";
import path from "node:path";
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

  it("keeps Deal SF from C23 when the C36 formula cache is still 0", () => {
    const templatePath = path.resolve("client/public/templates/commission-voucher-template.xlsm");
    const template = fs.readFileSync(templatePath);
    const blank = parseLeeVoucherExcelBuffer(template);
    expect(blank.sqft).toBeNull();
    expect(blank.dealSF).toBeNull();

    const wb = XLSX.read(template, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws["C36"]?.v).toBe(0);
    expect(ws["C36"]?.f).toBe("C23");
    ws["C23"] = { t: "n", v: 12500 };
    ws["B9"] = { t: "s", v: "100 Industrial Way" };
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const parsed = parseLeeVoucherExcelBuffer(buf);
    expect(parsed.sqft).toBe(12500);
    expect(parsed.dealSF).toBe(12500);

    const patch = submissionPayloadPatchFromParsedVoucher(parsed);
    expect(patch.sqft).toBe(12500);
    expect(patch.dealSF).toBe(12500);
  });

  it("uses v431 rent-row commission percent and skips the summary rent row", () => {
    const ws: XLSX.WorkSheet = {};
    ws["A34"] = { v: "LEASE TRANSACTION DETAILS", t: "s" };
    ws["B5"] = { v: "Lease", t: "s" };
    ws["B9"] = { v: "430 32nd Street", t: "s" };
    ws["K9"] = { v: "Newport Beach", t: "s" };
    ws["N9"] = { v: "92663", t: "s" };
    ws["C12"] = { v: "Owner Co", t: "s" };
    ws["K12"] = { v: "Tenant Co", t: "s" };
    ws["C36"] = { v: 2300, t: "n" };
    ws["A53"] = { v: 9200, t: "n" };
    ws["D53"] = { v: 9, t: "n" };
    ws["K53"] = { v: "2.00%", t: "s" };
    ws["A54"] = { v: 0, t: "n" };
    ws["D54"] = { v: 3, t: "n" };
    ws["K54"] = { v: "0.00%", t: "s" };
    ws["A68"] = { v: 38777.47, t: "n" };
    ws["D68"] = { v: 12, t: "n" };
    ws["K68"] = { v: "Comm Due", t: "s" };
    ws["!ref"] = "A1:P140";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const p = parseLeeVoucherExcelBuffer(buf);
    expect(p.saleCommPct).toBe(2);
    expect(p.rentRows).toEqual([
      { monthly: 9200, months: 9, free: false },
      { monthly: 0, months: 3, free: true },
    ]);
    expect(p.term).toBe(12);
  });

  it("maps referral vouchers to Other Rep with flat commission amount and 100% internal fee", () => {
    const ws: XLSX.WorkSheet = {};
    ws["A34"] = { v: "LEASE TRANSACTION DETAILS", t: "s" };
    ws["B5"] = { v: "Referral", t: "s" };
    ws["B9"] = { v: "1652 Deere Ave.", t: "s" };
    ws["K9"] = { v: "Irvine", t: "s" };
    ws["N9"] = { v: "92606", t: "s" };
    ws["C12"] = { v: "SEBCO", t: "s" };
    ws["K12"] = { v: "MAEDA EN USA", t: "s" };
    ws["C36"] = { v: 15802, t: "n" };
    ws["L74"] = { v: 10307.88, t: "n" };
    ws["A124"] = { v: "WEST, THOMAS", t: "s" };
    ws["D124"] = { v: "Listing", t: "s" };
    ws["E124"] = { v: "100.00%", t: "s" };
    ws["!ref"] = "A1:P140";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const p = parseLeeVoucherExcelBuffer(buf);
    expect(p.dealName).toBe("Referred: 1652 Deere Ave.");
    expect(p.repTypeID).toBe(5);
    expect(p.paymentAmount).toBe(10307.88);

    const patch = submissionPayloadPatchFromParsedVoucher(p);
    expect(patch.transactionType).toBe("Referral");
    expect(patch.feePercent).toBe(100);
    expect(patch.internalFeePercent).toBe(100);
    expect(patch.paymentAmount).toBe(10307.88);
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
