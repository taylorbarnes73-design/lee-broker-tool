import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("broker tool smoke", () => {
  test("comp report filters render dropdown controls", async ({ page }) => {
    await loginAsBroker(page, undefined, "/tool#comp-reports");
    await expect(page.locator("#broker-view")).toBeVisible({ timeout: 15_000 });
    const compReportsTab = page.locator('[data-tab="comp-reports"]').first();
    await compReportsTab.click();
    await expect(page.locator("#tab-comp-reports.active")).toBeVisible({ timeout: 15_000 });

    for (const id of ["cr-city", "cr-market", "cr-submarket", "cr-property-type"]) {
      await expect(page.locator(`#${id} .cr-dd-btn`)).toBeVisible();
      await expect(page.locator(`#${id} .cr-dd-label`)).toHaveText("All");
    }

    await page.locator("#cr-city .cr-dd-btn").click();
    const cityBtn = page.locator("#cr-city .cr-dd-btn");
    const cityBtnBox = await cityBtn.boundingBox();
    expect(cityBtnBox?.width ?? 0).toBeGreaterThanOrEqual(120);
    const cityPanel = page.locator("#cr-city .cr-dd-panel");
    await expect(cityPanel).toHaveClass(/open/);
    await expect(cityPanel.locator(".cr-dd-search-input")).toBeVisible();
    const anaheimLabel = cityPanel.locator(".cr-dd-opt", { hasText: "Anaheim" });
    await expect(anaheimLabel).toBeVisible();
    await expect(anaheimLabel.locator("span")).toHaveText("Anaheim");
    const panelBox = await cityPanel.boundingBox();
    expect(panelBox?.width ?? 0).toBeGreaterThanOrEqual(240);
  });
});
