import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { and, asc, count, desc, eq, ne, or, like, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import type { Request } from "express";
import { appSessions, appUsers, auditLog, users } from "../../drizzle/schema";
import type { PlatformAuthUser } from "../auth/platformAuthTypes";
import { writeAuditLog } from "../auth/writeAuditLog";
import { getDb } from "../db";
import { AdminUserError } from "./adminErrors";
import { lastActiveAdminBlocked, selfDeactivationBlocked, selfRoleOrDeactivationBlocked } from "./guards";
import { sendUserInviteEmail, isAdminInviteSmtpConfigured } from "./inviteMail";
import type { createUserBodySchema, listUsersQuerySchema, patchUserBodySchema } from "./schemas";
import type { z } from "zod/v4";

type AppDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type PatchUserBody = z.infer<typeof patchUserBodySchema>;

function iso(d: Date | string | number | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString();
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function publicUser(row: {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  office: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | string | number;
  createdByName: string | null;
  forcePasswordChangeNextLogin?: boolean;
}) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    full_name: row.fullName,
    role: row.role,
    office: row.office,
    phone: row.phone,
    is_active: row.isActive,
    last_login_at: iso(row.lastLoginAt),
    created_at: iso(row.createdAt)!,
    created_by_name: row.createdByName,
    ...(row.forcePasswordChangeNextLogin !== undefined
      ? { force_password_change_next_login: row.forcePasswordChangeNextLogin }
      : {}),
  };
}

function likePattern(search: string): string | null {
  const t = search.trim().toLowerCase().replace(/[%_\\]/g, "");
  if (!t) return null;
  return `%${t}%`;
}

function sortText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLegacyRole(role: string | null | undefined): "admin" | "broker" {
  return role === "admin" ? "admin" : "broker";
}

function sanitizeLegacyUsername(value: string): string {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  const withLetterPrefix = /^[a-z]/.test(compact) ? compact : `user-${compact || "legacy"}`;
  return withLetterPrefix.slice(0, 31);
}

function deriveLegacyUsername(row: {
  id: number;
  email: string | null;
  openId: string;
}) {
  const emailLocalPart = row.email?.split("@")[0] ?? "";
  if (emailLocalPart.trim()) return sanitizeLegacyUsername(emailLocalPart);
  const openIdTail = row.openId.includes(":") ? row.openId.split(":").pop() ?? row.openId : row.openId;
  const candidate = openIdTail.includes("@") ? openIdTail.split("@")[0] : openIdTail;
  return sanitizeLegacyUsername(candidate || `legacy-${row.id}`);
}

function publicLegacyUser(row: {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: Date | string | number;
  lastSignedIn: Date | string | number;
}) {
  const role = normalizeLegacyRole(row.role);
  return {
    id: `legacy:${row.id}`,
    email: row.email ?? "",
    username: deriveLegacyUsername(row),
    full_name: row.name?.trim() || row.email?.trim() || row.openId || `Legacy User ${row.id}`,
    role,
    office: null,
    phone: null,
    is_active: true,
    last_login_at: iso(row.lastSignedIn),
    created_at: iso(row.createdAt)!,
    created_by_name: null,
    can_manage: false,
  };
}

