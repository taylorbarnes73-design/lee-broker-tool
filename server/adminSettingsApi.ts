import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import { count } from "drizzle-orm";
import { getDb } from "./db";
import { sendAdminError, sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import { isAdminInviteSmtpConfigured } from "./adminUsers/inviteMail";
import { writeAuditLog } from "./auth/writeAuditLog";
import { appSessions } from "../drizzle/schema";
import type { SettingsCategory } from "./settings/settingsSchema";
import {
  getGroupedCategory,
  getGroupedSettings,
  patchSettings,
  runBuildoutSettingsTest,
  runDealiusSettingsTest,
  verifyBuildoutCredentials,
  verifyDealiusCredentials,
} from "./settings/settingsStore";
import { normalizeStoredFileUrl } from "./storage";
import { startBrokerAdminIngestScheduler } from "./jobs/ingestBrokerAdminEmails";

const categorySchema = z.enum(["branding", "workflow", "notifications", "integrations", "security"]);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requirePlatformAdmin);

function normalizeOptionalUrl(value: unknown): string | null {
  return typeof value === "string" || value === null || value === undefined
    ? normalizeStoredFileUrl(value)
    : null;
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

adminSettingsRouter.get(
  "/",
  asyncAdmin(async (_req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const grouped = await getGroupedSettings(true);
    if (grouped?.branding) {
      grouped.branding.logo_url = normalizeOptionalUrl(grouped.branding.logo_url);
      grouped.branding.letterhead_template_url = normalizeOptionalUrl(grouped.branding.letterhead_template_url);
    }
    res.json(grouped);
  })
);

adminSettingsRouter.get(
  "/meta",
  asyncAdmin(async (_req, res) => {
    res.json({ invite_email_configured: isAdminInviteSmtpConfigured() });
  })
);

adminSettingsRouter.post(
  "/actions/revoke-all-sessions",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const [row] = await db.select({ c: count() }).from(appSessions);
    const cleared = Number(row?.c ?? 0);
    await db.delete(appSessions);
    await writeAuditLog(req.user!.id, "sessions.revoked_all", "system", null, { sessions_cleared: cleared }, req);
    res.json({ cleared });
  })
);

const dealiusVerifyBodySchema = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});

adminSettingsRouter.post(
  "/integrations/dealius/verify",
  asyncAdmin(async (req, res) => {
    const parsed = dealiusVerifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(res, 400, "VALIDATION_ERROR", issue?.message ?? "Invalid body.", issue?.path?.join("."));
      return;
    }
    const result = await verifyDealiusCredentials(parsed.data.username, parsed.data.password);
    res.json(result);
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

const buildoutVerifyBodySchema = z.object({
  api_key: z.string().trim().min(1).max(256),
  api_base_url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  default_company_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

adminSettingsRouter.post(
  "/integrations/buildout/verify",
  asyncAdmin(async (req, res) => {
    const parsed = buildoutVerifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendAdminError(res, 400, "VALIDATION_ERROR", issue?.message ?? "Invalid body.", issue?.path?.join("."));
      return;
    }
    const baseRaw = parsed.data.api_base_url;
    const apiBaseUrl = baseRaw === "" || baseRaw === undefined || baseRaw === null ? null : baseRaw;
    const companyId =
      parsed.data.default_company_id === undefined ? null : parsed.data.default_company_id;
    const result = await verifyBuildoutCredentials(parsed.data.api_key, apiBaseUrl, companyId);
    res.json(result);
  })
);

adminSettingsRouter.post(
  "/integrations/buildout/test",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const result = await runBuildoutSettingsTest(db, req.user!.id, req);
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
    const grouped = await getGroupedCategory(parsed.data as SettingsCategory, true);
    if (parsed.data === "branding") {
      grouped.logo_url = normalizeOptionalUrl(grouped.logo_url);
      grouped.letterhead_template_url = normalizeOptionalUrl(grouped.letterhead_template_url);
    }
    res.json(grouped);
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
    if (out?.branding) {
      out.branding.logo_url = normalizeOptionalUrl(out.branding.logo_url);
      out.branding.letterhead_template_url = normalizeOptionalUrl(out.branding.letterhead_template_url);
    }
    // Newly-saved Graph credentials should start polling immediately, without a process restart.
    startBrokerAdminIngestScheduler().catch(err =>
      console.error("[brokerAdminIngest] scheduler init failed:", err)
    );
    res.json(out);
  })
);
