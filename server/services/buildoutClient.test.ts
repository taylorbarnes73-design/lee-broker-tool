import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildoutJsonRequest,
  createBuildoutProperty,
  parseBuildoutPropertyIdFromPayload,
  updateBuildoutProperty,
} from "./buildoutClient";

describe("parseBuildoutPropertyIdFromPayload", () => {
  it("reads numeric id from property wrapper", () => {
    expect(parseBuildoutPropertyIdFromPayload({ property: { id: 99 } })).toBe(99);
  });

  it("reads string id", () => {
    expect(parseBuildoutPropertyIdFromPayload({ property: { id: "7" } })).toBe(7);
  });

  it("returns null when missing", () => {
    expect(parseBuildoutPropertyIdFromPayload({})).toBeNull();
  });
});

describe("buildoutJsonRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts JSON to keyed URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ property: { id: 5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await buildoutJsonRequest({
      apiKey: "secret-key",
      apiBaseUrl: "https://buildout.com/api/v1",
      method: "POST",
      resourcePath: "properties.json",
      body: { property: { broker_id: 1 } },
    });

    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/");
    expect(url).toContain("properties.json");
    expect(url).toContain(encodeURIComponent("secret-key"));
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ property: { broker_id: 1 } });
  });
});

describe("createBuildoutProperty", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns property id on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ property: { id: 42, address: "x" } }),
      })
    );

    const r = await createBuildoutProperty({
      apiKey: "k",
      property: { broker_id: 1, address: "1 Main" },
    });
    expect(r.propertyId).toBe(42);
  });

  it("throws when response omits id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ property: {} }),
      })
    );

    await expect(
      createBuildoutProperty({ apiKey: "k", property: { broker_id: 1 } })
    ).rejects.toThrow(/property\.id/);
  });
});

describe("updateBuildoutProperty", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("PUTs to properties/{id}.json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ property: { id: 10 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateBuildoutProperty({
      apiKey: "k",
      propertyId: 10,
      property: { name: "Updated" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("properties/10.json");
    expect(init.method).toBe("PUT");
  });
});
