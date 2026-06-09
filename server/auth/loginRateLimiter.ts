import {
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from "./constants";
import { SlidingWindowRateLimiter } from "./slidingWindowRateLimiter";

const loginLimiter = new SlidingWindowRateLimiter(
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  LOGIN_RATE_LIMIT_WINDOW_MS
);

export function recordLoginFailure(ip: string) {
  loginLimiter.recordFailure(ip);
}

export function isLoginRateLimited(ip: string): boolean {
  return loginLimiter.isLimited(ip);
}

/** Test-only reset */
export function clearLoginRateLimiterForTests() {
  loginLimiter.clear();
}
