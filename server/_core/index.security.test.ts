import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production-only safety rails", () => {
  it("does not expose the database seed script over HTTP", () => {
    const serverSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf-8");

    expect(serverSource).not.toContain("/api/seed-prod");
  });

  it("does not reset existing user passwords when seed data is re-run", () => {
    const seedSql = readFileSync(resolve(process.cwd(), "drizzle/seed_app_users_and_settings.sql"), "utf-8");

    expect(seedSql).not.toMatch(/`password_hash`\s*=\s*VALUES\(`password_hash`\)/i);
  });
});
