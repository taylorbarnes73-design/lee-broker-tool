import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serveStatic } from "./_core/vite";

const distPublic = resolve(process.cwd(), "dist/public");
const indexPath = resolve(distPublic, "index.html");
const brokerToolPath = resolve(distPublic, "broker_tool.html");

const previousFiles = new Map<string, Buffer | null>();

function buildApp() {
  const app = express();
  serveStatic(app);
  return app;
}

describe("production static routes", () => {
  beforeAll(() => {
    for (const filePath of [indexPath, brokerToolPath]) {
      previousFiles.set(filePath, existsSync(filePath) ? readFileSync(filePath) : null);
    }
    mkdirSync(distPublic, { recursive: true });
    writeFileSync(indexPath, "<!doctype html><div>portal shell</div>");
    writeFileSync(brokerToolPath, "<!doctype html><div>broker tool shell</div>");
  });

  afterAll(() => {
    for (const [filePath, previous] of previousFiles.entries()) {
      if (previous) {
        writeFileSync(filePath, previous);
      } else {
        rmSync(filePath, { force: true });
      }
    }
  });

  it.each(["/portal", "/portal/admin/users", "/dashboard", "/admin/settings"])(
    "serves the React portal shell for %s",
    async path => {
      const res = await request(buildApp()).get(path);

      expect(res.status).toBe(200);
      expect(res.text).toContain("portal shell");
      expect(res.text).not.toContain("broker tool shell");
    }
  );

  it("serves the internal workflow engine only at its implementation route", async () => {
    const res = await request(buildApp()).get("/workspace-engine");

    expect(res.status).toBe(200);
    expect(res.text).toContain("broker tool shell");
  });

  it("redirects legacy workspace URLs into the React workspace", async () => {
    const res = await request(buildApp()).get("/tool?tab=voucher");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/portal/workspace?tab=voucher");
  });

  it("uses the React shell for unknown routes", async () => {
    const res = await request(buildApp()).get("/listing");

    expect(res.status).toBe(200);
    expect(res.text).toContain("portal shell");
    expect(res.text).not.toContain("broker tool shell");
  });
});
