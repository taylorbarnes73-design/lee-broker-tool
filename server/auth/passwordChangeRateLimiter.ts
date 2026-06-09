import {
  PASSWORD_CHANGE_RATE_LIMIT_MAX_FAILURES,
  PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS,
} from "./constants";
import { SlidingWindowRateLimiter } from "./slidingWindowRateLimiter";

const passwordChangeLimiter = new SlidingWindowRateLimiter(
  PASSWORD_CHANGE_RATE_LIMIT_MAX_FAILURES,
  PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS
);

export function passwordChangeRateLimitKey(userId: string, ip: string): string {
  return `${userId}:${ip}`;
}

export function recordPasswordChangeFailure(userId: string, ip: string) {
  passwordChangeLimiter.recordFailure(passwordChangeRateLimitKey(userId, ip));
}

export function isPasswordChangeRateLimited(userId: string, ip: string): boolean {
  return passwordChangeLimiter.isLimited(passwordChangeRateLimitKey(userId, ip));
}

/** Test-only reset */
export function clearPasswordChangeRateLimiterForTests() {
  passwordChangeLimiter.clear();
}
