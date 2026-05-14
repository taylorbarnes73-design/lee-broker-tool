import { Router } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  findBrokerDirectoryEntry,
} from "@shared/brokerDirectory";
import { getSessionCookieOptions } from "./_core/cookies";
import { localAuth, sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { getDb, upsertUser } from "./db";
import { appUsers } from "../drizzle/schema";
import {
  handlePlatformPasswordLogin,
  handlePlatformLogout,
  isPlatformPasswordLoginBody,
} from "./auth/passwordPlatformAuth";
import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "./auth/platformSession";
import { linkPlatformSessionAfterLegacyLogin } from "./auth/linkPlatformSessionAfterLegacyLogin";
import { isAdminByPolicy } from "./auth/isAdminByPolicy";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  name: z.string().trim().min(2).max(120).optional(),
});

function normalizeLeeLogin(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value || value.includes("@")) return localAuth.normalizeEmail(value);
  return localAuth.normalizeEmail(`${value}@lee-associates.com`);
}

export const authApiRouter = Router();

authApiRouter.post("/login", async (req, res) => {
  if (isPlatformPasswordLoginBody(req.body)) {
    await handlePlatformPasswordLogin(req, res);
    return;
  }

  if (!localAuth.isEnabled()) {
    res.status(400).json({ success: false, error: "Local auth is disabled." });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const email = normalizeLeeLogin(parsed.data.email);
  if (!z.string().email().safeParse(email).success) {
    res.status(400).json({ success: false, error: "Enter your Lee username or email address." });
    return;
  }

  const allowedDomain = (process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    res.status(400).json({ success: false, error: `Use your ${allowedDomain} email address.` });
    return;
  }

  let brokerEntry = findBrokerDirectoryEntry(email);
  let name = parsed.data.name?.trim() || email;
  let role: "admin" | "user" = "user";
  let isFromDb = false;

  let db: Awaited<ReturnType<typeof getDb>> = null;
  let appUserRecord: Awaited<ReturnType<typeof findAppUserByUsernameOrEmail>> = undefined;
  try {
    db = await getDb();
    if (db) {
      appUserRecord = await findAppUserByUsernameOrEmail(db, email);
      if (appUserRecord && appUserRecord.isActive) {
        isFromDb = true;
        name = appUserRecord.fullName || name;
        role = appUserRecord.role === "admin" ? "admin" : "user";
      }
    }
  } catch (err) {
    console.error("[auth.login] Database query failed (fallback to hardcoded directory):", err);
  }

  if (!brokerEntry && !isFromDb) {
    res.status(400).json({ success: false, error: "Email not recognized. Use your @lee-associates.com email." });
    return;
  }

  const openId = localAuth.toLocalOpenId(email);
  if (!isFromDb) {
    name = brokerEntry?.name || name;
  }

  // Apply policy-based admin override regardless of whether the user was found in
  // app_users. This lets LOCAL_ADMIN_EMAILS / LOCAL_ADMIN_NAMES / broker-directory
  // admin flags grant admin access even if app_users.role was set incorrectly.
  if (role !== "admin" && isAdminByPolicy(email, name, appUserRecord?.username)) {
    role = "admin";
  }

  // Auto-fix app_users.role when the resolved role is higher than what's stored.
  if (role === "admin" && db && appUserRecord && appUserRecord.role !== "admin") {
    try {
      await db.update(appUsers).set({ role: "admin" }).where(eq(appUsers.id, appUserRecord.id));
    } catch (upgradeErr) {
      console.error("[auth.login] Could not upgrade app_users role to admin:", upgradeErr);
    }
  }

  let sessionToken: string;
  try {
    try {
      await upsertUser({
        openId,
        email,
        name,
        loginMethod: "local",
        role,
        lastSignedIn: new Date(),
      });
    } catch (dbErr) {
      console.error("[auth.login] Database write failed:", dbErr);
      res.status(500).json({ success: false, error: "Could not complete sign-in (database error). Please try again or contact support." });
      return;
    }

    try {
      sessionToken = await sdk.createSessionToken(openId, { name, email });
    } catch (sessionErr) {
      const secretSet = Boolean(String(ENV.cookieSecret ?? "").trim());
      console.error("[auth.login] Session token signing failed:", { secretSet, err: sessionErr });
      res.status(500).json({
        success: false,
        error: secretSet
          ? "Could not complete sign-in (session error). Please try again or contact support."
          : "Broker sign-in is not configured (missing JWT_SECRET). Set JWT_SECRET in the server environment and redeploy.",
      });
      return;
    }
  } catch (err) {
    console.error("[auth.login] Sign-in failed:", err);
    res.status(500).json({ success: false, error: "Could not complete sign-in. Please try again or contact support." });
    return;
  }

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  try {
    await linkPlatformSessionAfterLegacyLogin(req, res, email);
  } catch (linkErr) {
    console.error("[auth.login] Platform session link failed (legacy session cookie is set):", linkErr);
  }

  res.json({
    success: true,
    data: {
      user: {
        openId,
        name,
        email,
        role: role === "admin" ? "ADMIN" : "AGENT",
        office: brokerEntry?.office,
      },
    },
  });
});

authApiRouter.post("/logout", async (req, res) => {
  await handlePlatformLogout(req, res);
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});

authApiRouter.get("/me", async (req, res) => {
  const platformUser = await resolvePlatformUserFromRequest(req);
  if (platformUser) {
    res.json({
      id: platformUser.id,
      email: platformUser.email,
      username: platformUser.username,
      full_name: platformUser.fullName,
      role: platformUser.role,
      office: platformUser.office,
    });
    return;
  }

  try {
    const user = await sdk.authenticateRequest(req);
    res.json({
      success: true,
      data: {
        user: {
          openId: user.openId,
          name: user.name,
          email: user.email,
          role: user.role === "admin" ? "ADMIN" : "AGENT",
        },
      },
    });
  } catch {
    res.status(401).json({ success: false, error: "Not authenticated" });
  }
});

