import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

import { canReadStoredFile } from "./fileAccess";

const owner = {
  role: "user",
  openId: "local:owner@lee-associates.com",
  email: "owner@lee-associates.com",
};

function dbReturning(...rowSets: Array<Array<Record<string, unknown>>>) {
  let index = 0;
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => rowSets[index++] ?? []),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  getDbMock.mockReset();
});

describe("canReadStoredFile", () => {
  it("allows a broker to read their archived submission PDF", async () => {
    getDbMock.mockResolvedValue(
      dbReturning([], [{ submittedByOpenId: "local:owner@lee-associates.com" }])
    );

    await expect(canReadStoredFile(owner, "broker-docs/submissions/voucher/generated.pdf")).resolves.toBe(true);
  });

  it("denies broker-admin files to non-admin users", async () => {
    getDbMock.mockResolvedValue(dbReturning([{ uploaderOpenId: "local:owner@lee-associates.com" }]));

    await expect(canReadStoredFile(owner, "broker-admin/request-1/confidential.pdf")).resolves.toBe(false);
  });

  it("allows admins to read admin-only stored files", async () => {
    await expect(
      canReadStoredFile({ role: "admin", email: "admin@lee-associates.com" }, "broker-admin/request-1/confidential.pdf")
    ).resolves.toBe(true);
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
