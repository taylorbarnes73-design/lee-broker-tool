import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import { sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { writeAuditLog } from "./auth/writeAuditLog";
import { getDb } from "./db";
import { appSettings } from "../drizzle/schema";
import { invalidateSettingsCache } from "./settings/settingsStore";
import { SETTINGS_BY_KEY } from "./settings/settingsSchema";
import { dealiusFetch, getDealiusConfig } from "./lib/dealius/client";

export const dealiusApiAdminRouter = Router();
dealiusApiAdminRouter.use(requirePlatformAdmin);

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

async function persistTestResult(actorId: string, req: Request, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const testedAt = new Date().toISOString();
  const result = success ? "success" : "failed";
  const defAt = SETTINGS_BY_KEY["integrations.dealius_api.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.dealius_api.last_test_result"];
  await db
    .insert(appSettings)
    .values({
      key: "integrations.dealius_api.last_test_at",
      value: testedAt as any,
      category: "integrations",
      description: defAt.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({ set: { value: testedAt as any, updatedAt: new Date(), updatedBy: actorId } });
  await db
    .insert(appSettings)
    .values({
      key: "integrations.dealius_api.last_test_result",
      value: result as any,
      category: "integrations",
      description: defRes.description ?? null,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .onDuplicateKeyUpdate({ set: { value: result as any, updatedAt: new Date(), updatedBy: actorId } });
  invalidateSettingsCache();
  await writeAuditLog(
    actorId,
    "settings.updated",
    "setting",
    "integrations.dealius_api.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );
}

dealiusApiAdminRouter.post(
  "/test",
  asyncAdmin(async (req, res) => {
    const cfg = await getDealiusConfig();
    if (!cfg.enabled) {
      await persistTestResult(req.user!.id, req, false).catch(() => undefined);
      res.json({ ok: false, status: 0, error: "Dealius API integration is disabled in Settings." });
      return;
    }
    if (!cfg.apiKey) {
      await persistTestResult(req.user!.id, req, false).catch(() => undefined);
      res.json({ ok: false, status: 0, error: "Dealius API key is not configured." });
      return;
    }
    if (!cfg.baseUrl) {
      await persistTestResult(req.user!.id, req, false).catch(() => undefined);
      res.json({ ok: false, status: 0, error: "Dealius base URL is not configured." });
      return;
    }

    try {
      const r = await dealiusFetch("/api/lookup/listingtypes", { configOverride: cfg });
      const bodyText = await r.text();
      let parsed: unknown = null;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        parsed = bodyText;
      }
      if (!r.ok) {
        await persistTestResult(req.user!.id, req, false).catch(() => undefined);
        res.json({
          ok: false,
          status: r.status,
          error: typeof parsed === "string" ? parsed : (parsed as any)?.message ?? r.statusText,
        });
        return;
      }
      await persistTestResult(req.user!.id, req, true).catch(() => undefined);
      res.json({ ok: true, status: r.status, listingTypes: parsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await persistTestResult(req.user!.id, req, false).catch(() => undefined);
      res.json({ ok: false, status: 0, error: msg });
    }
  })
);
