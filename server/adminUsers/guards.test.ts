import { describe, expect, it } from "vitest";
import { lastActiveAdminBlocked, selfDeactivationBlocked, selfRoleOrDeactivationBlocked } from "./guards";

describe("lastActiveAdminBlocked", () => {
  it("blocks demoting the only active admin", () => {
    const msg = lastActiveAdminBlocked(
      { role: "admin", isActive: true },
      { role: "broker" },
      1
    );
    expect(msg).toBeTruthy();
  });

  it("allows demoting an admin when another active admin exists", () => {
    expect(
      lastActiveAdminBlocked({ role: "admin", isActive: true }, { role: "broker" }, 2)
    ).toBeNull();
  });

  it("blocks deactivating the only active admin", () => {
    const msg = lastActiveAdminBlocked(
      { role: "admin", isActive: true },
      { is_active: false },
      1
    );
    expect(msg).toBeTruthy();
  });

  it("ignores non-admin targets", () => {
    expect(lastActiveAdminBlocked({ role: "broker", isActive: true }, { role: "readonly" }, 1)).toBeNull();
  });
});

describe("selfRoleOrDeactivationBlocked", () => {
  it("blocks self role demotion", () => {
    const msg = selfRoleOrDeactivationBlocked("u1", "u1", { role: "broker" });
    expect(msg).toContain("own role");
  });

  it("blocks self deactivation", () => {
    const msg = selfRoleOrDeactivationBlocked("u1", "u1", { is_active: false });
    expect(msg).toContain("deactivate");
  });

  it("allows other users to be updated by admin", () => {
    expect(selfRoleOrDeactivationBlocked("admin", "u1", { role: "broker" })).toBeNull();
  });
});

describe("selfDeactivationBlocked", () => {
  it("blocks deleting own account (soft delete)", () => {
    expect(selfDeactivationBlocked("u1", "u1")).toBeTruthy();
  });
});
