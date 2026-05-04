import type { Request, Response } from "express";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { LBT_SESSION_COOKIE, LBT_SESSION_MAX_AGE_MS } from "./constants";
import { createPlatformSession, findAppUserByUsernameOrEmail } from "./platformSession";

/**
 * After a successful legacy (broker-directory) login, attach a platform `lbt_session`
 * when a matching `app_users` row exists so existing sessions gain platform auth without
 * forcing another sign-in.
 */
export async function linkPlatformSessionAfterLegacyLogin(
  req: Request,
  res: Response,
  email: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const user = await findAppUserByUsernameOrEmail(db, email);
  if (!user?.isActive) return;

  const { rawToken } = await createPlatformSession(db, user.id, req);
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LBT_SESSION_COOKIE, rawToken, { ...cookieOptions, maxAge: LBT_SESSION_MAX_AGE_MS });
}
