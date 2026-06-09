import { expect, test } from "@playwright/test";
import { loginAsBroker } from "../helpers/auth";

test.describe("login smoke", () => {
  test("public home links to sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /sign in to portal/i })).toBeVisible();
  });

  test("rejects non-Lee email on login form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Lee username or email").fill("tbarnes@gmail.com");
    await page.getByRole("button", { name: "Continue to Portal" }).click();
    await expect(page.getByText(/lee-associates\.com/i)).toBeVisible();
  });

  test("broker signs in with Lee username", async ({ page }) => {
    await loginAsBroker(page);
    await expect(page).toHaveURL(/\/portal\//);
  });
});
