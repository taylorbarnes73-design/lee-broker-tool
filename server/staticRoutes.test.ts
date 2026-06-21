import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serveStatic } from "./_core/vite";

const distPublic = resolve(process.cwd(), "dist/public");
const indexPath = resolve(distPublic, "index.html");

let previousIndex: Buffer | null = null;

function buildApp() {
  const app = express();
  serveStatic(app);
  return app;
}

describe("production static routes", () => {
  beforeAll(() => {
    previousIndex = existsSync(indexPath) ? readFileSync(indexPath) : null;
    mkdirSync(distPublic, { recursive: true });
    writeFileSync(indexPath, "<!doctype html><div>portal shell</div>");
  });

  afterAll(() => {
    if (previousIndex) {
      writeFileSync(indexPath, previousIndex);
    } else {
      rmSync(indexPath, { force: true });
    }
  });

  it.each(["/portal", "/portal/admin/users", "/dashboard", "/admin/settings"])(
    "serves the React portal shell for %s",
    async path => {
      const res = await request(buildApp()).get(path);

      expect(res.status).toBe(200);
      expect(res.text).toContain("portal shell");
    }
  );

  // The legacy broker_tool.html engine has been retired; its old URLs now
  // redirect to the React workspace home rather than serving a second shell.
  it.each(["/tool?tab=voucher", "/workspace-engine?tab=voucher", "/broker_tool.html?tab=sign"])(
    "redirects legacy workspace URL %s into the React workspace",
    async path => {
      const res = await request(buildApp()).get(path);

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/portal\/workspace/);
    }
  );

  it("uses the React shell for unknown routes", async () => {
    const res = await request(buildApp()).get("/listing");

    expect(res.status).toBe(200);
    expect(res.text).toContain("portal shell");
  });
});