async function listLegacyUsers(db: AppDb, query: ListUsersQuery) {
  if (query.is_active === "false" || query.role === "readonly") {
    return {
      users: [],
      total: 0,
      page: query.page,
      page_size: query.page_size,
      active_admin_count: 0,
    };
  }

  const conditions: SQL[] = [];
  const pat = query.search ? likePattern(query.search) : null;
  if (pat) {
    conditions.push(or(like(users.name, pat), like(users.email, pat), like(users.openId, pat))!);
  }
  if (query.role === "admin") conditions.push(eq(users.role, "admin"));
  if (query.role === "broker") conditions.push(eq(users.role, "user"));
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(whereClause);

  const activeAdminsRow = await db
    .select({ c: count() })
    .from(users)
    .where(eq(users.role, "admin"));
  const active_admin_count = Number(activeAdminsRow[0]?.c ?? 0);

  const sorted = rows.slice().sort((a, b) => {
    if (query.sort === "name_asc") {
      return (
        sortText(a.name || a.email || a.openId).localeCompare(sortText(b.name || b.email || b.openId)) ||
        sortText(a.email).localeCompare(sortText(b.email))
      );
    }
    if (query.sort === "last_login") {
      const aTime = a.lastSignedIn ? new Date(a.lastSignedIn).getTime() : -Infinity;
      const bTime = b.lastSignedIn ? new Date(b.lastSignedIn).getTime() : -Infinity;
      return bTime - aTime;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = sorted.length;
  const offset = (query.page - 1) * query.page_size;
  const pageRows = sorted.slice(offset, offset + query.page_size);

  return {
    users: pageRows.map(r => publicLegacyUser(r)),
    total,
    page: query.page,
    page_size: query.page_size,
    active_admin_count,
  };
}

export async function listUsers(db: AppDb, query: ListUsersQuery) {
  try {
    const creator = alias(appUsers, "creator");
    const page = query.page;
    const pageSize = query.page_size;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];
    const pat = query.search ? likePattern(query.search) : null;
    if (pat) {
      conditions.push(
        or(like(appUsers.username, pat), like(appUsers.email, pat), like(appUsers.fullName, pat))!
      );
    }
    if (query.role) {
      conditions.push(eq(appUsers.role, query.role));
    }
    if (query.is_active !== undefined) {
      conditions.push(eq(appUsers.isActive, query.is_active === "true"));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const totalRow = await db
      .select({ c: count() })
      .from(appUsers)
      .where(whereClause);
    const total = Number(totalRow[0]?.c ?? 0);

    const activeAdminsRow = await db
      .select({ c: count() })
      .from(appUsers)
      .where(and(eq(appUsers.role, "admin"), eq(appUsers.isActive, true)));
    const active_admin_count = Number(activeAdminsRow[0]?.c ?? 0);

    const orderBy =
      query.sort === "name_asc"
        ? [asc(appUsers.fullName), asc(appUsers.email)]
        : query.sort === "last_login"
          ? [asc(sql`(${appUsers.lastLoginAt} IS NULL)`), desc(appUsers.lastLoginAt)]
          : [desc(appUsers.createdAt)];

    const rows = await db
      .select({
        id: appUsers.id,
        email: appUsers.email,
        username: appUsers.username,
        fullName: appUsers.fullName,
        role: appUsers.role,
        office: appUsers.office,
        phone: appUsers.phone,
        isActive: appUsers.isActive,
        lastLoginAt: appUsers.lastLoginAt,
        createdAt: appUsers.createdAt,
        createdByName: creator.fullName,
      })
      .from(appUsers)
      .leftJoin(creator, eq(appUsers.createdBy, creator.id))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      users: rows.map(r => publicUser(r)),
      total,
      page,
      page_size: pageSize,
      active_admin_count,
    };
  } catch (error) {
    console.warn("Admin users list fallback to legacy users:", error);
    return listLegacyUsers(db, query);
  }
}

export async function getUserDetail(db: AppDb, id: string) {
  const creator = alias(appUsers, "creator");
  const rows = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      office: appUsers.office,
      phone: appUsers.phone,
      isActive: appUsers.isActive,
      lastLoginAt: appUsers.lastLoginAt,
      createdAt: appUsers.createdAt,
      createdBy: appUsers.createdBy,
      createdByName: creator.fullName,
      deactivatedAt: appUsers.deactivatedAt,
      forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
    })
    .from(appUsers)
    .leftJoin(creator, eq(appUsers.createdBy, creator.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  const u = rows[0];
  if (!u) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }

  const audits = await db
    .select({
      id: auditLog.id,
      user_id: auditLog.userId,
      action: auditLog.action,
      target_type: auditLog.targetType,
      target_id: auditLog.targetId,
      metadata: auditLog.metadata,
      ip_address: auditLog.ipAddress,
      created_at: auditLog.createdAt,
    })
    .from(auditLog)
    .where(and(eq(auditLog.targetType, "user"), eq(auditLog.targetId, id)))
    .orderBy(desc(auditLog.createdAt))
    .limit(20);

  const base = publicUser({
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    office: u.office,
    phone: u.phone,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    createdByName: u.createdByName,
    forcePasswordChangeNextLogin: u.forcePasswordChangeNextLogin,
  });

  return {
    user: {
      ...base,
      created_by: u.createdBy,
      deactivated_at: iso(u.deactivatedAt),
    },
    audit_log: audits.map(a => ({
      ...a,
      created_at: iso(a.created_at),
    })),
  };
}

async function countActiveAdmins(db: AppDb): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(appUsers)
    .where(and(eq(appUsers.role, "admin"), eq(appUsers.isActive, true)));
  return Number(r?.c ?? 0);
}



