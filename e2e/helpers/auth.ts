import type { Page } from "@playwright/test";

export const SMOKE_BROKER_USERNAME = process.env.SMOKE_BROKER_USER ?? "tbarnes";

export async function loginAsBroker(page: Page, username = SMOKE_BROKER_USERNAME) {
  await page.goto("/login");
  await page.getByLabel("Lee username or email").fill(username);
  await page.getByRole("button", { name: "Continue to Portal" }).click();
  await page.waitForURL(/\/portal\//, { timeout: 30_000 });
}
