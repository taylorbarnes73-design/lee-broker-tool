import { z } from "zod/v4";

export const usernameRegex = /^[a-z][a-z0-9_-]{1,30}$/;

export const platformRoleSchema = z.enum(["admin", "broker", "readonly"]);

export const listUsersSortSchema = z.enum(["name_asc", "recent", "last_login"]);

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: platformRoleSchema.optional(),
  is_active: z.enum(["true", "false"]).optional(),
  sort: listUsersSortSchema.optional().default("recent"),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(100).default(25),
});

export const createUserBodySchema = z.object({
  email: z.string().trim().email().max(320),
  username: z.string().trim().regex(usernameRegex, "Invalid username format."),
  full_name: z.string().trim().min(1).max(255),
  role: platformRoleSchema,
  office: z.string().trim().max(255).nullable().optional(),
  phone: z.string().trim().max(64).nullable().optional(),
  send_invite: z.boolean().optional().default(false),
});

export const patchUserBodySchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    username: z.string().trim().regex(usernameRegex, "Invalid username format.").optional(),
    full_name: z.string().trim().min(1).max(255).optional(),
    role: platformRoleSchema.optional(),
    office: z.union([z.string().trim().max(255), z.null()]).optional(),
    phone: z.union([z.string().trim().max(64), z.null()]).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(obj => Object.keys(obj).length > 0, { message: "At least one field is required." });

export const uuidParamSchema = z.string().uuid();
