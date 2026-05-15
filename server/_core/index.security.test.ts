import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("server entrypoint security", () => {
  it("does not expose the production seed route", async () => {
    const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

    expect(source).not.toContain("/api/seed-prod");
  });

  it("does not overwrite app user password hashes when seed SQL is re-run", async () => {
    const sql = await readFile(new URL("../../drizzle/seed_app_users_and_settings.sql", import.meta.url), "utf8");
    const appUsersDuplicateUpdate = sql.match(
      /ON DUPLICATE KEY UPDATE\s+([\s\S]*?);\s*\n\s*INSERT INTO `app_settings`/
    )?.[1];

    expect(appUsersDuplicateUpdate).toBeDefined();
    expect(appUsersDuplicateUpdate).not.toMatch(/`password_hash`\s*=/i);
  });
});
