import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("portal smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page);
  });

  test("broker home shows primary form cards", async ({ page }) => {
    await page.goto("/portal/new");
    await expect(
      page.getByRole("link", { name: /Listing entry/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Commission voucher/i })
    ).toBeVisible();
  });

  test("voucher pilot form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/voucher");
    await expect(page.getByRole("heading", { name: "Commission voucher" })).toBeVisible();
    await page.getByRole("button", { name: "Continue in workspace" }).click();
    await expect(page.getByText("Property address is required")).toBeVisible();
  });

  test("submissions list loads for signed-in broker", async ({ page }) => {
    await page.goto("/portal/submissions");
    await expect(page.getByText(/submission/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
