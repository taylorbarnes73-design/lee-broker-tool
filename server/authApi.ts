import { Router } from "express";
import { z } from "zod/v4";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { localAuth, sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { getUserByOpenId, upsertUser } from "./db";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(2).max(120).optional(),
});

function isAdminIdentity(params: { email: string; name?: string | null }) {
  const email = params.email.trim().toLowerCase();
  const name = (params.name ?? "").trim().toLowerCase();
  return ENV.localAdminEmails.includes(email) || (name && ENV.localAdminNames.includes(name));
}

export const authApiRouter = Router();

authApiRouter.post("/login", async (req, res) => {
  if (!localAuth.isEnabled()) {
    res.status(400).json({ success: false, error: "Local auth is disabled." });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const email = localAuth.normalizeEmail(parsed.data.email);
  const openId = localAuth.toLocalOpenId(email);
  const name = parsed.data.name?.trim() || email;
  const role = isAdminIdentity({ email, name }) ? "admin" : "user";

  // Password-based local auth is disabled until all environments have applied
  // the `users.passwordHash` migration. We still allow local login via broker directory.
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
      user: { openId, name, email, role: role === "admin" ? "ADMIN" : "AGENT" },
    },
  });
});

authApiRouter.post("/logout", (req, res) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});

authApiRouter.get("/me", async (req, res) => {
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

