import { vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

export const testUser: User = {
  id: 1,
  openId: "local:test-user",
  name: "Test User",
  email: "testuser@lee-associates.com",
  loginMethod: "local",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};

export function testCtx(overrides?: Partial<User>): TrpcContext {
  return {
    user: { ...testUser, ...overrides },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}
