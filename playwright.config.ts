import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SMOKE_PORT ?? 3000);
const baseURL = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.SMOKE_NO_SERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? "",
          LOCAL_AUTH_ENABLED: "true",
          LOCAL_AUTH_EMAIL_DOMAIN: "lee-associates.com",
          JWT_SECRET: process.env.JWT_SECRET ?? "smoke-test-jwt-secret",
          VITE_ENABLE_AUTH_REDIRECT: "false",
          OAUTH_SERVER_URL: process.env.OAUTH_SERVER_URL ?? "https://oauth.test.local",
        },
      },
});
