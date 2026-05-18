import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requirePlatformAdmin } from "./adminUsers/requirePlatformAdmin";
import { sendAdminError, sendAdminUserError, AdminUserError } from "./adminUsers/adminErrors";
import { writeAuditLog } from "./auth/writeAuditLog";
import { getDb } from "./db";
import { appSettings } from "../drizzle/schema";
import { invalidateSettingsCache } from "./settings/settingsStore";
import { getIngestStatus, runIngestOnce } from "./jobs/ingestBrokerAdminEmails";
import { testGraphConnection } from "./lib/msGraph";
import { SETTINGS_BY_KEY } from "./settings/settingsSchema";

export const brokerAdminIngestRouter = Router();
brokerAdminIngestRouter.use(requirePlatformAdmin);

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
  const defAt = SETTINGS_BY_KEY["integrations.broker_admin_ingest.last_test_at"];
  const defRes = SETTINGS_BY_KEY["integrations.broker_admin_ingest.last_test_result"];
  await db
    .insert(appSettings)
    .values({
      key: "integrations.broker_admin_ingest.last_test_at",
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
      key: "integrations.broker_admin_ingest.last_test_result",
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
    "integrations.broker_admin_ingest.test",
    { category: "integrations", before_redacted: "(test)", after_redacted: result },
    req
  );
}

brokerAdminIngestRouter.post(
  "/test",
  asyncAdmin(async (req, res) => {
    const result = await testGraphConnection();
    await persistTestResult(req.user!.id, req, result.success).catch(() => undefined);
    res.json(result);
  })
);

brokerAdminIngestRouter.post(
  "/run",
  asyncAdmin(async (req, res) => {
    const db = await getDb();
    if (!db) {
      sendAdminError(res, 503, "NO_DATABASE", "Database is not available.");
      return;
    }
    const summary = await runIngestOnce();
    await writeAuditLog(
      req.user!.id,
      "broker_admin_ingest.run",
      "system",
      null,
      { imported: summary.imported, skipped: summary.skipped, errors: summary.errors },
      req
    );
    res.json(summary);
  })
);

brokerAdminIngestRouter.get(
  "/status",
  asyncAdmin(async (_req, res) => {
    const status = await getIngestStatus();
    res.json(status);
  })
);
