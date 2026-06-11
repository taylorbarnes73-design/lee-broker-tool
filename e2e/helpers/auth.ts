import { expect, type Page } from "@playwright/test";

export const SMOKE_BROKER_USERNAME = process.env.SMOKE_BROKER_USER ?? "fadler";
export const SMOKE_ADMIN_USERNAME = process.env.SMOKE_ADMIN_USER ?? "tbarnes";

export async function loginAsBroker(
  page: Page,
  username = SMOKE_BROKER_USERNAME,
  nextPath = "/portal/workspace",
) {
  const response = await page.request.post("/api/auth/login", {
    data: { email: username },
  });
  expect(response.ok(), `login failed: ${response.status()}`).toBeTruthy();
  await page.goto(nextPath);
  await page.waitForLoadState("domcontentloaded");
}

export async function loginAsAdmin(
  page: Page,
  username = SMOKE_ADMIN_USERNAME,
  nextPath = "/portal/workspace",
) {
  const response = await page.request.post("/api/auth/login", {
    data: { email: username },
  });
  expect(response.ok(), `admin login failed: ${response.status()}`).toBeTruthy();
  await page.goto(nextPath);
  await page.waitForLoadState("domcontentloaded");
}
