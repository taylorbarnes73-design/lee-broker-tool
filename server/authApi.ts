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
import { handleChangePlatformPassword } from "./auth/changePlatformPassword";
import { resolvePlatformUserFromRequest, findAppUserByUsernameOrEmail } from "./auth/platformSession";
import { parseLeeLoginIdentifier } from "@shared/leeLogin";
import { linkPlatformSessionAfterLegacyLogin } from "./auth/linkPlatformSessionAfterLegacyLogin";
import { getTrustedAdminPolicyName, isAdminByPolicy } from "./auth/isAdminByPolicy";
import { getRequestIp } from "./auth/requestIp";
import { isLoginRateLimited, recordLoginFailure } from "./auth/loginRateLimiter";
import { requireAuth } from "./middleware/requireAuth";
import {
  clearUserDealiusCredentials,
  getUserDealiusCredentials,
  saveUserDealiusCredentials,
} from "./services/userDealiusCredentials";

const loginSchema = z.object({
  email: z.string().trim().min(1).max(320),
  name: z.string().trim().min(2).max(120).optional(),
});

function normalizeLeeLogin(raw: string) {
  const parsed = parseLeeLoginIdentifier(raw, ENV.localAuthEmailDomain);
  return parsed.ok ? parsed.value.email : null;
}

export const authApiRouter = Router();

authApiRouter.post("/login", async (req, res) => {
  if (isPlatformPasswordLoginBody(req.body)) {
    await handlePlatformPasswordLogin(req, res);
    return;
  }

  const ip = getRequestIp(req);
  if (isLoginRateLimited(ip)) {
    res.status(429).json({ success: false, error: "Too many login attempts. Try again later." });
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
  if (!email) {
    const loginId = parseLeeLoginIdentifier(parsed.data.email, ENV.localAuthEmailDomain);
    res.status(400).json({
      success: false,
      error: loginId.ok ? "Enter your Lee username or email address." : loginId.error,
    });
    return;
  }

  if (!z.string().email().safeParse(email).success) {
    res.status(400).json({ success: false, error: "Enter your Lee username or email address." });
    return;
  }

  const allowedDomain = (ENV.localAuthEmailDomain ?? "").trim().toLowerCase();
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    res.status(400).json({ success: false, error: `Use your @${allowedDomain} email or Lee username only.` });
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

  if (appUserRecord && !appUserRecord.isActive) {
    recordLoginFailure(ip);
    res.status(403).json({
      success: false,
      error: "Your account is inactive. Contact an administrator for access.",
    });
    return;
  }

  if (!brokerEntry && !isFromDb) {
    recordLoginFailure(ip);
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
  if (
    role !== "admin" &&
    isAdminByPolicy(email, getTrustedAdminPolicyName(email, appUserRecord?.fullName), appUserRecord?.username)
  ) {
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

const dealiusCredentialsBody = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});

authApiRouter.get("/me/dealius-credentials", requireAuth, async (req, res) => {
  const creds = await getUserDealiusCredentials(req.user!.id);
  res.json({
    success: true,
    data: creds ? { username: creds.username, password: creds.password } : { username: null, password: null },
  });
});

authApiRouter.put("/me/dealius-credentials", requireAuth, async (req, res) => {
  const parsed = dealiusCredentialsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = await saveUserDealiusCredentials(req.user!.id, parsed.data.username, parsed.data.password);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.message });
    return;
  }
  res.json({ success: true, message: result.message });
});

authApiRouter.delete("/me/dealius-credentials", requireAuth, async (req, res) => {
  await clearUserDealiusCredentials(req.user!.id);
  res.json({ success: true });
});

authApiRouter.put("/me/password", requireAuth, async (req, res) => {
  await handleChangePlatformPassword(req, res);
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
    // Apply policy-based admin override even when the user came in via the
    // legacy JWT path, so admins recognized by LOCAL_ADMIN_EMAILS,
    // LOCAL_ADMIN_NAMES, or the broker directory aren’t silently downgraded
    // to AGENT here.
    let appUserRecord: Awaited<ReturnType<typeof findAppUserByUsernameOrEmail>> = undefined;
    try {
      const db = await getDb();
      if (db && user.email) {
        appUserRecord = await findAppUserByUsernameOrEmail(db, user.email);
      }
    } catch (err) {
      console.error("[auth.me] Could not resolve app user for legacy session:", err);
    }
    if (appUserRecord && !appUserRecord.isActive) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const resolvedRole: "admin" | "user" =
      user.role === "admin" ||
      isAdminByPolicy(user.email, getTrustedAdminPolicyName(user.email, appUserRecord?.fullName), appUserRecord?.username)
        ? "admin"
        : "user";
    res.json({
      success: true,
      data: {
        user: {
          openId: user.openId,
          name: user.name,
          email: user.email,
          role: resolvedRole === "admin" ? "ADMIN" : "AGENT",
        },
      },
    });
  } catch {
    res.status(401).json({ success: false, error: "Not authenticated" });
  }
});

