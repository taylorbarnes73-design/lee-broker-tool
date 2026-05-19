import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import {
  findAppUserByUsernameOrEmail,
  resolvePlatformUserFromRequest,
} from "../auth/platformSession";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { sdk, localAuth } from "./sdk";
import { isAdminByPolicy } from "../auth/isAdminByPolicy";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function emailFromLocalOpenId(openId: string): string | null {
  return openId.startsWith("local:") ? openId.slice("local:".length) : null;
}

async function resolveSignedLegacyCookie(
  req: CreateExpressContextOptions["req"]
): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await sdk.verifySession(cookies[COOKIE_NAME]);
  if (!session) return null;

  const now = new Date();
  const email = session.email ?? emailFromLocalOpenId(session.openId);
  const name = session.name || email || "Broker";
  const db = await getDb();
  if (db && email) {
    const appUser = await findAppUserByUsernameOrEmail(db, email);
    if (appUser) return null;
  }

  return {
    id: 0,
    openId: session.openId,
    name,
    email: email ?? null,
    loginMethod: "local",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const platformUser = await resolvePlatformUserFromRequest(opts.req);
  if (platformUser) {
    const openId = localAuth.toLocalOpenId(platformUser.email);
    const resolvedAdmin =
      platformUser.role === "admin" ||
      isAdminByPolicy(
        platformUser.email,
        platformUser.fullName,
        platformUser.username
      );
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
      let appUser: Awaited<
        ReturnType<typeof findAppUserByUsernameOrEmail>
      > | null = null;
      try {
        const db = await getDb();
        appUser =
          db && email ? await findAppUserByUsernameOrEmail(db, email) : null;
      } catch (error) {
        console.error(
          "[trpc.context] Could not resolve platform user for legacy session:",
          error
        );
        return { req: opts.req, res: opts.res, user: null };
      }
      if (appUser) {
        user = null;
      } else {
        user = {
          ...legacyUser,
          role: "user",
        };
      }
    } catch {
      user = await resolveSignedLegacyCookie(opts.req);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
