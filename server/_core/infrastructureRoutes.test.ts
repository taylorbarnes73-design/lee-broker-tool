import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerInfrastructureRoutes } from "./infrastructureRoutes";

function buildApp() {
  const app = express();
  registerInfrastructureRoutes(app);
  return app;
}

describe("infrastructure routes", () => {
  it("keeps ALB health checks available", async () => {
    const res = await request(buildApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });

  it("does not expose the temporary production seed endpoint", async () => {
    const res = await request(buildApp()).get("/api/seed-prod");

    expect(res.status).toBe(404);
  });
});
