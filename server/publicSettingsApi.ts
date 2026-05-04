import { Router } from "express";
import { getPublicBranding } from "./settings/settingsStore";

export const publicSettingsRouter = Router();

publicSettingsRouter.get("/public", async (_req, res) => {
  try {
    res.json(await getPublicBranding());
  } catch (error) {
    console.error("[public settings]", error);
    res.status(500).json({ error: { code: "SETTINGS_ERROR", message: "Could not load public settings." } });
  }
});
