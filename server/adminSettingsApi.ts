import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { getDb } from "./db";
import { sendAdminError, sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import type { SettingsCategory } from "./settings/settingsSchema";
import {
  getGroupedCategory,
  getGroupedSettings,
  patchSettings,
  runDealiusSettingsTest,
} from "./settings/settingsStore";

const categorySchema = z.enum(["branding", "workflow", "notifications", "integrations", "security"]);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requirePlatformAdmin);

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

adminSettingsRouter.get(
  "/",
  asyncAdmin(async (_req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    res.json(await getGroupedSettings(true));
  })
);

adminSettingsRouter.post(
  "/integrations/dealius/test",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const result = await runDealiusSettingsTest(db, req.user!.id, req);
    res.json(result);
  })
);

adminSettingsRouter.get(
  "/:category",
  asyncAdmin(async (req, res) => {
    const parsed = categorySchema.safeParse(req.params.category);
    if (!parsed.success) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Invalid category.", "category");
      return;
    }
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    res.json(await getGroupedCategory(parsed.data as SettingsCategory, true));
  })
);

adminSettingsRouter.patch(
  "/",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      sendAdminError(res, 400, "VALIDATION_ERROR", "Body must be a flat object of setting keys to values.");
      return;
    }
    const out = await patchSettings(db, req.body as Record<string, unknown>, req.user!.id, req);
    res.json(out);
  })
);