export async function createUser(
  db: AppDb,
  body: CreateUserBody,
  actor: PlatformAuthUser,
  loginBaseUrl: string,
  req: Request
) {
  const email = body.email.trim().toLowerCase();
  const username = body.username.trim().toLowerCase();

  const dupEmail = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.email, email)).limit(1);
  if (dupEmail.length) {
    throw new AdminUserError(409, "DUPLICATE_EMAIL", "That email is already registered.", "email");
  }
  const dupUser = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.username, username)).limit(1);
  if (dupUser.length) {
    throw new AdminUserError(409, "DUPLICATE_USERNAME", "That username is already taken.", "username");
  }

  const passwordHash = await hash(crypto.randomUUID(), 10);
  const id = crypto.randomUUID();

  try {
    await db.insert(appUsers).values({
      id,
      email,
      username,
      fullName: body.full_name.trim(),
      role: body.role,
      office: body.office?.trim() || null,
      phone: body.phone?.trim() || null,
      passwordHash,
      forcePasswordChangeNextLogin: false,
      isActive: true,
      createdBy: actor.id,
    });
  } catch (e: unknown) {
    const errno = (e as { errno?: number })?.errno;
    if (errno === 1062) {
      throw new AdminUserError(409, "DUPLICATE", "Email or username already exists.");
    }
    throw e;
  }

  let emailSent = false;
  let note: string | undefined;
  if (body.send_invite && isAdminInviteSmtpConfigured()) {
    const r = await sendUserInviteEmail({
      to: email,
      username,
      loginUrl: `${loginBaseUrl.replace(/\/$/, "")}/login`,
    });
    emailSent = r.ok;
    if (!r.ok) note = r.error;
  } else if (body.send_invite && !isAdminInviteSmtpConfigured()) {
    note = "Email not configured — you can inform the user to login with their email.";
  }

  await writeAuditLog(
    actor.id,
    "user.created",
    "user",
    id,
    { role: body.role, created_by_name: actor.fullName },
    req
  );

  const creator = alias(appUsers, "creator");
  const [withCreator] = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      office: appUsers.office,
      phone: appUsers.phone,
      isActive: appUsers.isActive,
      lastLoginAt: appUsers.lastLoginAt,
      createdAt: appUsers.createdAt,
      createdByName: creator.fullName,
      forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
    })
    .from(appUsers)
    .leftJoin(creator, eq(appUsers.createdBy, creator.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  if (!withCreator) {
    throw new AdminUserError(500, "CREATE_FAILED", "User was created but could not be reloaded.");
  }
  return {
    user: publicUser(withCreator),
    email_sent: emailSent,
    note,
  };
}

export async function patchUser(db: AppDb, id: string, body: PatchUserBody, actor: PlatformAuthUser, req: Request) {
  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }

  const patch: { role?: "admin" | "broker" | "readonly"; is_active?: boolean } = {};
  if (body.role !== undefined) patch.role = body.role;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  const selfBlock = selfRoleOrDeactivationBlocked(actor.id, id, patch);
  if (selfBlock) {
    const field =
      body.is_active !== undefined ? "is_active" : body.role !== undefined ? "role" : undefined;
    throw new AdminUserError(400, "SELF_UPDATE_FORBIDDEN", selfBlock, field);
  }

  const admins = await countActiveAdmins(db);
  const lastBlock = lastActiveAdminBlocked(current, patch, admins);
  if (lastBlock) {
    throw new AdminUserError(400, "LAST_ADMIN", lastBlock);
  }

  if (body.email !== undefined) {
    const em = body.email.trim().toLowerCase();
    const clash = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(and(eq(appUsers.email, em), ne(appUsers.id, id)))
      .limit(1);
    if (clash.length) {
      throw new AdminUserError(409, "DUPLICATE_EMAIL", "That email is already registered.", "email");
    }
  }
  if (body.username !== undefined) {
    const un = body.username.trim().toLowerCase();
    const clash = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(and(eq(appUsers.username, un), ne(appUsers.id, id)))
      .limit(1);
    if (clash.length) {
      throw new AdminUserError(409, "DUPLICATE_USERNAME", "That username is already taken.", "username");
    }
  }

  const set: Record<string, unknown> = {};
  if (body.email !== undefined) set.email = body.email.trim().toLowerCase();
  if (body.username !== undefined) set.username = body.username.trim().toLowerCase();
  if (body.full_name !== undefined) set.fullName = body.full_name.trim();
  if (body.role !== undefined) set.role = body.role;
  if (body.office !== undefined) set.office = body.office === null ? null : body.office.trim() || null;
  if (body.phone !== undefined) set.phone = body.phone === null ? null : body.phone.trim() || null;
  if (body.is_active !== undefined) {
    set.isActive = body.is_active;
    if (body.is_active) {
      set.deactivatedAt = null;
    } else {
      set.deactivatedAt = new Date();
    }
  }

  if (Object.keys(set).length === 0) {
    throw new AdminUserError(400, "NO_CHANGES", "No valid changes supplied.");
  }

  const before = {
    email: current.email,
    username: current.username,
    full_name: current.fullName,
    role: current.role,
    office: current.office,
    phone: current.phone,
    is_active: current.isActive,
  };

  try {
    await db
      .update(appUsers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(set as any)
      .where(eq(appUsers.id, id));
  } catch (e: unknown) {
    const errno = (e as { errno?: number })?.errno;
    if (errno === 1062) {
      throw new AdminUserError(409, "DUPLICATE", "Email or username already exists.");
    }
    throw e;
  }

  const [updated] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  const after = {
    email: updated!.email,
    username: updated!.username,
    full_name: updated!.fullName,
    role: updated!.role,
    office: updated!.office,
    phone: updated!.phone,
    is_active: updated!.isActive,
  };

  let action = "user.updated";
  if (body.is_active === false && current.isActive) action = "user.deactivated";
  else if (body.role !== undefined && body.role !== current.role) action = "user.role_changed";

  await writeAuditLog(actor.id, action, "user", id, { before, after }, req);
  if (body.is_active === false && current.isActive) {
    await db.delete(appSessions).where(eq(appSessions.userId, id));
  }

  const creator = alias(appUsers, "creator");
  const [withCreator] = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      office: appUsers.office,
      phone: appUsers.phone,
      isActive: appUsers.isActive,
      lastLoginAt: appUsers.lastLoginAt,
      createdAt: appUsers.createdAt,
      createdByName: creator.fullName,
      forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
    })
    .from(appUsers)
    .leftJoin(creator, eq(appUsers.createdBy, creator.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  return publicUser(withCreator!);
}



export async function softDeleteUser(db: AppDb, id: string, actor: PlatformAuthUser, req: Request) {
  if (actor.id === id) {
    throw new AdminUserError(400, "SELF_UPDATE_FORBIDDEN", selfDeactivationBlocked(actor.id, id)!);
  }

  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  if (!current.isActive) {
    throw new AdminUserError(400, "ALREADY_INACTIVE", "User is already deactivated.");
  }

  const admins = await countActiveAdmins(db);
  const lastBlock = lastActiveAdminBlocked(current, { is_active: false }, admins);
  if (lastBlock) {
    throw new AdminUserError(400, "LAST_ADMIN", lastBlock);
  }

  await db
    .update(appUsers)
    .set({ isActive: false, deactivatedAt: new Date() })
    .where(eq(appUsers.id, id));
  await db.delete(appSessions).where(eq(appSessions.userId, id));

  await writeAuditLog(actor.id, "user.deactivated", "user", id, {}, req);

  const creator = alias(appUsers, "creator");
  const [withCreator] = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      office: appUsers.office,
      phone: appUsers.phone,
      isActive: appUsers.isActive,
      lastLoginAt: appUsers.lastLoginAt,
      createdAt: appUsers.createdAt,
      createdByName: creator.fullName,
      forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
      deactivatedAt: appUsers.deactivatedAt,
    })
    .from(appUsers)
    .leftJoin(creator, eq(appUsers.createdBy, creator.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  return {
    ...publicUser(withCreator!),
    deactivated_at: iso(withCreator!.deactivatedAt),
  };
}

export async function reactivateUser(db: AppDb, id: string, actor: PlatformAuthUser, req: Request) {
  const [current] = await db.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!current) {
    throw new AdminUserError(404, "NOT_FOUND", "User not found.");
  }
  if (current.isActive) {
    throw new AdminUserError(400, "ALREADY_ACTIVE", "User is already active.");
  }

  await db
    .update(appUsers)
    .set({ isActive: true, deactivatedAt: null })
    .where(eq(appUsers.id, id));

  await writeAuditLog(actor.id, "user.reactivated", "user", id, {}, req);

  const creator = alias(appUsers, "creator");
  const [withCreator] = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      office: appUsers.office,
      phone: appUsers.phone,
      isActive: appUsers.isActive,
      lastLoginAt: appUsers.lastLoginAt,
      createdAt: appUsers.createdAt,
      createdByName: creator.fullName,
      forcePasswordChangeNextLogin: appUsers.forcePasswordChangeNextLogin,
    })
    .from(appUsers)
    .leftJoin(creator, eq(appUsers.createdBy, creator.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  return publicUser(withCreator!);
}
