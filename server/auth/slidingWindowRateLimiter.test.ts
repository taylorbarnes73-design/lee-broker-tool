import { afterEach, describe, expect, it, vi } from "vitest";
import { SlidingWindowRateLimiter } from "./slidingWindowRateLimiter";

describe("SlidingWindowRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits after max failures within the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));

    const limiter = new SlidingWindowRateLimiter(3, 10 * 60 * 1000);
    expect(limiter.isLimited("ip-1")).toBe(false);

    limiter.recordFailure("ip-1");
    limiter.recordFailure("ip-1");
    expect(limiter.isLimited("ip-1")).toBe(false);

    limiter.recordFailure("ip-1");
    expect(limiter.isLimited("ip-1")).toBe(true);
  });

  it("expires failures outside the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));

    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.recordFailure("ip-2");
    limiter.recordFailure("ip-2");
    expect(limiter.isLimited("ip-2")).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(limiter.isLimited("ip-2")).toBe(false);
  });
});
