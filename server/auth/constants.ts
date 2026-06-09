/** HttpOnly cookie holding the raw platform session token (legacy uses `app_session_id`). */
export const LBT_SESSION_COOKIE = "lbt_session";

/** Platform session lifetime (matches default app_settings security.session_timeout_hours seed). */
export const LBT_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export const PASSWORD_CHANGE_RATE_LIMIT_MAX_FAILURES = 5;
export const PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
