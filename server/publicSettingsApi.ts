import { Router } from "express";
import { getPublicToolSettings } from "./settings/settingsStore";
import { normalizeStoredFileUrl } from "./storage";
import { ENV } from "./_core/env";

export const publicSettingsRouter = Router();

const fallbackPublicSettings = {
  company_name: "Lee & Associates Newport Beach",
  logo_url: null,
  primary_color: "#A6192E",
  support_email: "_NewportBeach-BrokerAdmin@lee-associates.com",
  marketing_email: "fperkins@lee-associates.com",
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
  // The Google Maps JS API requires a browser-visible key by design; the real
  // protection is an HTTP-referrer restriction in the Google Cloud Console.
  // Serving it from ENV here keeps a single configurable source of truth
  // instead of a key hardcoded into the client bundle.
  const mapsJsKey = ENV.googleMapsApiKey?.trim() || "";
  try {
    const settings = await getPublicToolSettings();
    res.json({
      ...settings,
      logo_url: normalizeStoredFileUrl(settings.logo_url),
      maps_js_key: mapsJsKey,
    });
  } catch (error) {
    console.error("[public settings]", error);
    res.json({ ...fallbackPublicSettings, maps_js_key: mapsJsKey });
  }
});
