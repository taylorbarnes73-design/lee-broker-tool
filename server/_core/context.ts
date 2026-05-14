import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { findAppUserByUsernameOrEmail, resolvePlatformUserFromRequest } from "../auth/platformSession";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { sdk, localAuth } from "./sdk";
import { isAdminByPolicy } from "../auth/isAdminByPolicy";

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
      platformUser.role === "admin" || isAdminByPolicy(platformUser.email, platformUser.fullName, platformUser.username);
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
      const legacyUser = await sdk.authenticateRequest(opts.req);
      const email = legacyUser.email ?? "";
      const db = await getDb();
      const appUser = db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
      user = {
        ...legacyUser,
        role:
          legacyUser.role === "admin" || isAdminByPolicy(legacyUser.email, legacyUser.name, appUser?.username)
            ? "admin"
            : "user",
      };
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
