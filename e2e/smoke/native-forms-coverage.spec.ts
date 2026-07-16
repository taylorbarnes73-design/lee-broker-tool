import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

// Deeper interaction coverage for three flows that portal.spec.ts only smoke-tests
// at a basic level, restoring (in native-page-appropriate form) what was lost
// when broker-tool.spec.ts's iframe-based tests were retired alongside the
// legacy broker_tool.html. Each native page replaced its legacy UI with a
// genuinely different interaction model, so these are new tests against the
// current components, not ports of the old assertions.

test.describe("native forms restored coverage", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page);
  });

  test("marketing request form fills required fields and downloads the generated PDF", async ({
    page,
  }) => {
    await page.goto("/portal/forms/marketing-request");
    await expect(page.getByRole("heading", { name: "Marketing request" })).toBeVisible();

    await page.route("**/api/marketing-request/pdf", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4 fake marketing request pdf"),
      });
    });

    // PortalMarketingForm's <Select>s have no <label for> association; target by
    // fixed DOM order: [0] Requester name, [1] Project type, [2] Priority.
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ index: 1 });
    await page.getByPlaceholder("name@lee-associates.com").fill("broker.smoke@lee-associates.com");
    await page.getByPlaceholder("Q3 industrial availability flyer").fill("Q3 Industrial Flyer");
    await selects.nth(1).selectOption({ label: "Flyer / brochure" });
    await selects.nth(2).selectOption({ label: "Standard" });
    await page
      .getByPlaceholder("What do you need, and what's the goal?")
      .fill("Smoke test marketing PDF generation end to end.");
    await page.locator('input[type="date"]').first().fill("2026-08-01");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Marketing_Request_Q3_Industrial_Flyer.pdf");
  });

  test("comp reports market and property type chips toggle independently and survive a search", async ({
    page,
  }) => {
    await page.goto("/portal/comp-reports");
    await expect(page.getByRole("heading", { name: "Comp Reports" })).toBeVisible();

    const ocChip = page.getByRole("button", { name: "Orange County", exact: true });
    const laChip = page.getByRole("button", { name: "Los Angeles", exact: true });
    const industrialChip = page.getByRole("button", { name: "Industrial", exact: true });

    await expect(ocChip).toHaveCSS("font-weight", "500");
    await ocChip.click();
    await laChip.click();
    await industrialChip.click();
    await expect(ocChip).toHaveCSS("font-weight", "700");
    await expect(laChip).toHaveCSS("font-weight", "700");
    await expect(industrialChip).toHaveCSS("font-weight", "700");

    // Deselecting one chip leaves the others selected — they're independent toggles.
    await ocChip.click();
    await expect(ocChip).toHaveCSS("font-weight", "500");
    await expect(laChip).toHaveCSS("font-weight", "700");

    await page.getByPlaceholder("Irvine, Tustin").fill("Irvine, Tustin");
    await page.getByPlaceholder("IBC, Airport Area").fill("Airport Area");
    await page.getByPlaceholder("5,000").fill("10000");
    await page.getByPlaceholder("50,000").fill("100000");
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2026-01-01");
    await dateInputs.nth(1).fill("2026-06-01");

    await page.getByRole("button", { name: /^Search$/ }).click();
    // No published dataset in the smoke environment — the combined filters must
    // still produce a graceful empty state, not a crash.
    await expect(page.getByText(/No comps match|result/i).first()).toBeVisible({ timeout: 10_000 });

    // Filter values and chip selection survive the search round-trip.
    await expect(page.getByPlaceholder("Irvine, Tustin")).toHaveValue("Irvine, Tustin");
    await expect(laChip).toHaveCSS("font-weight", "700");
    await expect(industrialChip).toHaveCSS("font-weight", "700");
  });

  test("commission distribution rows can be added, edited, and removed", async ({ page }) => {
    await page.goto("/portal/forms/voucher");
    await expect(page.getByRole("heading", { name: "Commission Voucher" })).toBeVisible();

    const distTable = page
      .locator("table")
      .filter({ has: page.getByRole("columnheader", { name: "Gross %" }) });
    await expect(distTable.locator("tbody tr")).toHaveCount(1);

    const firstRow = distTable.locator("tbody tr").first();
    await firstRow.getByPlaceholder("Agent name").fill("Jane Smith");
    await firstRow.locator("select").selectOption("Procuring");
    await firstRow.getByPlaceholder("50").fill("60");

    await page.getByRole("button", { name: "+ Add agent", exact: true }).click();
    await expect(distTable.locator("tbody tr")).toHaveCount(2);

    // The first row's values must survive adding a second row.
    await expect(firstRow.getByPlaceholder("Agent name")).toHaveValue("Jane Smith");
    await expect(firstRow.locator("select")).toHaveValue("Procuring");
    await expect(firstRow.getByPlaceholder("50")).toHaveValue("60");

    // Removing the second (empty) row leaves only the edited first row intact.
    await distTable.locator("tbody tr").nth(1).getByRole("button", { name: "×" }).click();
    await expect(distTable.locator("tbody tr")).toHaveCount(1);
    await expect(firstRow.getByPlaceholder("Agent name")).toHaveValue("Jane Smith");
  });

  test("voucher submission stays on the form when the server rejects it", async ({ page }) => {
    await page.route("**/api/trpc/email.sendToAdmin**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  success: false,
                  error: "Database unavailable. The request could not be recorded for the admin portal.",
                },
              },
            },
          },
        ]),
      });
    });

    await page.goto("/portal/forms/voucher");
    await page.getByPlaceholder("123 Industrial Dr").fill("123 Smoke Test Dr");
    await page.getByPlaceholder("Irvine").fill("Irvine");
    await page.getByPlaceholder("Agent name").first().fill("Smoke Test Broker");
    await page.getByRole("button", { name: "Submit voucher to admin" }).click();

    await expect(page.getByRole("alert")).toContainText("Database unavailable");
    await expect(page.getByRole("heading", { name: "Commission Voucher" })).toBeVisible();
    await expect(page.getByText("Voucher submitted", { exact: true })).not.toBeVisible();
  });
});
