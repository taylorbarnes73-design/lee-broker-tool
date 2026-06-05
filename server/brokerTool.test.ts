import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
});
