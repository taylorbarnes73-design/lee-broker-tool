import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearGraphTokenCache, listSharedMailboxMessages } from "./msGraph";

describe("listSharedMailboxMessages", () => {
  const originalFetch = globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearGraphTokenCache();
    fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "token", expires_in: 3600 }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      );
    globalThis.fetch = fetchSpy as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("requests messages oldest-first so capped polls do not skip older mail", async () => {
    await listSharedMailboxMessages(
      { tenantId: "tenant", clientId: "client", clientSecret: "secret" },
      {
        mailbox: "brokeradmin@example.com",
        since: new Date("2026-05-19T00:00:00.000Z"),
        top: 50,
        maxResults: 200,
      }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const graphUrl = new URL(String(fetchSpy.mock.calls[1]?.[0]));
    expect(graphUrl.searchParams.get("$orderby")).toBe("receivedDateTime asc");
  });
});
