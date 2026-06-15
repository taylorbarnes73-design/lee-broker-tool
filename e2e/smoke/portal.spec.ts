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

  test("voucher form loads from workspace card", async ({ page }) => {
    await page.goto("/portal/workspace");
    await page.getByRole("link", { name: /Commission Vouchers/i }).click();
    await expect(page).toHaveURL(/\/portal\/forms\/voucher/);
    await expect(page.getByRole("heading", { name: "Commission Voucher" })).toBeVisible();
    // No iframe — it's now a native React form
    await expect(page.getByTestId("workspace-frame")).toHaveCount(0);
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

  test("voucher form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/voucher");
    await expect(page.getByRole("heading", { name: "Commission Voucher" })).toBeVisible();
    await page.getByRole("button", { name: /Submit voucher to admin/i }).click();
    await expect(page.getByText(/Property address is required/i)).toBeVisible();
  });

  test("sign form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/sign");
    await expect(page.getByRole("heading", { name: "Order a sign" })).toBeVisible();
    await page.getByRole("button", { name: /Submit to admin/i }).click();
    await expect(page.getByText(/Property address is required/i)).toBeVisible();
  });

  test("listing form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/listing");
    await expect(page.getByRole("heading", { name: "Add a listing" })).toBeVisible();
    await page.getByRole("button", { name: /Submit to admin/i }).click();
    await expect(page.getByText(/Property address and city are required/i)).toBeVisible();
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

  test("comp form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/comp");
    await expect(page.getByRole("heading", { name: "Comp input" })).toBeVisible();
    await page.getByRole("button", { name: /Save comp/i }).click();
    await expect(page.getByText(/Property address is required/i)).toBeVisible();
  });

  test("marketing request form validates required fields", async ({ page }) => {
    await page.goto("/portal/forms/marketing-request");
    await expect(page.getByRole("heading", { name: "Marketing request" })).toBeVisible();
    await page.getByRole("button", { name: /Send to marketing/i }).click();
    await expect(page.getByText(/Missing required fields/i)).toBeVisible();
  });

  test("comp reports search page loads and runs a search", async ({ page }) => {
    await page.goto("/portal/comp-reports");
    await expect(page.getByRole("heading", { name: "Comp Reports" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Orange County" })).toBeVisible();
    await page.getByPlaceholder("Address, project, tenant…").fill("Von Karman");
    await page.getByRole("button", { name: /^Search$/ }).click();
    // With no published dataset the page must show a graceful empty state, not crash.
    await expect(page.getByText(/No comps match|result/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("documents library loads and filters", async ({ page }) => {
    await page.goto("/portal/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByText("Sign Request Form", { exact: false }).first()).toBeVisible();
    await page.getByPlaceholder("Search documents…").fill("estoppel");
    await expect(page.getByText(/Standard Estoppel Certificate/i).first()).toBeVisible();
    await expect(page.getByText("Sign Request Form", { exact: false })).toHaveCount(0);
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
