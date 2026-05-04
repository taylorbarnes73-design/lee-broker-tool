import type { PlatformAuthUser } from "../auth/platformAuthTypes";

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` when a valid `lbt_session` cookie is present. */
      user?: PlatformAuthUser;
    }
  }
}

export {};
