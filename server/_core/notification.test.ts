import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyOwner } from "./notification";
import { ENV } from "./env";

describe("notifyOwner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "";
  });

  it("throws for missing forge API URL", async () => {
    ENV.forgeApiKey = "secret";

    await expect(
      notifyOwner({ title: "Subject", content: "Body" })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured.",
    });
  });

  it("throws for missing forge API key", async () => {
    ENV.forgeApiUrl = "https://forge.example.com";

    await expect(
      notifyOwner({ title: "Subject", content: "Body" })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured.",
    });
  });

  it("validates title and content", async () => {
    ENV.forgeApiUrl = "https://forge.example.com";
    ENV.forgeApiKey = "secret";

    await expect(notifyOwner({ title: " ", content: "Body" })).rejects.toMatchObject<
      Partial<TRPCError>
    >({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
    await expect(notifyOwner({ title: "Title", content: " " })).rejects.toMatchObject<
      Partial<TRPCError>
    >({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  });

  it("returns true when upstream accepts the notification and trims payload", async () => {
    ENV.forgeApiUrl = "https://forge.example.com";
    ENV.forgeApiKey = "secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyOwner({
      title: "  Subject  ",
      content: "  Body text  ",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://forge.example.com/webdevtoken.v1.WebDevService/SendNotification"
    );
    expect(requestInit?.headers).toMatchObject({
      authorization: "Bearer secret",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      accept: "application/json",
    });
    expect(requestInit?.body).toBe(
      JSON.stringify({ title: "Subject", content: "Body text" })
    );
  });

  it("returns false and logs warning when upstream responds with non-ok status", async () => {
    ENV.forgeApiUrl = "https://forge.example.com/";
    ENV.forgeApiKey = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: vi.fn().mockResolvedValue("upstream unavailable"),
      })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await notifyOwner({ title: "Subject", content: "Body" });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns false and logs warning when fetch throws", async () => {
    ENV.forgeApiUrl = "https://forge.example.com";
    ENV.forgeApiKey = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await notifyOwner({ title: "Subject", content: "Body" });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[Notification] Error calling notification service:",
      expect.any(Error)
    );
  });
});
