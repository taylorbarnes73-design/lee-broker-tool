import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("broker tool smoke", () => {
  test("comp report filters render dropdown controls", async ({ page }) => {
    await loginAsBroker(page, undefined, "/portal/workspace?tab=comp-reports");
    const tool = page.frameLocator('iframe[title="Broker workflow workspace"]');
    await expect(tool.locator("#broker-view")).toBeVisible({ timeout: 15_000 });
    await expect(tool.locator("#tab-comp-reports.active")).toBeVisible({ timeout: 15_000 });

    for (const id of ["cr-city", "cr-market", "cr-submarket", "cr-property-type"]) {
      await expect(tool.locator(`#${id} .cr-dd-btn`)).toBeVisible();
      await expect(tool.locator(`#${id} .cr-dd-label`)).toHaveText("All");
    }

    await tool.locator("#cr-city .cr-dd-btn").click();
    const cityBtn = tool.locator("#cr-city .cr-dd-btn");
    const cityBtnBox = await cityBtn.boundingBox();
    expect(cityBtnBox?.width ?? 0).toBeGreaterThanOrEqual(120);
    const cityPanel = tool.locator("#cr-city .cr-dd-panel");
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
    await loginAsBroker(page, undefined, "/portal/workspace?tab=voucher");
    const tool = page.frameLocator('iframe[title="Broker workflow workspace"]');
    await expect(tool.locator("#broker-view")).toBeVisible({ timeout: 15_000 });
    await expect(tool.locator("#tab-voucher.active, #tab-voucher.panel.active")).toBeVisible({
      timeout: 15_000,
    });

    const distSection = tool.locator("#vstep-8");
    await distSection.scrollIntoViewIfNeeded();
    await expect(distSection).toBeVisible();

    const distRow = tool.locator("#v-dist-body tr").first();
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

    await loginAsBroker(page, undefined, "/portal/workspace?tab=marketing-request");
    const tool = page.frameLocator('iframe[title="Broker workflow workspace"]');
    await expect(tool.locator("#broker-view")).toBeVisible({ timeout: 15_000 });
    await expect(tool.locator("#tab-marketing-request.active")).toBeVisible({ timeout: 15_000 });

    await tool.locator("#mr-requester-name").selectOption("Frank Adler");
    await tool.locator("#mr-requester-email").fill("broker@lee-associates.com");
    await tool.locator("#mr-project-title").fill("Smoke PDF export");
    await tool.locator("#mr-request-type").selectOption("Flyer / brochure");
    await tool.locator("#mr-priority").selectOption("Standard");
    await tool.locator("#mr-objective").fill("Verify marketing PDF export wiring.");
    await tool.locator("#mr-due-date").fill("2026-06-20");

    await tool.locator("#btn-mr-download-pdf").click();
    await expect(tool.locator("#mr-status .status-success")).toBeVisible({ timeout: 15_000 });
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

  test("voucher lease commission math matches the company Excel voucher", async ({
    page,
  }) => {
    // Regression guard for the calculation chain documented in
    // docs/SOURCE_OF_TRUTH.md: rent schedule -> consideration -> commission
    // due -> total invoice -> gross to distribute. Expected values follow the
    // Excel voucher formulas (consideration = monthly * months; commission =
    // consideration * rate%).
    await loginAsBroker(page, undefined, "/portal/workspace?tab=voucher");
    const tool = page.frameLocator('iframe[title="Broker workflow workspace"]');
    await expect(tool.locator("#broker-view")).toBeVisible({ timeout: 15_000 });
    await expect(tool.locator("#tab-voucher.active, #tab-voucher.panel.active")).toBeVisible({
      timeout: 15_000,
    });

    await tool.locator("#v-l-dealsf").fill("10000");
    await tool.locator("#v-l-term").fill("12");
    await tool.locator("#v-l-rate").fill("1.00");

    await tool.getByRole("button", { name: "Generate schedule" }).click();
    await expect(tool.locator("#v-rent-body tr")).toHaveCount(1);
    await expect(tool.locator("#v-rent-body tr .rent-monthly").first()).toHaveValue(
      /10,?000/
    );

    await tool.locator("#v-l-comm-rate").fill("4");

    // 10,000 SF * $1.00/SF/mo * 12 mo = $120,000 consideration
    await expect(tool.locator("#v-l-consideration")).toHaveValue(/^\$120,000(\.00)?$/);
    // $120,000 * 4% = $4,800 commission due == total invoice (no bonus/fees)
    await expect(tool.locator("#v-l-comm-due")).toHaveValue("$4,800.00");
    await expect(tool.locator("#v-total-invoice")).toHaveValue("$4,800.00");
    // No outside agents, so the full invoice is available to distribute.
    await expect(tool.locator("#v-dist-total-invoice")).toHaveValue("$4,800.00");
    await expect(tool.locator("#v-gross-dist")).toHaveValue("$4,800.00");
  });
});
