import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("broker tool smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page);
  });

  test("voucher lease commission math matches the company Excel voucher", async ({
    page,
  }) => {
    // Regression guard for the calculation chain documented in
    // docs/SOURCE_OF_TRUTH.md: rent schedule -> consideration -> commission
    // due -> total invoice. Expected values follow the Excel voucher formulas
    // (consideration = monthly * months; commission = consideration * rate%).
    await page.goto("/portal/forms/voucher");
    await expect(page.getByRole("heading", { name: "Commission Voucher" })).toBeVisible();

    await page.getByPlaceholder("12,500").fill("10000");
    await page.getByPlaceholder("60").fill("12");
    await page.getByPlaceholder("1.25").fill("1.00");
    await page.getByRole("button", { name: "Generate schedule" }).click();

    const rentTable = page
      .locator("table")
      .filter({ has: page.getByRole("columnheader", { name: "Monthly Rent" }) });
    await expect(rentTable.locator("tbody tr")).toHaveCount(1);
    await expect(rentTable.locator("tbody tr input").first()).toHaveValue("10000");

    // "4.0" is also the placeholder on the per-row Comm % cell inside the
    // rent schedule table; the standalone Commission rate % field renders
    // first in document order, so .first() resolves to it.
    await page.getByPlaceholder("4.0").first().fill("4");

    // 10,000 SF * $1.00/SF/mo * 12 mo = $120,000 consideration;
    // $120,000 * 4% = $4,800 commission due == total invoice (no bonus/fees).
    await expect(
      page.getByText(/Total consideration:\s*\$120,000\.00\s*·\s*Commission @ 4%:\s*\$4,800\.00/)
    ).toBeVisible();
    await expect(page.getByText(/Total invoice:\s*\$4,800\.00/)).toBeVisible();
  });
});
