import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDealiusUrl, dealiusFetch } from "../lib/dealius/client";

vi.mock("../settings/getSetting", () => ({
  getSetting: vi.fn(async (key: string) => {
    switch (key) {
      case "integrations.dealius_api.enabled":
        return true;
      case "integrations.dealius_api.base_url":
        return "https://leenewportbeach.dealius.com";
      case "integrations.dealius_api.api_key":
        return "test-key-123";
      default:
        return null;
    }
  }),
}));

describe("buildDealiusUrl", () => {
  it("joins base + path normally", () => {
    expect(buildDealiusUrl("https://x.dealius.com", "/api/lookup/listingtypes")).toBe(
      "https://x.dealius.com/api/lookup/listingtypes"
    );
  });
  it("strips trailing slash from base", () => {
    expect(buildDealiusUrl("https://x.dealius.com/", "/api/ping")).toBe(
      "https://x.dealius.com/api/ping"
    );
  });
  it("prepends slash to path when missing", () => {
    expect(buildDealiusUrl("https://x.dealius.com", "api/ping")).toBe(
      "https://x.dealius.com/api/ping"
    );
  });
});

describe("dealiusFetch", () => {
  const originalFetch = globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async (_url: any, _init: any) => new Response("[]", { status: 200 }));
    globalThis.fetch = fetchSpy as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends X-API-KEY header and resolves URL against base", async () => {
    await dealiusFetch("/api/lookup/listingtypes");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://leenewportbeach.dealius.com/api/lookup/listingtypes");
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("X-API-KEY")).toBe("test-key-123");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("throws when disabled", async () => {
    await expect(
      dealiusFetch("/api/x", {
        configOverride: { enabled: false, baseUrl: "https://x.dealius.com", apiKey: "k" },
      })
    ).rejects.toThrow(/disabled/i);
  });

  it("throws when api key missing", async () => {
    await expect(
      dealiusFetch("/api/x", {
        configOverride: { enabled: true, baseUrl: "https://x.dealius.com", apiKey: "" },
      })
    ).rejects.toThrow(/api key/i);
  });
});
