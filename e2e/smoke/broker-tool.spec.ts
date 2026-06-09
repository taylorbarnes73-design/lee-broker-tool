import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("broker tool smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page);
  });

  test("comp report filters render dropdown controls", async ({ page }) => {
    await page.goto("/tool#comp-reports");
    await expect(page.locator("#tab-comp-reports")).toBeVisible({ timeout: 15_000 });

    for (const id of ["cr-city", "cr-market", "cr-submarket", "cr-property-type"]) {
      await expect(page.locator(`#${id} .cr-dd-btn`)).toBeVisible();
      await expect(page.locator(`#${id} .cr-dd-label`)).toHaveText("All");
    }
  });
});
