import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("production seed safety", () => {
  it("does not expose a public route that executes the production seed script", () => {
    const serverEntry = readRepoFile("server/_core/index.ts");

    expect(serverEntry).not.toContain("/api/seed-prod");
  });

  it("does not overwrite existing user credentials or activation state on duplicate seeds", () => {
    const seedSql = readRepoFile("drizzle/seed_app_users_and_settings.sql");

    expect(seedSql).not.toMatch(/`role`\s*=\s*VALUES\(`role`\)/i);
    expect(seedSql).not.toMatch(/`password_hash`\s*=\s*VALUES\(`password_hash`\)/i);
    expect(seedSql).not.toMatch(/`is_active`\s*=\s*VALUES\(`is_active`\)/i);
  });
});
