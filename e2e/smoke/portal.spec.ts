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

  test("sign pilot form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/sign");
    await expect(page.getByRole("heading", { name: "Sign request" })).toBeVisible();
    await page.getByRole("button", { name: "Continue in workspace" }).click();
    await expect(page.getByText("Property address is required")).toBeVisible();
  });

  test("listing pilot form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/listing");
    await expect(page.getByRole("heading", { name: "Listing entry" })).toBeVisible();
    await page.getByRole("button", { name: "Continue in workspace" }).click();
    await expect(page.getByText("Property address is required")).toBeVisible();
  });

  test("listing pilot address autocomplete fills city and state", async ({ page }) => {
    await page.route("**/api/places/autocomplete**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              address: "1450 Von Karman Ave",
              city: "Irvine",
              state: "CA",
              zip: "92612",
            },
          ],
        }),
      });
    });

    await page.goto("/portal/forms/listing");
    const addressInput = page.getByPlaceholder("1450 Von Karman Ave");
    await addressInput.fill("1450 Von");
    await expect(page.getByRole("option", { name: /1450 Von Karman Ave/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("option", { name: /1450 Von Karman Ave/i }).click();

    await expect(addressInput).toHaveValue("1450 Von Karman Ave");
    await expect(page.getByPlaceholder("Irvine")).toHaveValue("Irvine");
    await expect(page.getByPlaceholder("CA")).toHaveValue("CA");
    await expect(page.getByPlaceholder("92612")).toHaveValue("92612");
  });

  test("submissions list loads for signed-in broker", async ({ page }) => {
    await page.goto("/portal/submissions");
    await expect(page.getByText(/submission/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
