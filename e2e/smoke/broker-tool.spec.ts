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

  test("commission distribution gross % input stays editable without opening side picker", async ({
    page,
  }) => {
    await loginAsBroker(page, undefined, "/tool#voucher");
    await expect(page.locator("#broker-view")).toBeVisible({ timeout: 15_000 });

    const voucherTab = page.locator('[data-tab="voucher"]').first();
    await voucherTab.click();
    await expect(page.locator("#tab-voucher.active, #tab-voucher.panel.active")).toBeVisible({
      timeout: 15_000,
    });

    const distSection = page.locator("#vstep-8");
    await distSection.scrollIntoViewIfNeeded();
    await expect(distSection).toBeVisible();

    const distRow = page.locator("#v-dist-body tr").first();
    await expect(distRow).toBeVisible();

    const sideChip = distRow.locator(".side-chip");
    await sideChip.click();
    await expect(distRow.locator("select.chip-select")).toHaveClass(/is-open/);

    const grossPctInput = distRow.locator("input.dist-pct-input");
    await grossPctInput.click();
    await expect(distRow.locator("select.chip-select")).not.toHaveClass(/is-open/);

    await grossPctInput.fill("25");
    await expect(grossPctInput).toHaveValue("25");

    const grossInput = distRow.locator("td.dist-gross-col:not(.is-hidden) .dist-gross-input");
    await expect(grossInput).toBeVisible();
    await grossInput.click();
    await expect(distRow.locator("select.chip-select")).not.toHaveClass(/is-open/);
    await grossInput.fill("1500");
    await expect(grossInput).toHaveValue("1500");
  });

  test("marketing request PDF download uses mocked API", async ({ page }) => {
    let pdfRequestBody: Record<string, unknown> | null = null;
    await page.route("**/api/marketing-request/pdf", async route => {
      pdfRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": 'attachment; filename="marketing-smoke.pdf"' },
        body: Buffer.from("%PDF-1.4 marketing-smoke"),
      });
    });

    await loginAsBroker(page, undefined, "/tool#marketing-request");
    await expect(page.locator("#broker-view")).toBeVisible({ timeout: 15_000 });

    const marketingTab = page.locator('[data-tab="marketing-request"]').first();
    await marketingTab.click();
    await expect(page.locator("#tab-marketing-request.active")).toBeVisible({ timeout: 15_000 });

    await page.locator("#mr-requester-name").selectOption("Frank Adler");
    await page.locator("#mr-requester-email").fill("broker@lee-associates.com");
    await page.locator("#mr-project-title").fill("Smoke PDF export");
    await page.locator("#mr-request-type").selectOption("Flyer / brochure");
    await page.locator("#mr-priority").selectOption("Standard");
    await page.locator("#mr-objective").fill("Verify marketing PDF export wiring.");
    await page.locator("#mr-due-date").fill("2026-06-20");

    await page.locator("#btn-mr-download-pdf").click();
    await expect(page.locator("#mr-status .status-success")).toBeVisible({ timeout: 15_000 });
    expect(pdfRequestBody).toMatchObject({
      requesterName: "Frank Adler",
      email: "broker@lee-associates.com",
      projectTitle: "Smoke PDF export",
      requestType: "Flyer / brochure",
      priority: "Standard",
      objective: "Verify marketing PDF export wiring.",
      dueDate: "2026-06-20",
    });
  });
});
