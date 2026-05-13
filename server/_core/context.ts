import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { resolvePlatformUserFromRequest } from "../auth/platformSession";
import { getUserByOpenId, upsertUser } from "../db";
import { sdk, localAuth } from "./sdk";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function isEnvAdmin(email: string | null | undefined, fullName: string | null | undefined): boolean {
  const emailLower = (email ?? "").trim().toLowerCase();
  const nameLower = (fullName ?? "").trim().toLowerCase();
  return (
    (emailLower.length > 0 && ENV.localAdminEmails.includes(emailLower)) ||
    (nameLower.length > 0 && ENV.localAdminNames.includes(nameLower))
  );
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const platformUser = await resolvePlatformUserFromRequest(opts.req);
  if (platformUser) {
    const openId = localAuth.toLocalOpenId(platformUser.email);
    // ENV admin overrides take precedence over app_users.role so that
    // LOCAL_ADMIN_EMAILS / LOCAL_ADMIN_NAMES always grant admin access.
    const resolvedAdmin =
      platformUser.role === "admin" || isEnvAdmin(platformUser.email, platformUser.fullName);
    const legacyRole: "admin" | "user" = resolvedAdmin ? "admin" : "user";
    await upsertUser({
      openId,
      name: platformUser.fullName,
      email: platformUser.email,
      loginMethod: "platform",
      role: legacyRole,
      lastSignedIn: new Date(),
    });
    const row = await getUserByOpenId(openId);
    if (row) {
      user = {
        ...row,
        name: platformUser.fullName,
        email: platformUser.email ?? row.email,
        role: legacyRole,
        lastSignedIn: new Date(),
      };
    }
  }

  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
