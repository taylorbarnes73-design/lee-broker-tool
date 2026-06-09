import type { Request, Response } from "express";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { appUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { writeAuditLog } from "./writeAuditLog";

const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(512),
  newPassword: z.string().min(8).max(512),
});

export async function handleChangePlatformPassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Not authenticated." });
    return;
  }

  const parsed = changePasswordBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) {
    res.status(400).json({ success: false, error: "New password must differ from the current password." });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ success: false, error: "Database unavailable." });
    return;
  }

  const rows = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
  const user = rows[0];
  if (!user?.passwordHash) {
    res.status(400).json({
      success: false,
      error: "Password change is only available for platform accounts with a password set.",
    });
    return;
  }

  const ok = await compare(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ success: false, error: "Current password is incorrect." });
    return;
  }

  const passwordHash = await hash(newPassword, 10);
  await db.update(appUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(appUsers.id, userId));
  await writeAuditLog(userId, "password.changed", "user", userId, {}, req);

  res.json({ success: true, message: "Password updated." });
}
