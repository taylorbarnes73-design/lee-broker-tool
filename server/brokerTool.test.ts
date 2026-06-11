import {
  LISTING_AI_FIELD_KEYS,
  SIGN_AI_FIELD_KEYS,
  VOUCHER_AI_FIELD_KEYS,
} from "@shared/quickConvert";
import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireCommissionVoucherTemplatePath } from "./lib/bundledAssets";

const brokerToolHtml = readFileSync(
  resolve(process.cwd(), "client/public/broker_tool.html"),
  "utf8"
);

// features_patch.js contains additional function definitions (as window.X = function(...))
// referenced by onclick handlers added in broker_tool.html.
const featuresPatchJs = readFileSync(
  resolve(process.cwd(), "client/public/features_patch.js"),
  "utf8"
);

function collectMatches(pattern: RegExp) {
  return [...brokerToolHtml.matchAll(pattern)].map(match => match[1]);
}

function collectDefinedFunctions(): Set<string> {
  const defined = new Set<string>();
  // Named function declarations: function foo(
  for (const m of brokerToolHtml.matchAll(/\bfunction\s+([A-Za-z0-9_]+)\s*\(/g)) {
    defined.add(m[1]);
  }
  for (const m of featuresPatchJs.matchAll(/\bfunction\s+([A-Za-z0-9_]+)\s*\(/g)) {
    defined.add(m[1]);
  }
  // window.foo = function( or window.foo = async function(
  for (const m of featuresPatchJs.matchAll(/window\.([A-Za-z0-9_]+)\s*=\s*(?:async\s+)?function\s*\(/g)) {
    defined.add(m[1]);
  }
  return defined;
}

function extractFunctionSource(name: string) {
  const start = brokerToolHtml.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`Missing function ${name}`);
  const bodyStart = brokerToolHtml.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < brokerToolHtml.length; i++) {
    const char = brokerToolHtml[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return brokerToolHtml.slice(start, i + 1);
  }
  throw new Error(`Could not parse function ${name}`);
}

function extractConstObjectSource(name: string) {
  const start = brokerToolHtml.indexOf(`const ${name} = {`);
  if (start === -1) throw new Error(`Missing const ${name}`);
  const bodyStart = brokerToolHtml.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < brokerToolHtml.length; i++) {
    const char = brokerToolHtml[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return brokerToolHtml.slice(bodyStart, i + 1);
  }
  throw new Error(`Could not parse const ${name}`);
}

function getAiFieldMap(): Record<string, Record<string, string>> {
  return new Function(`return (${extractConstObjectSource("AI_FIELD_MAP")});`)();
}

function getVoucherRentRowHelpers() {
  const source = [
    "vRentRowMonthly",
    "vRentRowMonths",
    "vRentRowCommissionRate",
    "vRentRowCommissionDue",
  ]
    .map(extractFunctionSource)
    .join("\n");
  return new Function(
    "document",
    `${source}\nreturn { vRentRowMonthly, vRentRowMonths, vRentRowCommissionRate, vRentRowCommissionDue };`
  ) as (doc: unknown) => {
    vRentRowMonthly: (tr: unknown) => number;
    vRentRowMonths: (tr: unknown) => number;
    vRentRowCommissionRate: (tr: unknown) => number;
    vRentRowCommissionDue: (tr: unknown) => number;
  };
}

/** Minimal stand-in for a rent schedule <tr> as read by the calc helpers. */
function fakeRentRow(fields: {
  monthly?: string;
  months?: string;
  free?: boolean;
  commPct?: string;
  commDue?: string;
  commDueOverride?: boolean;
}) {
  const cells: Record<string, unknown> = {
    ".rent-monthly": fields.monthly != null ? { value: fields.monthly } : null,
    ".rent-months": fields.months != null ? { value: fields.months } : null,
    ".rent-free": fields.free != null ? { checked: fields.free } : null,
    ".rent-comm-pct-input":
      fields.commPct != null ? { value: fields.commPct } : null,
    ".rent-comm-due-input":
      fields.commDue != null
        ? {
            value: fields.commDue,
            dataset: { override: fields.commDueOverride ? "1" : undefined },
          }
        : null,
  };
  return { querySelector: (selector: string) => cells[selector] ?? null };
}

function getVoucherDetectionHelpers() {
  const source = [
    "createEmptyVoucherDocStatus",
    "normalizeVoucherDocStatus",
    "combineVoucherDocumentStatus",
  ]
    .map(extractFunctionSource)
    .join("\n");
  return new Function(
    `${source}\nreturn { combineVoucherDocumentStatus };`
  )() as {
    combineVoucherDocumentStatus: (
      current: unknown,
      next: unknown
    ) => { found: boolean; executed: boolean; missingSignatures: string[] };
  };
}

function getAiApplyHelpers() {
  const source = [
    "normalizeAiSelectText",
    "findSelectOptionForAiValue",
    "shouldApplyAiField",
  ]
    .map(extractFunctionSource)
    .join("\n");
  return new Function(
    `${source}\nreturn { normalizeAiSelectText, findSelectOptionForAiValue, shouldApplyAiField };`
  )() as {
    findSelectOptionForAiValue: (
      select: { options: Array<{ value: string; textContent: string }> },
      value: string
    ) => { value: string; textContent: string } | undefined;
    shouldApplyAiField: (
      tab: string,
      key: string,
      el: {
        classList: { contains: (className: string) => boolean };
        getAttribute: (name: string) => string | null;
      },
      oldVal: string
    ) => boolean;
  };
}

describe("broker_tool.html wiring", () => {
  it("keeps every inline onclick handler bound to a real function", () => {
    const handlers = collectMatches(/onclick="([A-Za-z0-9_]+)\(/g);
    // Collect from broker_tool.html inline scripts AND features_patch.js
    // (both named function declarations and window.X = function(...) assignments)
    const definedFunctions = collectDefinedFunctions();

    const missingHandlers = [...new Set(handlers)].filter(
      handler => !definedFunctions.has(handler)
    );

    expect(missingHandlers).toEqual([]);
  });

  it("maps every broker tab to a real panel", () => {
    const tabKeys = collectMatches(/onclick="switchTab\('([^']+)'\)/g);
    const panelIds = new Set(collectMatches(/id="tab-([^"]+)"/g));

    const missingPanels = [...new Set(tabKeys)].filter(
      tabKey => !panelIds.has(tabKey)
    );

    expect(missingPanels).toEqual([]);
  });

  it("routes form review actions to the dedicated summary panel", () => {
    expect(brokerToolHtml).toContain('id="tab-review-summary"');
    expect(brokerToolHtml).toContain('id="review-summary-content"');
    expect(brokerToolHtml).not.toContain('id="review-snapshot-modal"');

    const listingReviewSource = extractFunctionSource("showListingReview");
    const sharedReviewSource = extractFunctionSource("openReviewSnapshot");

    expect(listingReviewSource).toContain("openReviewSnapshot('listing')");
    expect(sharedReviewSource).toContain("reviewPanel.classList.add('active')");
    expect(sharedReviewSource).toContain("renderReviewSummary(rows, sections)");
  });

  it("maps every admin nav action to a real admin page", () => {
    const adminPageKeys = collectMatches(
      /onclick="switchAdminPage\('([^']+)'\)/g
    );
    const adminPanelIds = new Set(collectMatches(/id="admin-([^"]+)"/g));

    const missingPages = [...new Set(adminPageKeys)].filter(
      pageKey => !adminPanelIds.has(pageKey)
    );

    expect(missingPages).toEqual([]);
  });

  it("keeps Listing Entry property type cards concise and includes Medical", () => {
    const pickerStart = brokerToolHtml.indexOf('id="listing-type-picker"');
    const pickerEnd = brokerToolHtml.indexOf('id="l-prop-type"', pickerStart);
    const pickerHtml = brokerToolHtml.slice(pickerStart, pickerEnd);

    expect(pickerHtml).toContain('data-type="medical"');
    expect(pickerHtml).toContain('<span class="lto-title">Medical</span>');
    expect(pickerHtml).not.toContain("lto-sub");
  });

  it("ships the commission voucher Excel template for client export", async () => {
    const templatePath = requireCommissionVoucherTemplatePath();
    const bytes = readFileSync(templatePath);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(brokerToolHtml).toContain(
      "const VOUCHER_EXCEL_TEMPLATE_URL = '/templates/commission-voucher-template.xlsm';"
    );
    expect(brokerToolHtml).toContain("header[0] !== 0x50 || header[1] !== 0x4B");

    const app = express();
    app.get("/templates/commission-voucher-template.xlsm", (_req, res) => {
      res.setHeader("Content-Type", "application/vnd.ms-excel.sheet.macroEnabled.12");
      res.sendFile(templatePath);
    });

    const res = await request(app)
      .get("/templates/commission-voucher-template.xlsm")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"]).toLowerCase()).toContain(
      "application/vnd.ms-excel.sheet.macroenabled.12"
    );
    const body = res.body as Buffer;
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);
  });

  it("converts UI commission percents to Excel percentage fractions", () => {
    const source = ["voucherWorkbookParseNumber", "voucherWorkbookPercentNumber"]
      .map(extractFunctionSource)
      .join("\n");
    const { voucherWorkbookPercentNumber } = new Function(
      `${source}\nreturn { voucherWorkbookPercentNumber };`
    )() as { voucherWorkbookPercentNumber: (value: unknown) => number | null };

    expect(voucherWorkbookPercentNumber("6")).toBe(0.06);
    expect(voucherWorkbookPercentNumber("1")).toBe(0.01);
    expect(voucherWorkbookPercentNumber("50")).toBe(0.5);
    expect(voucherWorkbookPercentNumber("0.75")).toBe(0.75);
  });

  it("writes rent schedule commission rates as Excel percentage fractions", () => {
    const applySource = extractFunctionSource("voucherWorkbookApplyForm");
    expect(applySource).toContain(
      "voucherWorkbookSetNumber(ws, 'K' + sheetRow, voucherWorkbookPercentNumber(row.commissionRate))"
    );
    expect(applySource).not.toContain(
      "voucherWorkbookSetNumber(ws, 'K' + sheetRow, row.commissionRate)"
    );
  });

  it("wraps key voucher money fields in currency-field markup", () => {
    const voucherCurrencyIds = [
      "v-l-rate",
      "v-l-consideration",
      "v-s-price",
      "v-l-comm-due",
      "v-comm-bonus",
      "v-total-invoice",
      "v-gross-dist",
    ];
    for (const id of voucherCurrencyIds) {
      expect(brokerToolHtml).toMatch(
        new RegExp(
          `<div class="currency-field"><span class="currency-prefix">\\$</span><input id="${id}" class="currency-input`
        )
      );
    }
  });

  it("wraps distribution row gross and net inputs in currency-field markup", () => {
    const addDistRowSource = extractFunctionSource("addDistRow");
    expect(addDistRowSource).toContain('class="dist-gross-input currency-input"');
    expect(addDistRowSource).toContain(
      '<div class="currency-field"><span class="currency-prefix">$</span><input '
    );
    expect(addDistRowSource).toContain("grossInputCell('listing')");
    expect(addDistRowSource).toMatch(/dist-net-input currency-input/);
  });

  it("keeps commission distribution inputs editable without side-picker capture", () => {
    expect(brokerToolHtml).toContain("function stopDistSidePickerEvent");
    expect(brokerToolHtml).toContain("function closeAllDistSideSelects");
    expect(brokerToolHtml).toContain("function handleDistNetInput");

    const addDistRowSource = extractFunctionSource("addDistRow");
    expect(addDistRowSource).toContain("stopDistSidePickerEvent(event)");
    expect(addDistRowSource).toContain('openDistSideSelect(this.previousElementSibling, event)');
    expect(addDistRowSource).toContain('class="chip-select" tabindex="-1"');
    expect(addDistRowSource).not.toMatch(/dist-net-input[^>]*readonly/);

    const css = readFileSync(
      resolve(process.cwd(), "client/public/broker_tool.css"),
      "utf8"
    );
    expect(css).toMatch(/\.chip-select\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.chip-select\.is-open\s*\{[^}]*pointer-events:\s*auto/);
  });

  it("keeps client-side export entry points wired in broker_tool.html", () => {
    const exportHandlers = [
      "exportListingPdfWithSpinner",
      "exportSignPdfWithSpinner",
      "exportVoucherExcelWithSpinner",
      "exportCompPdfWithSpinner",
      "compReportExportCsvWithSpinner",
      "compReportExportPdfWithSpinner",
      "downloadMarketingRequestPdf",
      "ciDownloadDataSheet",
      "submitSendToAdmin",
    ];
    for (const handler of exportHandlers) {
      expect(brokerToolHtml).toContain(`${handler}(`);
    }
    expect(brokerToolHtml).toContain("const VOUCHER_EXCEL_TEMPLATE_URL = '/templates/commission-voucher-template.xlsm';");
    expect(brokerToolHtml).toContain("fetch('/api/marketing-request/pdf'");
    expect(brokerToolHtml).toContain("fetch('/api/trpc/email.sendToAdmin'");
    expect(brokerToolHtml).toContain("applyRecipientInboxHints");
    expect(brokerToolHtml).toContain('id="mr-recipient-hint"');
    expect(brokerToolHtml).toContain('id="sta-recipient-hint"');
    expect(brokerToolHtml).toContain("MARKETING_REQUEST_EMAIL_DEFAULT = 'fperkins@lee-associates.com'");
    expect(brokerToolHtml).toContain("BROKER_ADMIN_EMAIL = '_NewportBeach-BrokerAdmin@lee-associates.com'");
  });

  it("lets AI overwrite untouched Listing Entry defaults and match select labels", () => {
    const { findSelectOptionForAiValue, shouldApplyAiField } = getAiApplyHelpers();
    const untouched = {
      classList: { contains: () => false },
      getAttribute: () => null,
    };

    expect(
      shouldApplyAiField("listing", "propertyType", untouched, "industrial")
    ).toBe(true);
    expect(shouldApplyAiField("listing", "propertyType", untouched, "office")).toBe(
      false
    );

    const match = findSelectOptionForAiValue(
      {
        options: [
          { value: "industrial", textContent: "Industrial" },
          { value: "medical", textContent: "Medical" },
        ],
      },
      "Medical"
    );

    expect(match?.value).toBe("medical");
  });

  it("keeps the portal prefill key lists a subset of AI_FIELD_MAP", () => {
    // shared/quickConvert.ts *_AI_FIELD_KEYS is the contract for what the
    // portal (Quick Convert / pilot forms) hands off to the workspace. Every
    // key it promises must have a target in the workspace's AI_FIELD_MAP, or
    // the value is silently dropped on apply.
    const aiFieldMap = getAiFieldMap();

    // Known accepted gap, documented in docs/SOURCE_OF_TRUTH.md: the listing
    // tab has no commission input, so commissionRate is extracted but never
    // applied. Remove from this allowlist once the field exists (or the key
    // is dropped from LISTING_AI_FIELD_KEYS).
    const acceptedGaps = new Set(["listing:commissionRate"]);

    const contracts: Array<[string, readonly string[]]> = [
      ["voucher", VOUCHER_AI_FIELD_KEYS],
      ["listing", LISTING_AI_FIELD_KEYS],
      ["sign", SIGN_AI_FIELD_KEYS],
    ];

    const missing: string[] = [];
    for (const [tab, keys] of contracts) {
      const map = aiFieldMap[tab] ?? {};
      for (const key of keys) {
        if (!(key in map) && !acceptedGaps.has(`${tab}:${key}`)) {
          missing.push(`${tab}:${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("maps every AI_FIELD_MAP target to a real element in broker_tool.html", () => {
    // Pre-existing drift found during the source-of-truth consolidation pass
    // (docs/SOURCE_OF_TRUTH.md): these targets reference element ids that no
    // longer exist, so the extracted values are silently dropped. Pinned here
    // so NEW drift fails CI; shrink this list by fixing the mappings (e.g.
    // comp.tenantName -> c-lessee) once the intended targets are confirmed.
    const knownStaleTargets = new Set([
      "listing.ownerName -> #l-owner-name",
      "comp.dealSf -> #c-deal-sf",
      "comp.leaseRate -> #c-lease-rate",
      "comp.commencementDate -> #c-commence",
      "comp.tenantName -> #c-tenant",
      "comp.landlordName -> #c-landlord",
      "comp.salePrice -> #c-sale-price",
      "comp.pricePerSf -> #c-price-psf",
      "comp.brokerName -> #c-broker-name",
    ]);

    const aiFieldMap = getAiFieldMap();
    const missingTargets: string[] = [];
    const healedTargets: string[] = [];
    for (const [tab, map] of Object.entries(aiFieldMap)) {
      for (const [key, targetId] of Object.entries(map)) {
        // __pseudo__ targets are handled specially inside applyAiFields
        // (e.g. agent picker auto-fill), not by element id.
        if (targetId.startsWith("__")) continue;
        const label = `${tab}.${key} -> #${targetId}`;
        const exists = brokerToolHtml.includes(`id="${targetId}"`);
        if (!exists && !knownStaleTargets.has(label)) missingTargets.push(label);
        if (exists && knownStaleTargets.has(label)) healedTargets.push(label);
      }
    }
    expect(missingTargets).toEqual([]);
    // If a stale mapping is fixed, remove it from knownStaleTargets above.
    expect(healedTargets).toEqual([]);
  });

  it("computes rent-row commission the same way as the company Excel voucher", () => {
    // Excel source of truth (Updated_Voucher rev 3/4/25):
    //   F53 = months * rate/SF * dealSF  (consideration = monthly * months)
    //   L53 = comm% * consideration      (commission due per period)
    const buildHelpers = getVoucherRentRowHelpers();

    // Per-row commission % takes precedence over the global rate.
    const fakeDocument = {
      getElementById: (id: string) =>
        id === "v-l-comm-rate" ? { value: "4" } : null,
    };
    const helpers = buildHelpers(fakeDocument);

    const standardRow = fakeRentRow({ monthly: "10,000", months: "12" });
    expect(helpers.vRentRowMonthly(standardRow)).toBe(10000);
    expect(helpers.vRentRowMonths(standardRow)).toBe(12);
    // Falls back to the global commission rate: 10000 * 12 * 4% = 4800
    expect(helpers.vRentRowCommissionDue(standardRow)).toBeCloseTo(4800, 6);

    const perRowRateRow = fakeRentRow({
      monthly: "10000",
      months: "12",
      commPct: "5",
    });
    expect(helpers.vRentRowCommissionDue(perRowRateRow)).toBeCloseTo(6000, 6);

    // Free-rent rows contribute zero consideration and zero commission.
    const freeRow = fakeRentRow({ monthly: "10000", months: "3", free: true });
    expect(helpers.vRentRowMonthly(freeRow)).toBe(0);
    expect(helpers.vRentRowCommissionDue(freeRow)).toBe(0);

    // A manual override on the commission-due cell wins over the formula.
    const overriddenRow = fakeRentRow({
      monthly: "10000",
      months: "12",
      commDue: "$5,250.00",
      commDueOverride: true,
    });
    expect(helpers.vRentRowCommissionDue(overriddenRow)).toBeCloseTo(5250, 6);
  });

  it("keeps the voucher Excel export writing to the company template's cell grid", () => {
    // Anchor cells from the official voucher (Updated_Voucher rev 3/4/25).
    // If any of these move, the generated download no longer matches the
    // company's Excel layout that admins file into Dealius.
    const applySource = extractFunctionSource("voucherWorkbookApplyForm");
    const anchors: Array<[string, string]> = [
      ["transaction type", "'D4'"],
      ["active listing flag", "'K4'"],
      ["confidential flag", "'L1'"],
      ["date filled", "'N2'"],
      ["property street address", "'B9'"],
      ["property city", "'K9'"],
      ["property zip", "'N9'"],
      ["lessor/seller company", "'C12'"],
      ["lessee/buyer company", "'K12'"],
      ["deal sq ft", "'C23'"],
      ["sale consideration", "'M36'"],
      ["sale commission %", "'M43'"],
      ["bonus / adjustment", "'L70'"],
      ["consulting / referral fee", "'L74'"],
      ["listing agent house", "'C85'"],
      ["procuring agent house", "'K85'"],
      ["outside listing-side amount", "'L96'"],
      ["outside procuring-side amount", "'L98'"],
      ["invoice company", "'G109'"],
      ["invoice instructions", "'A113'"],
      ["overflow notes", "'A133'"],
    ];
    for (const [label, cell] of anchors) {
      expect(applySource, `expected ${label} cell ${cell}`).toContain(cell);
    }
    // Rent schedule rows 53-67 and distribution rows 124-130.
    expect(applySource).toContain("let row = 53; row <= 67");
    expect(applySource).toContain("53 + index");
    expect(applySource).toContain("let row = 124; row <= 130");
    expect(applySource).toContain("124 + index");
  });

  it("merges voucher document detection across multiple uploaded files", () => {
    const { combineVoucherDocumentStatus } = getVoucherDetectionHelpers();

    expect(
      combineVoucherDocumentStatus(
        { found: true, executed: false, missingSignatures: ["Principal signature"] },
        { found: true, executed: true, missingSignatures: [] }
      )
    ).toEqual({ found: true, executed: true, missingSignatures: [] });

    expect(
      combineVoucherDocumentStatus(
        { found: true, executed: false, missingSignatures: ["Principal signature"] },
        { found: true, executed: false, missingSignatures: ["Broker signature"] }
      )
    ).toEqual({
      found: true,
      executed: false,
      missingSignatures: ["Principal signature", "Broker signature"],
    });
  });
});
