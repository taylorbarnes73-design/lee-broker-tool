import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { findAppUserByUsernameOrEmail, resolvePlatformUserFromRequest } from "../auth/platformSession";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { sdk, localAuth } from "./sdk";
import { getTrustedAdminPolicyName, isAdminByPolicy } from "../auth/isAdminByPolicy";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const platformUser = await resolvePlatformUserFromRequest(opts.req);
  if (platformUser) {
    const openId = localAuth.toLocalOpenId(platformUser.email);
    const resolvedAdmin =
      platformUser.role === "admin" || isAdminByPolicy(platformUser.email, platformUser.fullName);
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
      const email = user.email ?? "";
      const db = await getDb();
      const appUser = db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
      if (appUser && !appUser.isActive) {
        user = null;
      } else {
        const trustedAdminPolicyName = getTrustedAdminPolicyName(email, appUser?.fullName);
        const resolvedAdmin =
          user.role === "admin" || appUser?.role === "admin" || isAdminByPolicy(email, trustedAdminPolicyName);
        user = { ...user, role: resolvedAdmin ? "admin" : "user" };
      }
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
