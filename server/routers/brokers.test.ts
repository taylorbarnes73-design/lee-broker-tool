import { beforeEach, describe, expect, it, vi } from "vitest";
import { brokersRouter } from "./brokers";
import { testCtx } from "../testCtx";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: getDbMock,
}));

type AppUserRosterRow = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "broker" | "readonly";
  office: string | null;
  isActive: boolean;
};

function makeDbMock(rows: AppUserRosterRow[]) {
  const from = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

describe("brokers.list", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("labels active readonly database users as read-only instead of brokers", async () => {
    getDbMock.mockResolvedValue(
      makeDbMock([
        {
          id: "readonly-user-id",
          email: "readonly@example.com",
          fullName: "Readonly User",
          role: "readonly",
          office: "Newport Beach",
          isActive: true,
        },
      ])
    );

    const caller = brokersRouter.createCaller(testCtx());
    const rows = await caller.list();

    const readonlyUser = rows.find(row => row.email === "readonly@example.com");
    expect(readonlyUser).toMatchObject({ role: "Read-Only" });
    expect(readonlyUser?.role).not.toMatch(/broker/i);
  });
});
