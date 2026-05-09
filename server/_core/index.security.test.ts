import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production seed hardening", () => {
  it("does not expose the database seed SQL through an HTTP route", () => {
    const serverEntry = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf-8");

    expect(serverEntry).not.toContain("seed-prod");
    expect(serverEntry).not.toMatch(/app\.(get|post|put|patch|delete)\(\s*["'`]\/api\/seed/i);
  });

  it("does not reset existing user password hashes when the seed SQL is rerun", () => {
    const seedSql = readFileSync(resolve(process.cwd(), "drizzle/seed_app_users_and_settings.sql"), "utf-8");
    const duplicateUpdateClause = seedSql.match(/ON DUPLICATE KEY UPDATE([\s\S]*?);/i)?.[1] ?? "";

    expect(duplicateUpdateClause).not.toMatch(/password_hash\s*=/i);
  });
});
