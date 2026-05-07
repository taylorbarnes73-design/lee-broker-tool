import { Router } from "express";
import { getDb } from "./db";
import { sendAdminError, sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  patchUserBodySchema,
  uuidParamSchema,
} from "./adminUsers/schemas";
import { isAdminInviteSmtpConfigured } from "./adminUsers/inviteMail";
import {
  createUser,
  getUserDetail,
  listUsers,
  patchUser,
  reactivateUser,
  softDeleteUser,
} from "./adminUsers/userService";
import type { Request, Response, NextFunction } from "express";

export const adminUsersRouter = Router();

adminUsersRouter.use(requirePlatformAdmin);

function loginBaseUrl(req: Request) {
  const fromEnv = (process.env.PUBLIC_APP_URL ?? "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host") ?? "localhost"}`;
}

function asyncAdmin(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(err => {
      if (err instanceof AdminUserError) {
        sendAdminUserError(res, err);
        return;
      }
      next(err);
    });
  };
}

adminUsersRouter.get(
  "/config",
  asyncAdmin(async (_req, res) => {
    res.json({ invite_email_configured: isAdminInviteSmtpConfigured() });
  })
);

adminUsersRouter.get(
  "/",
  asyncAdmin(async (req, res) => {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid query parameters.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const data = await listUsers(db, parsed.data);
    res.json(data);
  })
);

adminUsersRouter.post(
  "/",
  asyncAdmin(async (req, res) => {
    const parsed = createUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid request body.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const out = await createUser(db, parsed.data, req.user!, loginBaseUrl(req), req);
    res.status(201).json(out);
  })
);

adminUsersRouter.get(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const data = await getUserDetail(db, idParsed.data);
    res.json(data);
  })
);

adminUsersRouter.patch(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const parsed = patchUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(
        res,
        400,
        "VALIDATION_ERROR",
        issue?.message ?? "Invalid request body.",
        issue?.path?.join(".")
      );
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await patchUser(db, idParsed.data, parsed.data, req.user!, req);
    res.json(user);
  })
);



adminUsersRouter.delete(
  "/:id",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await softDeleteUser(db, idParsed.data, req.user!, req);
    res.json(user);
  })
);

adminUsersRouter.post(
  "/:id/reactivate",
  asyncAdmin(async (req, res) => {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid user id.", "id");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const user = await reactivateUser(db, idParsed.data, req.user!, req);
    res.json(user);
  })
);
