import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production seed safety", () => {
  it("does not expose the production seed endpoint from the HTTP server", async () => {
    const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

    expect(source).not.toContain("/api/seed-prod");
  });

  it("does not overwrite existing password hashes when seed SQL is re-run", async () => {
    const seedSql = await readFile(new URL("../../drizzle/seed_app_users_and_settings.sql", import.meta.url), "utf8");

    expect(seedSql).not.toMatch(/`password_hash`\s*=\s*VALUES\(`password_hash`\)/);
  });
});
