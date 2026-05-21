import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

const brokerToolHtml = readFileSync(
  resolve(process.cwd(), "client/public/broker_tool.html"),
  "utf8"
);

function collectMatches(pattern: RegExp) {
  return [...brokerToolHtml.matchAll(pattern)].map(match => match[1]);
}

describe("broker_tool.html wiring", () => {
  it("keeps every inline onclick handler bound to a real function", () => {
    const handlers = collectMatches(/onclick="([A-Za-z0-9_]+)\(/g);
    const definedFunctions = new Set(
      collectMatches(/\bfunction\s+([A-Za-z0-9_]+)\s*\(/g)
    );

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

  it("keeps every inline script block syntactically valid", () => {
    const scripts = [...brokerToolHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(
      match => match[1]
    );

    expect(() => {
      scripts.forEach((script, index) => {
        new Script(script, { filename: `broker_tool.inline.${index}.js` });
      });
    }).not.toThrow();
  });
});
