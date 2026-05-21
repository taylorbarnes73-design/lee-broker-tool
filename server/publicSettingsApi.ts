import { Router } from "express";
import { getPublicToolSettings } from "./settings/settingsStore";
import { normalizeStoredFileUrl } from "./storage";

export const publicSettingsRouter = Router();

const fallbackPublicSettings = {
  company_name: "Lee & Associates Newport Beach",
  logo_url: null,
  primary_color: "#A6192E",
  support_email: "tbarnes@lee-associates.com",
  workflow: {
    confidential_warning_enabled: true,
    confidential_warning_text: "Confidential deals follow restricted handling per the deal team's instructions.",
    auto_save_interval_seconds: 30,
    default_listing_term_months: 12,
    commission_split_must_sum_100: true,
    require_voucher_attachment: true,
  },
  notifications: {
    email_on_submission: true,
    email_on_status_change: true,
    email_on_dealius_success: true,
    admin_digest_enabled: false,
    admin_digest_time: "08:00",
  },
};

publicSettingsRouter.get("/public", async (_req, res) => {
  try {
    const settings = await getPublicToolSettings();
    res.json({
      ...settings,
      logo_url: normalizeStoredFileUrl(settings.logo_url),
    });
  } catch (error) {
    console.error("[public settings]", error);
    res.json(fallbackPublicSettings);
  }
});
