import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildApp(router: express.Router) {
  const app = express();
  app.use("/api", router);
  return app;
}

describe("mapsApiRouter autocomplete routes", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("serves the canonical autocomplete route", async () => {
    const { mapsApiRouter } = await import("./mapsApi");
    const res = await request(buildApp(mapsApiRouter)).get(
      "/api/places/autocomplete?input=ab"
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it("keeps the legacy autocomplete route working", async () => {
    const { mapsApiRouter } = await import("./mapsApi");
    const res = await request(buildApp(mapsApiRouter)).get(
      "/api/maps/places/autocomplete?input=ab"
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });
});
