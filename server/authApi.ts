import { Router } from "express";
import { z } from "zod/v4";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  findBrokerDirectoryEntry,
  isBrokerDirectoryAdmin,
} from "@shared/brokerDirectory";
import { getSessionCookieOptions } from "./_core/cookies";
import { localAuth, sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { upsertUser } from "./db";
import {
  handlePlatformPasswordLogin,
  handlePlatformLogout,
  isPlatformPasswordLoginBody,
} from "./auth/passwordPlatformAuth";
import { resolvePlatformUserFromRequest } from "./auth/platformSession";

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

  const brokerEntry = findBrokerDirectoryEntry(email);
  if (!brokerEntry) {
    res.status(400).json({ success: false, error: "Email not recognized. Use your @lee-associates.com email." });
    return;
  }

  const openId = localAuth.toLocalOpenId(email);
  const name = brokerEntry.name || parsed.data.name?.trim() || email;
  const isAdminIdentity =
    ENV.localAdminEmails.includes(email) ||
    ENV.localAdminNames.includes(name.trim().toLowerCase()) ||
    isBrokerDirectoryAdmin(brokerEntry);
  const role = isAdminIdentity ? "admin" : "user";

  await upsertUser({
    openId,
    email,
    name,
    loginMethod: "local",
    role,
    lastSignedIn: new Date(),
  });

  const sessionToken = await sdk.createSessionToken(openId, { name, email });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  res.json({
    success: true,
    data: {
      user: {
        openId,
        name,
        email,
        role: role === "admin" ? "ADMIN" : "AGENT",
        office: brokerEntry.office,
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

