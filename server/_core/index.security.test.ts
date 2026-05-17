import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("server bootstrap security regressions", () => {
  it("does not expose the production seed script over HTTP", () => {
    const indexSource = readFileSync(resolve(import.meta.dirname, "index.ts"), "utf-8");

    expect(indexSource).not.toContain("/api/seed-prod");
  });

  it("does not reset existing user password hashes when seed data is replayed", () => {
    const seedSql = readFileSync(resolve(import.meta.dirname, "../../drizzle/seed_app_users_and_settings.sql"), "utf-8");

    expect(seedSql).not.toMatch(/password_hash`\s*=\s*VALUES\(`password_hash`\)/i);
  });
});
