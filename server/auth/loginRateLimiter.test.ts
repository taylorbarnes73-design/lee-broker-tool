import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLoginRateLimiterForTests,
  isLoginRateLimited,
  recordLoginFailure,
} from "./loginRateLimiter";

describe("loginRateLimiter", () => {
  beforeEach(() => {
    clearLoginRateLimiterForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearLoginRateLimiterForTests();
  });

  it("blocks after repeated login failures from the same IP", () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < 4; i += 1) {
      recordLoginFailure(ip);
      expect(isLoginRateLimited(ip)).toBe(false);
    }
    recordLoginFailure(ip);
    expect(isLoginRateLimited(ip)).toBe(true);
  });
});
