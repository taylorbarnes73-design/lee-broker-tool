import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsBroker } from "../helpers/auth";

test.describe("portal smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page);
  });

  test("broker home shows the workspace tool launchpad", async ({ page }) => {
    await page.goto("/portal/workspace");
    await expect(
      page.getByRole("link", { name: /Commission Vouchers/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Listings/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Sign Orders/i })
    ).toBeVisible();
    // Home mode: no iframe until a tool is opened.
    await expect(page.getByTestId("workspace-frame")).toHaveCount(0);
  });

  test("opening a tool card shows that tool in the workspace frame", async ({ page }) => {
    await page.goto("/portal/workspace");
    await page.getByRole("link", { name: /Commission voucher/i }).click();
    await expect(page).toHaveURL(/tab=voucher/);
    await expect(page.getByTestId("workspace-frame")).toBeVisible();
    // The engine must open on the tool the card claims, not its default tab.
    const tool = page.frameLocator('iframe[title="Broker workflow workspace"]');
    await expect(tool.locator("#tab-voucher.active, #tab-voucher.panel.active")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /Workspace/i }).first()).toBeVisible();
  });

  test("broker sees the shared workspace without admin navigation", async ({ page }) => {
    await page.goto("/portal/workspace");
    await expect(page.getByRole("link", { name: /Commission voucher/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  });

  test("legacy broker home URL redirects to workspace", async ({ page }) => {
    await page.goto("/portal/new");
    await expect(page).toHaveURL(/\/portal\/workspace/);
  });

  test("voucher pilot form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/voucher");
    await expect(page.getByRole("heading", { name: "Submit a closed deal" })).toBeVisible();
    await page.getByRole("button", { name: /Continue to commission details/i }).click();
    await expect(page.getByText("Property address is required")).toBeVisible();
  });

  test("sign form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/sign");
    await expect(page.getByRole("heading", { name: "Order a sign" })).toBeVisible();
    await page.getByRole("button", { name: /Submit to admin/i }).click();
    await expect(page.getByText(/Property address is required/i)).toBeVisible();
  });

  test("listing pilot form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/listing");
    await expect(page.getByRole("heading", { name: "Add a listing" })).toBeVisible();
    await page.getByRole("button", { name: /Continue to listing details/i }).click();
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

  test("admin request page shows request categories", async ({ page }) => {
    await page.goto("/portal/admin-request");
    await expect(page.getByRole("heading", { name: "Message the admin team" })).toBeVisible();
    await expect(page.getByRole("button", { name: /General Request/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /IT \/ System Issue/i })).toBeVisible();
  });
});

test.describe("admin portal separation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin starts on the shared home and enters admin tools explicitly", async ({ page }) => {
    await expect(page).toHaveURL(/\/portal\/workspace/);
    await expect(page.getByRole("link", { name: /Commission voucher/i })).toBeVisible();
    const adminEntry = page.getByRole("link", { name: "Admin", exact: true }).first();
    await expect(adminEntry).toBeVisible();
    // Admin nav (Settings/Users) must not appear on the shared home — match the
    // real nav link by exact name so prose mentioning "settings" doesn't count.
    await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);

    await adminEntry.click();
    await expect(page).toHaveURL(/\/portal\/admin\/submissions/);
    await expect(page.getByRole("link", { name: /Settings/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Users/i })).toBeVisible();
  });

  test("legacy shared submissions URL redirects admins into the admin area", async ({ page }) => {
    await page.goto("/portal/submissions");
    await expect(page).toHaveURL(/\/portal\/admin\/submissions/);
    await expect(page.getByRole("link", { name: "Exit Admin", exact: true })).toBeVisible();
  });
});
