import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  directoryHintsForBrokerName,
  normDirName,
  parseDealiusUsersReportXlsx,
  stripDirectoryDisplayName,
  type DealiusDirectoryUser,
} from "./dealiusUserDirectory";

describe("dealiusUserDirectory", () => {
  it("parses Dealius Users report layout (header row after title block)", () => {
    const ws: XLSX.WorkSheet = {};
    ws["A1"] = { v: "Users", t: "s" };
    ws["A7"] = { v: "ID", t: "s" };
    ws["B7"] = { v: "Name", t: "s" };
    ws["C7"] = { v: "Roles", t: "s" };
    ws["D7"] = { v: "Office", t: "s" };
    ws["E7"] = { v: "Email Address", t: "s" };
    ws["A8"] = { v: 1011, t: "n" };
    ws["B8"] = { v: "Tim Arguello", t: "s" };
    ws["C8"] = { v: "Broker", t: "s" };
    ws["D8"] = { v: "Lee Newport", t: "s" };
    ws["E8"] = { v: "targuello@lee-associates.com", t: "s" };
    ws["!ref"] = "A1:E10";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const users = parseDealiusUsersReportXlsx(buf);
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe(1011);
    expect(users[0].name).toBe("Tim Arguello");
    expect(users[0].email).toBe("targuello@lee-associates.com");
  });

  it("strips shareholder label and asterisk from directory display names", () => {
    expect(stripDirectoryDisplayName("Chris Barnett (Shareholder)")).toBe("Chris Barnett");
    expect(stripDirectoryDisplayName("John Collins*")).toBe("John Collins");
  });

  it("maps LAST, FIRST voucher strings to directory search terms and boost emails", () => {
    const directory: DealiusDirectoryUser[] = [
      {
        userId: 1011,
        name: "Tim Arguello",
        email: "targuello@lee-associates.com",
        roles: "Broker",
        office: "Newport",
      },
    ];
    const hints = directoryHintsForBrokerName("ARGUELLO, TIM", directory);
    expect(hints.searchTerms).toContain("Tim Arguello");
    expect(hints.searchTerms).toContain("targuello@lee-associates.com");
    expect(hints.boostEmails.has("targuello@lee-associates.com")).toBe(true);
  });

  it("normDirName aligns tokens for comparison", () => {
    expect(normDirName("ARGUELLO, TIM")).toBe("arguello tim");
    expect(normDirName("Tim Arguello")).toBe("tim arguello");
  });
});
