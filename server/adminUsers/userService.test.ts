import { describe, expect, it, vi, beforeEach } from "vitest";
import { createUser, reactivateUser, softDeleteUser } from "./userService";
import { writeAuditLog } from "../auth/writeAuditLog";
import { AdminUserError } from "./adminErrors";

vi.mock("../auth/writeAuditLog", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./inviteMail", () => ({
  isAdminInviteSmtpConfigured: vi.fn(() => false),
  sendUserInviteEmail: vi.fn(),
}));

const actor = {
  id: "admin-1",
  email: "admin@example.com",
  username: "admin",
  fullName: "Admin Person",
  role: "admin" as const,
  office: null,
};

function mockDbForCreate(opts: { emailDup?: boolean; usernameDup?: boolean }) {
  let whereLimitCalls = 0;
  let inserted: Record<string, unknown> | null = null;

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            whereLimitCalls++;
            if (whereLimitCalls === 1 && opts.emailDup) return [{ id: "x" }];
            if (whereLimitCalls === 2 && opts.usernameDup) return [{ id: "y" }];
            return [];
          },
        }),
        leftJoin: () => ({
          where: () => ({
            limit: async () => [
              {
                id: inserted!.id,
                email: inserted!.email,
                username: inserted!.username,
                fullName: inserted!.fullName,
                role: inserted!.role,
                office: inserted!.office,
                phone: inserted!.phone,
                isActive: inserted!.isActive,
                lastLoginAt: inserted!.lastLoginAt,
                createdAt: inserted!.createdAt,
                createdByName: actor.fullName,
                forcePasswordChangeNextLogin: inserted!.forcePasswordChangeNextLogin,
              },
            ],
          }),
        }),
      }),
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        inserted = {
          ...v,
          lastLoginAt: null,
          createdAt: new Date(),
        };
      },
    }),
  };
}

describe("createUser", () => {
  beforeEach(() => {
    vi.mocked(writeAuditLog).mockClear();
  });

  it("creates a user, returns note when SMTP is off, and writes audit", async () => {
    const db = mockDbForCreate({}) as any;
    const req = { headers: {}, ip: "127.0.0.1" } as any;
    const out = await createUser(
      db,
      {
        email: "new@lee-associates.com",
        username: "newbroker",
        full_name: "New Broker",
        role: "broker",
        send_invite: false,
      },
      actor,
      "https://app.example.com",
      req
    );

    expect(out.user.email).toBe("new@lee-associates.com");
    expect(out.user.username).toBe("newbroker");

    expect(writeAuditLog).toHaveBeenCalledWith(
      "admin-1",
      "user.created",
      "user",
      expect.any(String),
      expect.objectContaining({ role: "broker", created_by_name: "Admin Person" }),
      req
    );
  });

  it("rejects duplicate email", async () => {
    const db = mockDbForCreate({ emailDup: true }) as any;
    const req = { headers: {} } as any;
    await expect(
      createUser(
        db,
        {
          email: "dup@lee-associates.com",
          username: "u2",
          full_name: "Dup",
          role: "broker",
          send_invite: false,
        },
        actor,
        "https://app.example.com",
        req
      )
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});

describe("AdminUserError shape", () => {
  it("carries status and code", () => {
    const e = new AdminUserError(409, "DUPLICATE_EMAIL", "dup", "email");
    expect(e.status).toBe(409);
    expect(e.code).toBe("DUPLICATE_EMAIL");
    expect(e.field).toBe("email");
  });
});

describe("reactivateUser", () => {
  it("writes user.reactivated audit", async () => {
    vi.mocked(writeAuditLog).mockClear();
    const inactive = {
      id: "u1",
      email: "u@e.com",
      username: "u1",
      fullName: "U",
      role: "broker" as const,
      office: null,
      phone: null,
      isActive: false,
      deactivatedAt: new Date(),
      passwordHash: "x",
      forcePasswordChangeNextLogin: false,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };
    let selectN = 0;
    const db = {
      select: () => ({
        from: () => {
          selectN++;
          if (selectN === 1) {
            return {
              where: () => ({
                limit: async () => [inactive],
              }),
            };
          }
          return {
            leftJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    ...inactive,
                    isActive: true,
                    deactivatedAt: null,
                    createdByName: "Admin Person",
                  },
                ],
              }),
            }),
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
    };
    await reactivateUser(db as any, "u1", actor, { headers: {} } as any);
    expect(writeAuditLog).toHaveBeenCalledWith(
      actor.id,
      "user.reactivated",
      "user",
      "u1",
      {},
      expect.anything()
    );
  });
});

describe("softDeleteUser", () => {
  it("writes user.deactivated audit", async () => {
    vi.mocked(writeAuditLog).mockClear();
    const broker = {
      id: "u2",
      email: "b@e.com",
      username: "b2",
      fullName: "B",
      role: "broker" as const,
      office: null,
      phone: null,
      isActive: true,
      deactivatedAt: null,
      passwordHash: "x",
      forcePasswordChangeNextLogin: false,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };
    const db = {
      select: (fields?: { c?: unknown }) => {
        if (fields && Object.prototype.hasOwnProperty.call(fields, "c")) {
          return {
            from: () => ({
              where: async () => [{ c: 2 }],
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: async () => [broker],
            }),
            leftJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    ...broker,
                    isActive: false,
                    deactivatedAt: new Date(),
                    createdByName: "Admin Person",
                  },
                ],
              }),
            }),
          }),
        };
      },
      update: () => ({
        set: () => ({
          where: async () => {},
        }),
      }),
    };
    await softDeleteUser(db as any, "u2", actor, { headers: {} } as any);
    expect(writeAuditLog).toHaveBeenCalledWith(
      actor.id,
      "user.deactivated",
      "user",
      "u2",
      {},
      expect.anything()
    );
  });
});
